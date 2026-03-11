import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { config } from '../config/gcp';
import { StoryPage, PageNarration, Language } from '../types/models';
import { v4 as uuidv4 } from 'uuid';

export class NarrationGenerator {
  private ttsClient: TextToSpeechClient;
  private storage: Storage;
  private bucket: string;

  constructor() {
    this.ttsClient = new TextToSpeechClient();
    this.storage = new Storage({
      projectId: config.projectId,
    });
    this.bucket = config.storageBucket;
  }

  /**
   * Generates narration audio for a single page
   * @param pageText - The narration text for the page
   * @param language - Language for narration ('ja' or 'en')
   * @param pageNumber - Page number for file naming
   * @param jobId - Job ID for storage path
   * @returns PageNarration with audio URL and duration
   */
  async generatePerPage(
    pageText: string,
    language: Language,
    pageNumber: number,
    jobId: string
  ): Promise<PageNarration> {
    try {
      // Select voice based on language
      const voice = language === 'ja' ? config.tts.japaneseVoice : config.tts.englishVoice;

      // Create TTS request
      const request = {
        input: { text: pageText },
        voice: {
          languageCode: voice.languageCode,
          name: voice.name,
          ssmlGender: voice.ssmlGender,
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: 0.95, // Slightly slower for children
          pitch: 0.0,
          effectsProfileId: ['small-bluetooth-speaker-class-device'], // Warm tone
        },
      };

      // Generate audio
      const [response] = await this.ttsClient.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content received from TTS service');
      }

      // Calculate duration (approximate based on text length and speaking rate)
      // Average speaking rate: ~150 words per minute at 1.0x speed
      // At 0.95x speed: ~142.5 words per minute
      const isJapanese = language === 'ja';
      const wordCount = isJapanese
        ? pageText.replace(/\s+/g, '').length // Japanese: count characters
        : pageText.trim().split(/\s+/).length; // English: count words

      const wordsPerMinute = 142.5;
      const duration = Math.ceil((wordCount / wordsPerMinute) * 60 * 10) / 10; // Round to 1 decimal

      // Upload to Cloud Storage
      const fileName = `jobs/${jobId}/narration/page-${pageNumber}.mp3`;
      const file = this.storage.bucket(this.bucket).file(fileName);

      await file.save(response.audioContent as Buffer, {
        metadata: {
          contentType: 'audio/mpeg',
          metadata: {
            jobId,
            pageNumber: pageNumber.toString(),
            language,
          },
        },
      });

      // Make file publicly accessible (with signed URL for security)
      const audioUrl = `gs://${this.bucket}/${fileName}`;

      return {
        pageNumber,
        audioUrl,
        duration,
        language,
      };
    } catch (error) {
      console.error(`Failed to generate narration for page ${pageNumber}:`, error);
      throw new Error(
        `Failed to generate narration for page ${pageNumber}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Generates narration audio for all pages in parallel
   * @param pages - Array of story pages
   * @param language - Language for narration ('ja' or 'en')
   * @param jobId - Job ID for storage path
   * @returns Array of PageNarration objects with audio URLs and durations
   */
  async generateAll(
    pages: StoryPage[],
    language: Language,
    jobId: string
  ): Promise<PageNarration[]> {
    const startTime = Date.now();

    try {
      // Generate all narrations in parallel
      const narrationPromises = pages.map((page) =>
        this.generatePerPage(page.narrationText, language, page.pageNumber, jobId)
      );

      const narrations = await Promise.all(narrationPromises);

      // Validate completion time
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (elapsedTime > config.timeouts.narration) {
        console.warn(
          `Narration generation took ${elapsedTime}s, exceeding ${config.timeouts.narration}s limit`
        );
      }

      // Sort by page number to ensure correct order
      narrations.sort((a, b) => a.pageNumber - b.pageNumber);

      return narrations;
    } catch (error) {
      const elapsedTime = (Date.now() - startTime) / 1000;
      console.error(`Narration generation failed after ${elapsedTime}s:`, error);
      throw new Error(
        `Failed to generate narrations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
