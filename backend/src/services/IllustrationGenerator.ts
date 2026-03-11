import { Storage } from '@google-cloud/storage';
import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config/gcp';
import { StoryPage, Illustration } from '../types/models';

export class IllustrationGenerator {
  private vertexAI: VertexAI;
  private storage: Storage;
  private bucket: string;

  constructor() {
    this.vertexAI = new VertexAI({
      project: config.projectId,
      location: config.vertexAI.location,
    });
    
    this.storage = new Storage({
      projectId: config.projectId,
    });
    this.bucket = config.storageBucket;
  }

  /**
   * Generates illustrations for all story pages in parallel using Imagen 3
   * @param pages - Array of story pages with image prompts
   * @param style - Style description from image analysis
   * @param characters - Character descriptions from image analysis
   * @param jobId - Job ID for storage path
   * @returns Array of Illustration objects with image URLs
   */
  async generateAll(
    pages: StoryPage[],
    style: string,
    characters: Array<{ name: string; description: string }>,
    jobId: string
  ): Promise<Illustration[]> {
    const startTime = Date.now();

    try {
      // Generate illustrations sequentially to avoid rate limits
      const illustrations: Illustration[] = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // Add delay before each request (including first one) to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        const illustration = await this.generateSingleIllustrationWithRetry(page, style, characters, jobId);
        illustrations.push(illustration);
      }

      // Validate completion time
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (elapsedTime > config.timeouts.illustration) {
        console.warn(
          `Illustration generation took ${elapsedTime}s, exceeding ${config.timeouts.illustration}s limit`
        );
      }

      // Sort by page number to ensure correct order
      illustrations.sort((a, b) => a.pageNumber - b.pageNumber);

      return illustrations;
    } catch (error) {
      const elapsedTime = (Date.now() - startTime) / 1000;
      console.error(`Illustration generation failed after ${elapsedTime}s:`, error);
      throw new Error(
        `Failed to generate illustrations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates a single illustration with retry logic for rate limiting
   */
  private async generateSingleIllustrationWithRetry(
    page: StoryPage,
    style: string,
    characters: Array<{ name: string; description: string }>,
    jobId: string
  ): Promise<Illustration> {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generateSingleIllustration(page, style, characters, jobId);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if it's a 429 error
        if (lastError.message.includes('429')) {
          const delay = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s
          console.log(`Rate limited on page ${page.pageNumber}, retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-rate-limit error, don't retry
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  /**
   * Generates a single illustration for a page using Vertex AI SDK
   */
  private async generateSingleIllustration(
    page: StoryPage,
    style: string,
    characters: Array<{ name: string; description: string }>,
    jobId: string
  ): Promise<Illustration> {
    try {
      // Build enhanced prompt with style and character descriptions
      const enhancedPrompt = this.buildEnhancedPrompt(page.imagePrompt, style, characters);

      // Get Imagen model from Vertex AI
      const model = this.vertexAI.preview.getGenerativeModel({
        model: config.vertexAI.imagenModel,
      });

      // Generate image using Vertex AI SDK
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: enhancedPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          candidateCount: 1,
        },
      });

      const response = result.response;
      
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No image generated from Imagen API');
      }

      const candidate = response.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('No image data in Imagen API response');
      }

      // Get the inline data (base64-encoded image)
      const part = candidate.content.parts[0];
      if (!part.inlineData || !part.inlineData.data) {
        throw new Error('No inline data in Imagen API response');
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
      
      // Upload to Cloud Storage
      const fileName = `jobs/${jobId}/illustrations/page-${page.pageNumber}.jpg`;
      const file = this.storage.bucket(this.bucket).file(fileName);

      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            jobId,
            pageNumber: page.pageNumber.toString(),
          },
        },
      });

      const imageUrl = `gs://${this.bucket}/${fileName}`;

      return {
        pageNumber: page.pageNumber,
        imageUrl,
        width: 1280,
        height: 720,
      };
    } catch (error) {
      console.error(`Failed to generate illustration for page ${page.pageNumber}:`, error);
      throw new Error(
        `Failed to generate illustration for page ${page.pageNumber}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Builds an enhanced prompt incorporating style and character descriptions
   */
  private buildEnhancedPrompt(
    basePrompt: string,
    style: string,
    characters: Array<{ name: string; description: string }>
  ): string {
    // Build character descriptions section
    const characterDescriptions = characters
      .map((char) => `${char.name}: ${char.description}`)
      .join('. ');

    // Combine all elements into a comprehensive prompt
    const enhancedPrompt = `${basePrompt}

Style: ${style}

Characters: ${characterDescriptions}

Create a children's storybook illustration in the specified style with consistent character appearances. The image should be colorful, engaging, and appropriate for children aged 3-8 years. Resolution: 1280x720 pixels.`;

    return enhancedPrompt;
  }
}
