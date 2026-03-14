import ffmpeg from 'fluent-ffmpeg';
import { Storage } from '@google-cloud/storage';
import { config } from '../config/gcp';
import { VideoClip, PageNarration, FinalVideo, AudioSegment, Language } from '../types/models';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getFirestore } from '../config/firebase';
import { sendCompletionNotification } from '../config/fcm';

export class VideoCompositor {
  private storage: Storage;
  private bucket: string;

  constructor() {
    this.storage = new Storage({
      projectId: config.projectId,
    });
    this.bucket = config.storageBucket;
  }

  /**
   * Composes final video from page clips and narration audio with BGM
   * @param clips - Array of video clips for each page
   * @param pageNarrations - Array of narration audio for each page (with multiple audio segments per page)
   * @param emotionalTone - Emotional tone from image analysis for BGM selection
   * @param jobId - Job ID for storage path
   * @param userId - User ID for retrieving FCM token
   * @param language - User's language preference for notification
   * @returns FinalVideo with URL and metadata
   */
  async compose(
    clips: VideoClip[],
    pageNarrations: PageNarration[],
    emotionalTone: string,
    jobId: string,
    userId: string,
    language: Language
  ): Promise<FinalVideo> {
    const startTime = Date.now();
    const tempDir = tmpdir();
    const tempFiles: string[] = [];

    try {
      // Sort clips and narrations by page number
      const sortedClips = [...clips].sort((a, b) => a.pageNumber - b.pageNumber);
      const sortedNarrations = [...pageNarrations].sort((a, b) => a.pageNumber - b.pageNumber);

      // Validate that clips and narrations match
      if (sortedClips.length !== sortedNarrations.length) {
        throw new Error(
          `Clip count (${sortedClips.length}) does not match narration count (${sortedNarrations.length})`
        );
      }

      // Download all clips and adjust durations to match actual narration
      const clipPaths: string[] = [];
      for (let i = 0; i < sortedClips.length; i++) {
        const clipPath = join(tempDir, `clip-${i}-${uuidv4()}.mp4`);
        await this.downloadFile(sortedClips[i].videoUrl, clipPath);
        tempFiles.push(clipPath);

        // Adjust clip duration to match actual narration duration
        const adjustedClipPath = await this.adjustClipDuration(
          clipPath,
          sortedClips[i].duration,
          sortedNarrations[i].actualDuration,
          sortedClips[i].pageNumber,
          tempDir
        );
        
        // If adjustment was made, add adjusted file to temp files
        if (adjustedClipPath !== clipPath) {
          tempFiles.push(adjustedClipPath);
        }
        
        clipPaths.push(adjustedClipPath);
      }

      // Mix audio tracks for each page
      const mixedAudioPaths: string[] = [];
      for (let i = 0; i < sortedNarrations.length; i++) {
        const mixedAudioPath = await this.mixPageAudio(
          sortedNarrations[i],
          tempDir,
          i
        );
        mixedAudioPaths.push(mixedAudioPath);
        tempFiles.push(mixedAudioPath);
      }

      // Select and download BGM based on emotional tone
      const bgmPath = await this.selectAndDownloadBGM(emotionalTone, tempDir);
      if (bgmPath) {
        tempFiles.push(bgmPath);
      }

      // Create output path
      const outputPath = join(tempDir, `final-${uuidv4()}.mp4`);
      tempFiles.push(outputPath);

      // Calculate total video duration for BGM looping
      const totalDuration = sortedNarrations.reduce((sum, n) => sum + n.duration, 0);

      // Compose video with crossfade transitions, synchronized audio, and BGM
      await this.composeWithFFmpeg(
        clipPaths,
        mixedAudioPaths,
        bgmPath,
        totalDuration,
        outputPath,
        sortedClips[0].width,
        sortedClips[0].height
      );

      // Upload to Cloud Storage
      const fileName = `jobs/${jobId}/final/video.mp4`;
      const file = this.storage.bucket(this.bucket).file(fileName);

      await file.save(await fs.readFile(outputPath), {
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            jobId,
            pageCount: sortedClips.length.toString(),
            duration: totalDuration.toString(),
          },
        },
      });

      const videoUrl = `gs://${this.bucket}/${fileName}`;

      // Clean up temporary files
      await this.cleanupFiles(tempFiles);

      // Send FCM notification to user
      await this.sendNotificationToUser(userId, jobId, language);

      // Validate completion time
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (elapsedTime > config.timeouts.composition) {
        console.warn(
          `Video composition took ${elapsedTime}s, exceeding ${config.timeouts.composition}s limit`
        );
      }

      return {
        videoUrl,
        duration: totalDuration,
        width: sortedClips[0].width,
        height: sortedClips[0].height,
        format: 'mp4',
      };
    } catch (error) {
      // Clean up temporary files on error
      await this.cleanupFiles(tempFiles);

      const elapsedTime = (Date.now() - startTime) / 1000;
      console.error(`Video composition failed after ${elapsedTime}s:`, error);
      throw new Error(
        `Failed to compose video: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Mixes multiple audio tracks for a single page with silence padding and crossfades
   * @param pageNarration - Page narration with multiple audio segments
   * @param tempDir - Temporary directory for intermediate files
   * @param pageIndex - Page index for file naming
   * @returns Path to mixed audio file
   */
  private async mixPageAudio(
    pageNarration: PageNarration,
    tempDir: string,
    pageIndex: number
  ): Promise<string> {
    const { audioSegments } = pageNarration;

    // If only one segment, just download and return
    if (audioSegments.length === 1) {
      const audioPath = join(tempDir, `page-${pageIndex}-audio-${uuidv4()}.mp3`);
      await this.downloadFile(audioSegments[0].audioUrl, audioPath);
      return audioPath;
    }

    // Download all audio segments
    const segmentPaths: string[] = [];
    for (let i = 0; i < audioSegments.length; i++) {
      const segmentPath = join(tempDir, `page-${pageIndex}-segment-${i}-${uuidv4()}.mp3`);
      await this.downloadFile(audioSegments[i].audioUrl, segmentPath);
      segmentPaths.push(segmentPath);
    }

    // Sort segments by startTime
    const sortedSegments = audioSegments
      .map((seg, idx) => ({ segment: seg, path: segmentPaths[idx] }))
      .sort((a, b) => a.segment.startTime - b.segment.startTime);

    // Build audio mixing with silence padding and crossfades
    const outputPath = join(tempDir, `page-${pageIndex}-mixed-${uuidv4()}.mp3`);
    await this.mixAudioSegments(sortedSegments, outputPath);

    return outputPath;
  }

  /**
   * Mixes audio segments with silence padding and crossfades
   * - 0.3s silence between narrator and character segments
   * - 50ms crossfade between character voice segments (within dialogue only)
   */
  private async mixAudioSegments(
    segments: Array<{ segment: AudioSegment; path: string }>,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const SILENCE_PADDING = 0.3; // 0.3 seconds between narrator and character
      const CROSSFADE_DURATION = 0.05; // 50ms crossfade between character voices

      const command = ffmpeg();

      // Add all audio segments as inputs
      segments.forEach(({ path }) => {
        command.input(path);
      });

      // Build filter chain for concatenation with padding and crossfades
      const filters: string[] = [];
      const delayedStreams: string[] = [];
      let currentTime = 0;

      // First pass: Apply delays to all segments
      for (let i = 0; i < segments.length; i++) {
        const delayMs = Math.round(currentTime * 1000);
        const delayedLabel = `[delayed${i}]`;
        filters.push(`[${i}:a]adelay=${delayMs}|${delayMs}${delayedLabel}`);
        delayedStreams.push(delayedLabel);
        
        // Calculate next segment's start time
        const current = segments[i].segment;
        const next = segments[i + 1]?.segment;
        
        if (next) {
          const isCharacterToCharacter =
            (current.speaker === 'protagonist' || current.speaker === 'supporting_character') &&
            (next.speaker === 'protagonist' || next.speaker === 'supporting_character');
          
          if (isCharacterToCharacter) {
            // Overlap by crossfade duration for character-to-character transitions
            currentTime += current.duration - CROSSFADE_DURATION;
          } else {
            // Add silence padding for narrator-character transitions
            const isNarratorToCharacter =
              current.speaker === 'narrator' &&
              (next.speaker === 'protagonist' || next.speaker === 'supporting_character');
            const isCharacterToNarrator =
              (current.speaker === 'protagonist' || current.speaker === 'supporting_character') &&
              next.speaker === 'narrator';
            
            if (isNarratorToCharacter || isCharacterToNarrator) {
              currentTime += current.duration + SILENCE_PADDING;
            } else {
              // Same speaker type or other transitions - no padding
              currentTime += current.duration;
            }
          }
        }
      }

      // Second pass: Apply crossfades between character segments
      const crossfadedStreams: string[] = [];
      let skipNext = false;
      
      for (let i = 0; i < segments.length; i++) {
        if (skipNext) {
          skipNext = false;
          continue;
        }
        
        const current = segments[i].segment;
        const next = segments[i + 1]?.segment;
        
        const isCharacterToCharacter =
          next &&
          (current.speaker === 'protagonist' || current.speaker === 'supporting_character') &&
          (next.speaker === 'protagonist' || next.speaker === 'supporting_character');
        
        if (isCharacterToCharacter) {
          // Apply crossfade between current and next
          const crossfadeLabel = `[crossfade${i}]`;
          filters.push(
            `${delayedStreams[i]}${delayedStreams[i + 1]}acrossfade=d=${CROSSFADE_DURATION}:c1=tri:c2=tri${crossfadeLabel}`
          );
          crossfadedStreams.push(crossfadeLabel);
          skipNext = true; // Skip next segment as it's already processed
        } else {
          // No crossfade, use delayed stream directly
          crossfadedStreams.push(delayedStreams[i]);
        }
      }

      // Mix all processed audio streams
      const mixInputs = crossfadedStreams.join('');
      filters.push(`${mixInputs}amix=inputs=${crossfadedStreams.length}:duration=longest[aout]`);

      command
        .complexFilter(filters.join(';'))
        .outputOptions(['-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '192k'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Selects and downloads BGM based on emotional tone
   * @param emotionalTone - Emotional tone from image analysis
   * @param tempDir - Temporary directory for download
   * @returns Path to downloaded BGM file, or null if BGM not available
   */
  private async selectAndDownloadBGM(
    emotionalTone: string,
    tempDir: string
  ): Promise<string | null> {
    try {
      // Map emotional tone to BGM track
      const bgmTrack = this.mapEmotionalToneToBGM(emotionalTone);
      
      // Construct BGM URL
      const bgmStoragePath = config.bgmStoragePath;
      const bgmUrl = bgmStoragePath.endsWith('/')
        ? `${bgmStoragePath}${bgmTrack}`
        : `${bgmStoragePath}/${bgmTrack}`;

      console.log(`Selected BGM: ${bgmTrack} for emotional tone: ${emotionalTone}`);

      // Download BGM file
      const bgmPath = join(tempDir, `bgm-${uuidv4()}.mp3`);
      await this.downloadFile(bgmUrl, bgmPath);

      return bgmPath;
    } catch (error) {
      console.warn('Failed to download BGM, continuing without background music:', error);
      return null;
    }
  }

  /**
   * Maps emotional tone to BGM track filename
   * @param emotionalTone - Emotional tone from image analysis
   * @returns BGM filename
   */
  private mapEmotionalToneToBGM(emotionalTone: string): string {
      const tone = emotionalTone.toLowerCase();

      // Map to bright BGM
      if (tone.includes('bright') || tone.includes('happy') || tone.includes('joyful') || 
          tone.includes('cheerful') || tone.includes('楽しい') || tone.includes('明るい')) {
        return 'bright.mp3';
      }

      // Map to adventure BGM
      if (tone.includes('adventure') || tone.includes('exciting') || tone.includes('dynamic') ||
          tone.includes('energetic') || tone.includes('冒険') || tone.includes('わくわく')) {
        return 'adventure.mp3';
      }

      // Map to sad BGM
      if (tone.includes('sad') || tone.includes('melancholic') || tone.includes('somber') ||
          tone.includes('悲しい') || tone.includes('寂しい')) {
        return 'sad.mp3';
      }

      // Map to calm BGM (default)
      if (tone.includes('calm') || tone.includes('peaceful') || tone.includes('gentle') ||
          tone.includes('serene') || tone.includes('穏やか') || tone.includes('静か')) {
        return 'calm.mp3';
      }

      // Default to calm for unrecognized tones
      console.log(`Unrecognized emotional tone: ${emotionalTone}, defaulting to calm BGM`);
      return 'calm.mp3';
    }

  /**
   * Composes video using FFmpeg with crossfade transitions, audio sync, and BGM
   */
  private async composeWithFFmpeg(
    clipPaths: string[],
    audioPaths: string[],
    bgmPath: string | null,
    totalDuration: number,
    outputPath: string,
    width: number,
    height: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const crossfadeDuration = 0.5; // 0.5 second crossfade

      // Build FFmpeg command
      const command = ffmpeg();

      // Add all video clips as inputs
      clipPaths.forEach((clipPath) => {
        command.input(clipPath);
      });

      // Add all audio files as inputs
      audioPaths.forEach((audioPath) => {
        command.input(audioPath);
      });

      // Add BGM as input if available
      const bgmInputIndex = bgmPath ? clipPaths.length + audioPaths.length : -1;
      if (bgmPath) {
        command.input(bgmPath);
      }

      // Build complex filter for video with crossfade transitions
      const videoFilters: string[] = [];
      let currentLabel = '[0:v]';

      for (let i = 1; i < clipPaths.length; i++) {
        const nextLabel = `[v${i}]`;
        const outputLabel = i === clipPaths.length - 1 ? '[vout]' : `[v${i}out]`;

        // Crossfade between current and next clip
        videoFilters.push(
          `${currentLabel}[${i}:v]xfade=transition=fade:duration=${crossfadeDuration}:offset=${i * 5 - crossfadeDuration}${outputLabel}`
        );

        currentLabel = outputLabel;
      }

      // Build audio concatenation filter for narration
      const audioInputs = audioPaths.map((_, i) => `[${clipPaths.length + i}:a]`).join('');
      const audioFilter = `${audioInputs}concat=n=${audioPaths.length}:v=0:a=1[narration]`;

      // Build BGM filter with looping, volume adjustment, and fade-in/out
      let finalAudioFilter: string;
      if (bgmPath) {
        const BGM_VOLUME = 0.25; // 25% of narration volume (20-30% range)
        const FADE_DURATION = 1.0; // 1 second fade-in/out

        // Loop BGM to match total duration, apply volume, fade-in, and fade-out
        const bgmFilter = `[${bgmInputIndex}:a]aloop=loop=-1:size=2e9,atrim=duration=${totalDuration},volume=${BGM_VOLUME},afade=t=in:st=0:d=${FADE_DURATION},afade=t=out:st=${totalDuration - FADE_DURATION}:d=${FADE_DURATION}[bgm]`;
        
        // Mix narration and BGM
        finalAudioFilter = `[narration][bgm]amix=inputs=2:duration=first:dropout_transition=0[aout]`;

        // Combine all filters
        const complexFilter = [...videoFilters, audioFilter, bgmFilter, finalAudioFilter].join(';');

        command
          .complexFilter(complexFilter)
          .outputOptions([
            '-map', currentLabel === '[0:v]' ? '[0:v]' : '[vout]',
            '-map', '[aout]',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            `-s ${width}x${height}`,
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      } else {
        // No BGM, use narration only
        const complexFilter = [...videoFilters, audioFilter].join(';');

        command
          .complexFilter(complexFilter)
          .outputOptions([
            '-map', currentLabel === '[0:v]' ? '[0:v]' : '[vout]',
            '-map', '[narration]',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            `-s ${width}x${height}`,
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      }
    });
  }

  /**
   * Downloads a file from Cloud Storage to local path
   */
  private async downloadFile(gsUrl: string, localPath: string): Promise<void> {
    // Parse gs:// URL
    const match = gsUrl.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid Cloud Storage URL: ${gsUrl}`);
    }

    const [, bucket, filePath] = match;
    const file = this.storage.bucket(bucket).file(filePath);

    await file.download({ destination: localPath });
  }

  /**
   * Cleans up temporary files
   */
  private async cleanupFiles(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (path) => {
        try {
          await fs.unlink(path);
        } catch (error) {
          // Ignore errors if file doesn't exist
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn(`Failed to cleanup file ${path}:`, error);
          }
        }
      })
    );
  }

    /**
     * Adjusts video clip duration to match actual narration duration
     * @param clipPath - Path to video clip file
     * @param clipDuration - Original clip duration (estimated)
     * @param actualDuration - Actual narration duration from TTS
     * @param pageNumber - Page number for logging
     * @param tempDir - Temporary directory for output
     * @returns Path to adjusted video clip
     */
    private async adjustClipDuration(
      clipPath: string,
      clipDuration: number,
      actualDuration: number,
      pageNumber: number,
      tempDir: string
    ): Promise<string> {
      const durationDiff = Math.abs(clipDuration - actualDuration);

      // Log warning if duration difference exceeds 3 seconds
      if (durationDiff > 3) {
        console.warn(
          `Page ${pageNumber}: Large duration difference detected (${durationDiff.toFixed(2)}s). ` +
          `Clip: ${clipDuration.toFixed(2)}s, Narration: ${actualDuration.toFixed(2)}s`
        );
      }

      // If durations match closely (< 0.1s), no adjustment needed
      if (durationDiff < 0.1) {
        return clipPath;
      }

      const outputPath = join(tempDir, `adjusted-${pageNumber}-${uuidv4()}.mp4`);

      // Case 1: Narration shorter than clip (need to shorten video)
      if (actualDuration < clipDuration) {
        const speedFactor = clipDuration / actualDuration;

        // Use setpts filter for ±10% speed adjustment
        if (speedFactor >= 0.9 && speedFactor <= 1.1) {
          await this.adjustClipSpeed(clipPath, speedFactor, outputPath);
        } else {
          // Trim clip and add 0.5s freeze frame
          await this.trimAndFreezeClip(clipPath, actualDuration, outputPath);
        }
      }
      // Case 2: Narration longer than clip (need to extend video)
      else {
        await this.extendClipWithFreezeFrame(clipPath, actualDuration, outputPath);
      }

      return outputPath;
    }

    /**
     * Adjusts clip playback speed using setpts filter
     * @param inputPath - Input video path
     * @param speedFactor - Speed multiplication factor (> 1 = faster, < 1 = slower)
     * @param outputPath - Output video path
     */
    private async adjustClipSpeed(
      inputPath: string,
      speedFactor: number,
      outputPath: string
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const ptsValue = 1 / speedFactor;

        ffmpeg(inputPath)
          .videoFilters(`setpts=${ptsValue}*PTS`)
          .audioFilters(`atempo=${speedFactor}`)
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });
    }

    /**
     * Trims clip to target duration and adds 0.5s freeze frame
     * @param inputPath - Input video path
     * @param targetDuration - Target duration in seconds
     * @param outputPath - Output video path
     */
    private async trimAndFreezeClip(
      inputPath: string,
      targetDuration: number,
      outputPath: string
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const FREEZE_DURATION = 0.5;
        const trimDuration = targetDuration - FREEZE_DURATION;

        ffmpeg(inputPath)
          .complexFilter([
            // Trim video to target duration minus freeze duration
            `[0:v]trim=0:${trimDuration},setpts=PTS-STARTPTS[trimmed]`,
            // Extract last frame and loop it for freeze duration
            `[0:v]trim=${trimDuration}:${trimDuration + 0.1},setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0[freeze]`,
            // Concatenate trimmed video and freeze frame
            `[trimmed][freeze]concat=n=2:v=1:a=0[vout]`,
          ])
          .outputOptions([
            '-map', '[vout]',
            '-t', targetDuration.toString(),
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });
    }

    /**
     * Extends clip with freeze frame and applies fade-out
     * @param inputPath - Input video path
     * @param targetDuration - Target duration in seconds
     * @param outputPath - Output video path
     */
    private async extendClipWithFreezeFrame(
      inputPath: string,
      targetDuration: number,
      outputPath: string
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const FADE_DURATION = 0.3;

        ffmpeg(inputPath)
          .complexFilter([
            // Get original video duration
            `[0:v]split[original][lastframe]`,
            // Extract last frame and extend to fill remaining duration
            `[lastframe]trim=end_frame=1,loop=loop=-1:size=1:start=0,setpts=PTS-STARTPTS[freeze]`,
            // Apply fade-out on freeze frame
            `[freeze]fade=t=out:st=${targetDuration - FADE_DURATION}:d=${FADE_DURATION}[freeze_fade]`,
            // Concatenate original and freeze frame
            `[original][freeze_fade]concat=n=2:v=1:a=0[vout]`,
          ])
          .outputOptions([
            '-map', '[vout]',
            '-t', targetDuration.toString(),
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });
    }

  /**
   * Sends FCM push notification to user when video composition completes
   * @param userId - User ID to retrieve FCM token
   * @param jobId - Job ID for deep linking
   * @param language - User's language preference
   */
  private async sendNotificationToUser(
    userId: string,
    jobId: string,
    language: Language
  ): Promise<void> {
    try {
      // Retrieve user's FCM token from Firestore
      const firestore = getFirestore();
      const userDoc = await firestore.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        console.warn(`User ${userId} not found in Firestore, skipping notification`);
        return;
      }

      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      // Skip notification if user has no FCM token (notifications disabled)
      if (!fcmToken) {
        console.log(`User ${userId} has no FCM token, skipping notification`);
        return;
      }

      // Send notification
      await sendCompletionNotification(fcmToken, jobId, language);
    } catch (error) {
      // Log warning but don't throw - notification failure shouldn't fail the job
      console.warn(`Failed to send notification for job ${jobId}:`, error);
    }
  }
}
