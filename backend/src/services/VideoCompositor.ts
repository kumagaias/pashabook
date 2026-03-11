import ffmpeg from 'fluent-ffmpeg';
import { Storage } from '@google-cloud/storage';
import { config } from '../config/gcp';
import { VideoClip, PageNarration, FinalVideo } from '../types/models';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

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
   * Composes final video from page clips and narration audio
   * @param clips - Array of video clips for each page
   * @param pageNarrations - Array of narration audio for each page
   * @param jobId - Job ID for storage path
   * @returns FinalVideo with URL and metadata
   */
  async compose(
    clips: VideoClip[],
    pageNarrations: PageNarration[],
    jobId: string
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

      // Download all clips and audio files
      const clipPaths: string[] = [];
      const audioPaths: string[] = [];

      for (let i = 0; i < sortedClips.length; i++) {
        const clipPath = join(tempDir, `clip-${i}-${uuidv4()}.mp4`);
        const audioPath = join(tempDir, `audio-${i}-${uuidv4()}.mp3`);

        await this.downloadFile(sortedClips[i].videoUrl, clipPath);
        await this.downloadFile(sortedNarrations[i].audioUrl, audioPath);

        clipPaths.push(clipPath);
        audioPaths.push(audioPath);
        tempFiles.push(clipPath, audioPath);
      }

      // Create output path
      const outputPath = join(tempDir, `final-${uuidv4()}.mp4`);
      tempFiles.push(outputPath);

      // Compose video with crossfade transitions and synchronized audio
      await this.composeWithFFmpeg(
        clipPaths,
        audioPaths,
        outputPath,
        sortedClips[0].width,
        sortedClips[0].height
      );

      // Calculate total duration
      const totalDuration = sortedNarrations.reduce((sum, n) => sum + n.duration, 0);

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
   * Composes video using FFmpeg with crossfade transitions and audio sync
   */
  private async composeWithFFmpeg(
    clipPaths: string[],
    audioPaths: string[],
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

      // Build audio concatenation filter
      const audioInputs = audioPaths.map((_, i) => `[${clipPaths.length + i}:a]`).join('');
      const audioFilter = `${audioInputs}concat=n=${audioPaths.length}:v=0:a=1[aout]`;

      // Combine filters
      const complexFilter = [...videoFilters, audioFilter].join(';');

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
}
