import ffmpeg from 'fluent-ffmpeg';
import { Storage } from '@google-cloud/storage';
import { config } from '../config/gcp';
import { Illustration, VideoClip, KenBurnsParams } from '../types/models';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export class AnimationEngine {
  private storage: Storage;
  private bucket: string;

  constructor() {
    this.storage = new Storage({
      projectId: config.projectId,
    });
    this.bucket = config.storageBucket;
  }

  /**
   * Creates a standard page animation with Ken Burns effect
   * @param illustration - The illustration to animate
   * @param estimatedDuration - Estimated duration from StoryGenerator in seconds
   * @param jobId - Job ID for storage path
   * @returns VideoClip with animation URL and duration
   */
  async animateStandardPage(
    illustration: Illustration,
    estimatedDuration: number,
    jobId: string
  ): Promise<VideoClip> {
    const tempDir = tmpdir();
    const inputPath = join(tempDir, `input-${uuidv4()}.jpg`);
    const outputPath = join(tempDir, `output-${uuidv4()}.mp4`);

    try {
      // Download illustration from Cloud Storage
      await this.downloadFile(illustration.imageUrl, inputPath);

      // Randomly select Ken Burns parameters
      const params = this.generateKenBurnsParams();

      // Generate video with Ken Burns effect using estimated duration
      await this.applyKenBurnsEffect(
        inputPath,
        outputPath,
        estimatedDuration,
        params,
        illustration.width,
        illustration.height
      );

      // Upload to Cloud Storage
      const fileName = `jobs/${jobId}/animations/page-${illustration.pageNumber}.mp4`;
      const file = this.storage.bucket(this.bucket).file(fileName);

      await file.save(await fs.readFile(outputPath), {
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            jobId,
            pageNumber: illustration.pageNumber.toString(),
            animationType: 'standard',
            zoomDirection: params.zoomDirection,
            panDirection: params.panDirection,
          },
        },
      });

      const videoUrl = `gs://${this.bucket}/${fileName}`;

      // Clean up temporary files
      await this.cleanupFiles([inputPath, outputPath]);

      return {
        pageNumber: illustration.pageNumber,
        videoUrl,
        duration: estimatedDuration,
        width: illustration.width,
        height: illustration.height,
      };
    } catch (error) {
      // Clean up temporary files on error
      await this.cleanupFiles([inputPath, outputPath]);
      
      console.error(
        `Failed to animate standard page ${illustration.pageNumber}:`,
        error
      );
      throw new Error(
        `Failed to animate standard page ${illustration.pageNumber}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Randomly generates Ken Burns effect parameters
   */
  private generateKenBurnsParams(): KenBurnsParams {
    // Randomly select zoom direction (in or out)
    const zoomDirection: 'in' | 'out' = Math.random() < 0.5 ? 'in' : 'out';

    // Randomly select pan direction (left, right, or none)
    const panOptions: Array<'left' | 'right' | 'none'> = ['left', 'right', 'none'];
    const panDirection = panOptions[Math.floor(Math.random() * panOptions.length)];

    return {
      zoomDirection,
      panDirection,
    };
  }

  /**
   * Applies Ken Burns effect to an image using FFmpeg
   */
  private async applyKenBurnsEffect(
    inputPath: string,
    outputPath: string,
    duration: number,
    params: KenBurnsParams,
    width: number,
    height: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Calculate zoom and pan parameters
      const fps = 30;
      const totalFrames = Math.ceil(duration * fps);

      // Zoom parameters
      const zoomStart = params.zoomDirection === 'in' ? 1.0 : 1.3;
      const zoomEnd = params.zoomDirection === 'in' ? 1.3 : 1.0;

      // Pan parameters (x position)
      let xStart = '(iw-iw/zoom)/2';
      let xEnd = '(iw-iw/zoom)/2';

      if (params.panDirection === 'left') {
        xStart = '0';
        xEnd = 'iw-iw/zoom';
      } else if (params.panDirection === 'right') {
        xStart = 'iw-iw/zoom';
        xEnd = '0';
      }

      // Build zoompan filter
      // Formula: zoom interpolates from zoomStart to zoomEnd over duration
      // x and y control the pan position
      const zoomFormula = `${zoomStart}+(${zoomEnd}-${zoomStart})*(on/${totalFrames})`;
      const xFormula = params.panDirection === 'none' 
        ? '(iw-iw/zoom)/2'
        : `if(eq(on,0),${xStart},${xEnd}*(on/${totalFrames}))`;

      const zoompanFilter = `zoompan=z='${zoomFormula}':x='${xFormula}':y='(ih-ih/zoom)/2':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;

      ffmpeg(inputPath)
        .inputOptions(['-loop 1'])
        .outputOptions([
          `-vf ${zoompanFilter}`,
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
          '-pix_fmt yuv420p',
          `-t ${duration}`,
          '-movflags +faststart',
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
   * Creates a highlight page animation with Veo 3.1 Fast (with FFmpeg fallback)
   * @param illustration - The illustration to animate
   * @param prompt - The image generation prompt for context
   * @param estimatedDuration - Estimated duration from StoryGenerator in seconds
   * @param jobId - Job ID for storage path
   * @returns VideoClip with animation URL and duration
   */
  async animateHighlightPage(
    illustration: Illustration,
    prompt: string,
    estimatedDuration: number,
    jobId: string
  ): Promise<VideoClip> {
    try {
      // Attempt to generate with Veo 3.1 Fast with 60-second timeout
      const videoClip = await this.generateWithVeo(
        illustration,
        prompt,
        estimatedDuration,
        jobId
      );
      return videoClip;
    } catch (error) {
      console.warn(
        `Veo generation failed for page ${illustration.pageNumber}, falling back to Ken Burns effect:`,
        error
      );
      
      // Fallback to Ken Burns effect using FFmpeg with estimated duration
      return await this.animateStandardPage(illustration, estimatedDuration, jobId);
    }
  }

  /**
   * Generates video with Veo 3.1 Fast API
   * @throws Error if generation fails or times out
   */
  private async generateWithVeo(
    illustration: Illustration,
    prompt: string,
    estimatedDuration: number,
    jobId: string
  ): Promise<VideoClip> {
    const timeout = config.timeouts.veo * 1000; // Convert to milliseconds
    
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let isResolved = false;
    
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Veo generation timed out after ${config.timeouts.veo} seconds`));
        }
      }, timeout);
    });

    // Create Veo generation promise
    const veoPromise = this.callVeoAPI(
      illustration,
      prompt,
      estimatedDuration,
      jobId
    ).then(
      (result) => {
        if (!isResolved) {
          isResolved = true;
          if (timeoutId !== undefined) clearTimeout(timeoutId);
        }
        return result;
      },
      (error) => {
        if (!isResolved) {
          isResolved = true;
          if (timeoutId !== undefined) clearTimeout(timeoutId);
        }
        throw error;
      }
    );

    // Race between timeout and actual generation
    return await Promise.race([veoPromise, timeoutPromise]);
  }

  /**
   * Calls Veo 3.1 Fast API to generate video
   * @throws Error if API call fails
   */
  private async callVeoAPI(
    illustration: Illustration,
    prompt: string,
    estimatedDuration: number,
    jobId: string
  ): Promise<VideoClip> {
    // TODO: Implement actual Veo 3.1 Fast API integration
    // For MVP, this is a placeholder that will be implemented with the Vertex AI SDK
    
    // Placeholder implementation that simulates Veo API call
    // In production, this would use the Vertex AI Veo API
    throw new Error('Veo API integration not yet implemented');
    
    // Expected implementation structure:
    // 1. Download illustration from Cloud Storage
    // 2. Call Vertex AI Veo 3.1 Fast API with:
    //    - Input image
    //    - Animation prompt (derived from story prompt)
    //    - Duration parameter (estimatedDuration from StoryGenerator)
    // 3. Poll for completion or wait for callback
    // 4. Download generated video
    // 5. Upload to Cloud Storage
    // 6. Return VideoClip object
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
