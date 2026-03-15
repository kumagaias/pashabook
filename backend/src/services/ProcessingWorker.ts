import { Firestore } from '@google-cloud/firestore';
import { config } from '../config/gcp';
import { ImageAnalyzer } from './ImageAnalyzer';
import { StoryGenerator } from './StoryGenerator';
import { IllustrationGenerator } from './IllustrationGenerator';
import { NarrationGenerator } from './NarrationGenerator';
import { AnimationEngine } from './AnimationEngine';
import { VideoCompositor } from './VideoCompositor';
import { Job, Illustration, Language } from '../types/models';

export class ProcessingWorker {
  private firestore: Firestore;
  private imageAnalyzer: ImageAnalyzer;
  private storyGenerator: StoryGenerator;
  private illustrationGenerator: IllustrationGenerator;
  private narrationGenerator: NarrationGenerator;
  private animationEngine: AnimationEngine;
  private videoCompositor: VideoCompositor;

  constructor() {
    this.firestore = new Firestore({
      projectId: config.projectId,
    });
    this.imageAnalyzer = new ImageAnalyzer();
    this.storyGenerator = new StoryGenerator();
    this.illustrationGenerator = new IllustrationGenerator();
    this.narrationGenerator = new NarrationGenerator();
    this.animationEngine = new AnimationEngine();
    this.videoCompositor = new VideoCompositor();
  }

  /**
   * Processes a job through the complete generation pipeline
   * @param jobId - The job ID to process
   */
  async processJob(jobId: string): Promise<void> {
    try {
      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', 'analyzing', 0);

      // Get job data
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Stage 1: Image Analysis
      console.log(`[${jobId}] Starting image analysis`);
      const analysis = await this.retryWithBackoff(
        () => this.imageAnalyzer.analyze(job.uploadedImageUrl!, job.language),
        3
      );
      await this.updateJob(jobId, {
        analysis,
        currentStage: 'generating',
        progressPercentage: 20,
      });

      // Stage 2: Story Generation
      console.log(`[${jobId}] Starting story generation`);
      const story = await this.retryWithBackoff(
        () => this.storyGenerator.generate(analysis, job.language),
        3
      );
      
      // Extract estimated durations from story pages
      const estimatedDurations = story.pages.map(page => page.estimatedDuration);
      console.log(`[${jobId}] Estimated durations:`, estimatedDurations);
      
      await this.updateJob(jobId, {
        story,
        estimatedDurations,
        currentStage: 'generating',
        progressPercentage: 30,
      });

      // Stage 2.5: Illustration Generation (Imagen 3)
      console.log(`[${jobId}] Starting illustration generation`);
      const illustrations: Illustration[] = [];
      const totalPages = story.pages.length;
      
      for (let i = 0; i < totalPages; i++) {
        const page = story.pages[i];
        console.log(`[${jobId}] Generating illustration ${i + 1}/${totalPages}`);
        
        // Update progress with detail
        const progressPercent = 30 + Math.floor((i / totalPages) * 20);
        await this.updateJob(jobId, {
          currentStage: 'illustrating',
          progressPercentage: progressPercent,
          progressDetail: `${i + 1}/${totalPages}`,
        });
        
        // Generate single illustration
        const illustration = await this.retryWithBackoff(
          async () => {
            const result = await this.illustrationGenerator.generateAll(
              [page],
              analysis.style,
              analysis.characters,
              jobId
            );
            return result[0];
          },
          3
        );
        illustrations.push(illustration);
      }
      
      await this.updateJob(jobId, {
        illustrationUrls: illustrations.map(ill => ill.imageUrl),
        currentStage: 'narrating',
        progressPercentage: 50,
        progressDetail: null,
      });

      // Stage 3: Sequential execution of Narration and Animation with progress tracking
      console.log(`[${jobId}] Starting narration generation`);
      
      // Generate narrations with progress tracking (50-70%)
      const pageNarrations = await this.generateNarrations(
        story.pages,
        job.language,
        jobId,
        story.pages.length
      );
      
      console.log(`[${jobId}] Starting animation generation`);
      
      // Generate animations with progress tracking (70-90%)
      const animationClips = await this.generateAnimations(
        story.pages,
        illustrations,
        jobId
      );

      // Extract actual durations from narration results
      // CRITICAL: actualDurations must be available before VideoCompositor starts
      const actualDurations = pageNarrations.map((n: any) => n.actualDuration);
      console.log(`[${jobId}] Actual durations from TTS:`, actualDurations);
      console.log(`[${jobId}] Estimated durations:`, estimatedDurations);

      // Collect all audio segment URLs from all pages
      const allAudioUrls = pageNarrations.flatMap((n: any) => 
        n.audioSegments.map((segment: any) => segment.audioUrl)
      );

      await this.updateJob(jobId, {
        narrationAudioUrls: allAudioUrls,
        animationClipUrls: animationClips.map(c => c.videoUrl),
        actualDurations,
        currentStage: 'composing',
        progressPercentage: 90,
      });

      // Stage 5: Video Composition with progress tracking
      console.log(`[${jobId}] Starting video composition`);
      await this.updateJob(jobId, {
        currentStage: 'composing',
        progressPercentage: 90,
        progressDetail: 'Compositing video...',
      });
      
      const finalVideo = await this.retryWithBackoff(
        () => this.videoCompositor.compose(
          animationClips, 
          pageNarrations, 
          analysis.emotionalTone, 
          jobId,
          job.userId,
          job.language
        ),
        2
      );

      // Update job to done
      await this.updateJob(jobId, {
        finalVideoUrl: finalVideo.videoUrl,
        status: 'done',
        currentStage: undefined,
        progressPercentage: 100,
        progressDetail: null,
      });

      console.log(`[${jobId}] Processing completed successfully`);
    } catch (error) {
      console.error(`[${jobId}] Processing failed:`, error);
      
      // Sanitize error message for users
      const userMessage = this.sanitizeErrorMessage(error);
      
      // Log detailed error to Cloud Logging
      console.error(`[${jobId}] Detailed error:`, {
        error: error instanceof Error ? error.stack : error,
        jobId,
      });

      // Update job to error state
      await this.updateJobStatus(jobId, 'error', undefined, undefined, userMessage);
    }
  }

  /**
   * Generates animations for all pages using estimated durations
   * This enables parallel execution with NarrationGenerator
   */
  /**
     * Generates narrations for all pages with progress tracking
     * Updates progress from 50% to 70% as pages are narrated
     */
    /**
       * Generates narrations for all pages with progress tracking
       * Updates progress from 50% to 70% as pages are narrated
       */
      private async generateNarrations(
        pages: any[],
        language: Language,
        jobId: string,
        totalPages: number
      ): Promise<any[]> {
        const narrations = [];

        for (let i = 0; i < totalPages; i++) {
          const page = pages[i];

          // Update progress with detail
          const progressPercent = 50 + Math.floor((i / totalPages) * 20);
          await this.updateJob(jobId, {
            currentStage: 'narrating',
            progressPercentage: progressPercent,
            progressDetail: `${i + 1}/${totalPages}`,
          });

          // Generate narration for this page
          const segments = page.narrationSegments && page.narrationSegments.length > 0
            ? page.narrationSegments
            : [{ text: page.narrationText, speaker: 'narrator' }];

          const characterVoiceMap = await this.getCharacterVoiceMap(jobId);

          const narration = await this.retryWithBackoff(
            () => this.narrationGenerator.generatePerPage(
              segments,
              language,
              page.pageNumber,
              jobId,
              characterVoiceMap
            ),
            3
          );

          narrations.push(narration);
        }

        return narrations;
      }

    /**
     * Retrieves the character voice map from Firestore
     */
    private async getCharacterVoiceMap(jobId: string): Promise<any> {
      try {
        const jobDoc = await this.firestore.collection('jobs').doc(jobId).get();
        if (!jobDoc.exists) {
          return {};
        }
        const jobData = jobDoc.data();
        return jobData?.characterVoiceMap || {};
      } catch (error) {
        console.error(`Failed to retrieve character voice map for job ${jobId}:`, error);
        return {};
      }
    }

    /**
     * Generates animations for all pages with progress tracking
     * Updates progress from 70% to 90% as animations are created
     */
    private async generateAnimations(
      pages: any[],
      illustrations: any[],
      jobId: string
    ): Promise<any[]> {
      const animations = [];
      const totalPages = pages.length;

      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const illustration = illustrations[i];

        // Update progress with detail
        const progressPercent = 70 + Math.floor((i / totalPages) * 20);
        await this.updateJob(jobId, {
          currentStage: 'animating',
          progressPercentage: progressPercent,
          progressDetail: `${i + 1}/${totalPages}`,
        });

        if (page.animationMode === 'highlight') {
          const animation = await this.retryWithBackoff(
            () =>
              this.animationEngine.animateHighlightPage(
                illustration,
                page.imagePrompt,
                page.estimatedDuration,
                jobId
              ),
            2
          );
          animations.push(animation);
        } else {
          const animation = await this.retryWithBackoff(
            () =>
              this.animationEngine.animateStandardPage(
                illustration,
                page.estimatedDuration,
                jobId
              ),
            2
          );
          animations.push(animation);
        }
      }

      return animations;
    }

  /**
   * Retries a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Sanitizes error messages for user display
   */
  private sanitizeErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    
    // Remove sensitive information
    const sanitized = message
      .replace(/\/[^\s]+/g, '') // Remove file paths
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '') // Remove IP addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // Remove emails
      .replace(/Bearer\s+[^\s]+/gi, '') // Remove tokens
      .trim();

    // Return generic message if sanitization removed everything
    if (!sanitized || sanitized.length < 10) {
      return 'An error occurred during processing. Please try again.';
    }

    return sanitized;
  }

  /**
   * Gets a job from Firestore
   */
  private async getJob(jobId: string): Promise<Job | null> {
    const doc = await this.firestore.collection('jobs').doc(jobId).get();
    if (!doc.exists) {
      return null;
    }
    return { jobId, ...doc.data() } as Job;
  }

  /**
   * Updates job status
   */
  /**
     * Updates job status
     */
    private async updateJobStatus(
      jobId: string,
      status: string,
      currentStage?: string,
      progressPercentage?: number,
      error?: string,
      progressDetail?: string
    ): Promise<void> {
      const updates: any = {
        status,
        updatedAt: new Date(),
      };

      if (currentStage !== undefined) {
        updates.currentStage = currentStage;
      }
      if (progressPercentage !== undefined) {
        updates.progressPercentage = progressPercentage;
      }
      if (error !== undefined) {
        updates.error = error;
      }
      if (progressDetail !== undefined) {
        updates.progressDetail = progressDetail;
      } else {
        // Clear progressDetail when not provided
        updates.progressDetail = null;
      }

      await this.firestore.collection('jobs').doc(jobId).update(updates);
    }

  /**
   * Updates job with partial data
   */
  private async updateJob(jobId: string, data: any): Promise<void> {
    await this.firestore.collection('jobs').doc(jobId).update({
      ...data,
      updatedAt: new Date(),
    });
  }
}
