import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import { config } from '../config/gcp';
import { StoryPage, PageNarration, Language, CharacterVoiceMap, VoiceConfig } from '../types/models';

export class NarrationGenerator {
  private ttsClient: TextToSpeechClient;
  private storage: Storage;
  private firestore: Firestore;
  private bucket: string;

  constructor() {
    this.ttsClient = new TextToSpeechClient();
    this.storage = new Storage({
      projectId: config.projectId,
    });
    this.firestore = new Firestore({
      projectId: config.projectId,
    });
    this.bucket = config.storageBucket;
  }

  /**
   * Assigns a TTS voice to a character based on language and character type
   * @param characterName - Name of the character (e.g., 'narrator', 'protagonist', 'supporting_character')
   * @param language - Language for narration ('ja' or 'en')
   * @param existingMap - Existing character voice map to check for assignments
   * @returns VoiceConfig with voice name, pitch, and speaking rate
   */
  private assignVoiceToCharacter(
    characterName: string,
    language: Language,
    existingMap: CharacterVoiceMap
  ): VoiceConfig {
    // Check if character already has a voice assigned
    if (existingMap[characterName]) {
      return existingMap[characterName];
    }

    // Define available voices per language
    const japaneseVoices = [
      'ja-JP-Wavenet-A', // Female, warm
      'ja-JP-Wavenet-B', // Male, gentle
      'ja-JP-Wavenet-C', // Male, friendly
      'ja-JP-Wavenet-D', // Male, calm
      'ja-JP-Neural2-B', // Female, natural
      'ja-JP-Neural2-C', // Female, bright
    ];

    const englishVoices = [
      'en-US-Wavenet-F', // Female, warm
      'en-US-Wavenet-G', // Female, friendly
      'en-US-Wavenet-H', // Female, gentle
      'en-US-Wavenet-I', // Male, calm
      'en-US-Neural2-F', // Female, natural
      'en-US-Neural2-J', // Male, friendly
    ];

    const availableVoices = language === 'ja' ? japaneseVoices : englishVoices;

    // Get already assigned voices to avoid duplicates
    const assignedVoices = new Set(
      Object.values(existingMap).map(config => config.voiceName)
    );

    // Find first available voice not yet assigned
    let selectedVoice = availableVoices.find(voice => !assignedVoices.has(voice));
    
    // If all voices are assigned, reuse voices (shouldn't happen with 6 voices)
    if (!selectedVoice) {
      selectedVoice = availableVoices[Object.keys(existingMap).length % availableVoices.length];
    }

    // Assign voice configuration based on character type
    const voiceConfig: VoiceConfig = {
      voiceName: selectedVoice,
      pitch: 0.0, // Neutral pitch
      speakingRate: 0.95, // Slightly slower for children
    };

    // Adjust pitch slightly for variety
    if (characterName === 'narrator') {
      voiceConfig.pitch = -2.0; // Slightly lower for narrator
    } else if (characterName === 'protagonist') {
      voiceConfig.pitch = 2.0; // Slightly higher for protagonist
    } else {
      voiceConfig.pitch = 0.0; // Neutral for supporting characters
    }

    return voiceConfig;
  }

  /**
   * Updates the Job record in Firestore with the character voice map
   * @param jobId - Job ID
   * @param characterVoiceMap - Character-to-voice mapping
   */
  private async updateCharacterVoiceMap(
    jobId: string,
    characterVoiceMap: CharacterVoiceMap
  ): Promise<void> {
    try {
      await this.firestore.collection('jobs').doc(jobId).update({
        characterVoiceMap,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error(`Failed to update character voice map for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves the character voice map from the Job record
   * @param jobId - Job ID
   * @returns CharacterVoiceMap or empty object if not found
   */
  private async getCharacterVoiceMap(jobId: string): Promise<CharacterVoiceMap> {
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
   * Generates narration audio for a single page with character-specific voices
   * @param narrationSegments - Array of narration segments with text and speaker
   * @param language - Language for narration ('ja' or 'en')
   * @param pageNumber - Page number for file naming
   * @param jobId - Job ID for storage path
   * @param characterVoiceMap - Character-to-voice mapping for consistent voices
   * @returns PageNarration with audio segments and total duration
   */
  async generatePerPage(
    narrationSegments: { text: string; speaker: string }[],
    language: Language,
    pageNumber: number,
    jobId: string,
    characterVoiceMap: CharacterVoiceMap
  ): Promise<PageNarration> {
    try {
      const audioSegments: import('../types/models').AudioSegment[] = [];
      let currentStartTime = 0;

      // Generate audio for each narration segment
      for (let segmentIndex = 0; segmentIndex < narrationSegments.length; segmentIndex++) {
        const segment = narrationSegments[segmentIndex];
        const { text, speaker } = segment;

        // Get voice configuration for this character
        const voiceConfig = characterVoiceMap[speaker];
        if (!voiceConfig) {
          throw new Error(`No voice configuration found for character: ${speaker}`);
        }

        // Create TTS request with character-specific voice
        const request = {
          input: { text },
          voice: {
            languageCode: language === 'ja' ? 'ja-JP' : 'en-US',
            name: voiceConfig.voiceName,
            ssmlGender: 'NEUTRAL' as const,
          },
          audioConfig: {
            audioEncoding: 'MP3' as const,
            speakingRate: voiceConfig.speakingRate,
            pitch: voiceConfig.pitch,
            effectsProfileId: ['small-bluetooth-speaker-class-device'], // Warm tone
          },
        };

        // Generate audio
        const [response] = await this.ttsClient.synthesizeSpeech(request);

        if (!response.audioContent) {
          throw new Error(`No audio content received for segment ${segmentIndex} on page ${pageNumber}`);
        }

        // Calculate duration (approximate based on text length and speaking rate)
        const isJapanese = language === 'ja';
        const wordCount = isJapanese
          ? text.replace(/\s+/g, '').length // Japanese: count characters
          : text.trim().split(/\s+/).length; // English: count words

        // Base words per minute at 1.0x speed: 150 for English, 250 characters/min for Japanese
        const baseRate = isJapanese ? 250 : 150;
        const adjustedRate = baseRate * voiceConfig.speakingRate;
        const duration = Math.ceil((wordCount / adjustedRate) * 60 * 10) / 10; // Round to 1 decimal

        // Upload to Cloud Storage with segment-specific filename
        const fileName = `jobs/${jobId}/narration/page-${pageNumber}-${speaker}-${segmentIndex}.mp3`;
        const file = this.storage.bucket(this.bucket).file(fileName);

        await file.save(response.audioContent as Buffer, {
          metadata: {
            contentType: 'audio/mpeg',
            metadata: {
              jobId,
              pageNumber: pageNumber.toString(),
              speaker,
              segmentIndex: segmentIndex.toString(),
              language,
            },
          },
        });

        const audioUrl = `gs://${this.bucket}/${fileName}`;

        // Add audio segment to array
        audioSegments.push({
          audioUrl,
          speaker: speaker as 'narrator' | 'protagonist' | 'supporting_character',
          duration,
          startTime: currentStartTime,
        });

        // Update start time for next segment
        currentStartTime += duration;
      }

      // Calculate total duration (sum of all segments)
      const totalDuration = audioSegments.reduce((sum, segment) => sum + segment.duration, 0);

      console.log(
        `[${jobId}] Generated ${audioSegments.length} audio segments for page ${pageNumber}, total duration: ${totalDuration}s`
      );

      return {
        pageNumber,
        audioSegments,
        duration: totalDuration,
        actualDuration: totalDuration, // Actual duration from TTS for VideoCompositor
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
   * Generates narration audio for all pages in parallel with character voice consistency
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
      // Retrieve existing character voice map from Firestore
      let characterVoiceMap = await this.getCharacterVoiceMap(jobId);
      console.log(`[${jobId}] Retrieved character voice map:`, characterVoiceMap);

      // Process pages sequentially to build character voice map
      const narrations: PageNarration[] = [];

      for (const page of pages) {
        // For each page, identify characters from narrationSegments
        const charactersInPage = new Set<string>();
        
        if (page.narrationSegments && page.narrationSegments.length > 0) {
          page.narrationSegments.forEach(segment => {
            charactersInPage.add(segment.speaker);
          });
        } else {
          // Fallback: if no segments, treat as narrator
          charactersInPage.add('narrator');
        }

        // Assign voices to new characters
        let mapUpdated = false;
        charactersInPage.forEach(character => {
          if (!characterVoiceMap[character]) {
            characterVoiceMap[character] = this.assignVoiceToCharacter(
              character,
              language,
              characterVoiceMap
            );
            mapUpdated = true;
            console.log(`[${jobId}] Assigned voice to ${character}:`, characterVoiceMap[character]);
          }
        });

        // Update Firestore with new mappings (especially after page 1)
        if (mapUpdated) {
          await this.updateCharacterVoiceMap(jobId, characterVoiceMap);
          console.log(`[${jobId}] Updated character voice map in Firestore`);
        }

        // Generate narration for this page using the character voice map
        // Use narrationSegments if available, otherwise fallback to narrationText
        const segments = page.narrationSegments && page.narrationSegments.length > 0
          ? page.narrationSegments
          : [{ text: page.narrationText, speaker: 'narrator' }];
        
        const narration = await this.generatePerPage(
          segments,
          language,
          page.pageNumber,
          jobId,
          characterVoiceMap
        );
        narrations.push(narration);
      }

      // Validate completion time
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (elapsedTime > config.timeouts.narration) {
        console.warn(
          `Narration generation took ${elapsedTime}s, exceeding ${config.timeouts.narration}s limit`
        );
      }

      // Sort by page number to ensure correct order
      narrations.sort((a, b) => a.pageNumber - b.pageNumber);

      // Collect actual durations for Job record update
      const actualDurations = narrations.map(n => n.actualDuration);

      // Update Job record with actual durations
      try {
        await this.firestore.collection('jobs').doc(jobId).update({
          actualDurations,
          updatedAt: new Date(),
        });
        console.log(`[${jobId}] Updated Job record with actualDurations:`, actualDurations);
      } catch (error) {
        console.error(`Failed to update Job record with actualDurations for job ${jobId}:`, error);
        throw error;
      }

      console.log(`[${jobId}] Generated ${narrations.length} narrations with character voice consistency`);
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
