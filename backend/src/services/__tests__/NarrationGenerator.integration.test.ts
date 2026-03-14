import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NarrationGenerator } from '../NarrationGenerator';
import { NarrationSegment, Language, CharacterVoiceMap } from '../../types/models';

/**
 * Integration tests for Task 31.3: Generate separate audio files per character
 * 
 * Requirements tested:
 * - 8.2: Identify speaking characters from JSON structured narration segments
 * - 8.6: Generate separate audio files for each character's dialogue segments
 * - 8.7: Generate narrator audio file for non-dialogue narration
 * - 8.12: Calculate actual duration per page by summing all character audio segment durations
 * 
 * Property 70: Character Voice Separation
 */
describe('NarrationGenerator - Task 31.3 Integration Tests', () => {
  let narrationGenerator: NarrationGenerator;
  const mockJobId = 'test-job-123';
  let mockBucket: any;

  beforeEach(() => {
    narrationGenerator = new NarrationGenerator();
    
    // Mock Firestore operations
    vi.spyOn(narrationGenerator as any, 'getCharacterVoiceMap').mockResolvedValue({});
    vi.spyOn(narrationGenerator as any, 'updateCharacterVoiceMap').mockResolvedValue(undefined);
    
    // Mock Firestore update for actualDurations
    const mockFirestore = (narrationGenerator as any).firestore;
    vi.spyOn(mockFirestore.collection('jobs').doc(mockJobId), 'update').mockResolvedValue(undefined);
    
    // Mock Cloud Storage bucket
    const mockStorage = (narrationGenerator as any).storage;
    mockBucket = {
      file: vi.fn().mockReturnValue({
        save: vi.fn().mockResolvedValue(undefined),
      }),
    };
    vi.spyOn(mockStorage, 'bucket').mockReturnValue(mockBucket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 8.2: Parse NarrationSegment[] for each page', () => {
    it('should parse multiple narration segments with different speakers', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'Once upon a time, there was a brave little bear.', speaker: 'narrator' },
        { text: 'I want to explore the forest!', speaker: 'protagonist' },
        { text: 'Be careful out there.', speaker: 'supporting_character' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
        protagonist: { voiceName: 'ja-JP-Wavenet-B', pitch: 2.0, speakingRate: 0.95 },
        supporting_character: { voiceName: 'ja-JP-Wavenet-C', pitch: 0.0, speakingRate: 0.95 },
      };

      // Mock TTS client
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);

      const result = await narrationGenerator.generatePerPage(
        narrationSegments,
        'ja' as Language,
        1,
        mockJobId,
        characterVoiceMap
      );

      // Verify all segments were parsed and processed
      expect(result.audioSegments).toHaveLength(3);
      expect(result.audioSegments[0].speaker).toBe('narrator');
      expect(result.audioSegments[1].speaker).toBe('protagonist');
      expect(result.audioSegments[2].speaker).toBe('supporting_character');
    });

    it('should handle single narrator segment', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'The end.', speaker: 'narrator' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
      };

      // Mock TTS
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);

      const result = await narrationGenerator.generatePerPage(
        narrationSegments,
        'ja' as Language,
        1,
        mockJobId,
        characterVoiceMap
      );

      expect(result.audioSegments).toHaveLength(1);
      expect(result.audioSegments[0].speaker).toBe('narrator');
    });
  });

  describe('Requirement 8.6 & 8.7: Generate separate audio files per character', () => {
    it('should generate separate audio file for each segment', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'Narrator text', speaker: 'narrator' },
        { text: 'Protagonist dialogue', speaker: 'protagonist' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
        protagonist: { voiceName: 'ja-JP-Wavenet-B', pitch: 2.0, speakingRate: 0.95 },
      };

      // Mock TTS client
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      const synthesizeSpeechSpy = vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);

      await narrationGenerator.generatePerPage(
        narrationSegments,
        'ja' as Language,
        1,
        mockJobId,
        characterVoiceMap
      );

      // Verify TTS was called for each segment
      expect(synthesizeSpeechSpy).toHaveBeenCalledTimes(2);

      // Verify separate files were created
      expect(mockBucket.file).toHaveBeenCalledTimes(2);
      expect(mockBucket.file).toHaveBeenNthCalledWith(1, `jobs/${mockJobId}/narration/page-1-narrator-0.mp3`);
      expect(mockBucket.file).toHaveBeenNthCalledWith(2, `jobs/${mockJobId}/narration/page-1-protagonist-1.mp3`);
    });

    it('should use character-specific voice configuration for each segment', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'Narrator text', speaker: 'narrator' },
        { text: 'Protagonist dialogue', speaker: 'protagonist' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
        protagonist: { voiceName: 'ja-JP-Wavenet-B', pitch: 2.0, speakingRate: 0.95 },
      };

      // Mock TTS client
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      const synthesizeSpeechSpy = vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);

      await narrationGenerator.generatePerPage(
        narrationSegments,
        'ja' as Language,
        1,
        mockJobId,
        characterVoiceMap
      );

      // Verify narrator voice was used for first segment
      expect(synthesizeSpeechSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
        voice: expect.objectContaining({
          name: 'ja-JP-Wavenet-A',
        }),
        audioConfig: expect.objectContaining({
          pitch: -2.0,
          speakingRate: 0.95,
        }),
      }));

      // Verify protagonist voice was used for second segment
      expect(synthesizeSpeechSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
        voice: expect.objectContaining({
          name: 'ja-JP-Wavenet-B',
        }),
        audioConfig: expect.objectContaining({
          pitch: 2.0,
          speakingRate: 0.95,
        }),
      }));
    });
  });

  describe('Requirement 8.12: Calculate total duration per page', () => {
    it('should calculate total duration as sum of all segment durations', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'これは最初のセグメントです。', speaker: 'narrator' },
        { text: 'これは二番目のセグメントです。', speaker: 'protagonist' },
        { text: 'これは三番目のセグメントです。', speaker: 'supporting_character' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
        protagonist: { voiceName: 'ja-JP-Wavenet-B', pitch: 2.0, speakingRate: 0.95 },
        supporting_character: { voiceName: 'ja-JP-Wavenet-C', pitch: 0.0, speakingRate: 0.95 },
      };

      // Mock TTS
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);

      const result = await narrationGenerator.generatePerPage(
        narrationSegments,
        'ja' as Language,
        1,
        mockJobId,
        characterVoiceMap
      );

      // Verify total duration is sum of all segments
      const calculatedTotal = result.audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
      expect(result.duration).toBe(calculatedTotal);
      expect(result.actualDuration).toBe(calculatedTotal);
      
      // Verify duration is positive
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should set startTime correctly for sequential segments', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'First segment', speaker: 'narrator' },
        { text: 'Second segment', speaker: 'protagonist' },
        { text: 'Third segment', speaker: 'narrator' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'en-US-Wavenet-F', pitch: -2.0, speakingRate: 0.95 },
        protagonist: { voiceName: 'en-US-Wavenet-G', pitch: 2.0, speakingRate: 0.95 },
      };

      // Mock TTS
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);

      const result = await narrationGenerator.generatePerPage(
        narrationSegments,
        'en' as Language,
        1,
        mockJobId,
        characterVoiceMap
      );

      // Verify startTime progression
      expect(result.audioSegments[0].startTime).toBe(0);
      expect(result.audioSegments[1].startTime).toBe(result.audioSegments[0].duration);
      expect(result.audioSegments[2].startTime).toBe(
        result.audioSegments[0].duration + result.audioSegments[1].duration
      );
    });
  });

  describe('Storage: Multiple audio files per page', () => {
    it('should store each audio segment with unique filename', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'Narrator text', speaker: 'narrator' },
        { text: 'Protagonist dialogue', speaker: 'protagonist' },
        { text: 'More narrator text', speaker: 'narrator' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
        protagonist: { voiceName: 'ja-JP-Wavenet-B', pitch: 2.0, speakingRate: 0.95 },
      };

      // Mock TTS
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);

      await narrationGenerator.generatePerPage(
        narrationSegments,
        'ja' as Language,
        2,
        mockJobId,
        characterVoiceMap
      );

      // Verify unique filenames for each segment
      expect(mockBucket.file).toHaveBeenCalledWith(`jobs/${mockJobId}/narration/page-2-narrator-0.mp3`);
      expect(mockBucket.file).toHaveBeenCalledWith(`jobs/${mockJobId}/narration/page-2-protagonist-1.mp3`);
      expect(mockBucket.file).toHaveBeenCalledWith(`jobs/${mockJobId}/narration/page-2-narrator-2.mp3`);
    });

    it('should return array of AudioSegment with all required fields', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'Test text', speaker: 'narrator' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
      };

      // Mock TTS
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);

      const result = await narrationGenerator.generatePerPage(
        narrationSegments,
        'ja' as Language,
        1,
        mockJobId,
        characterVoiceMap
      );

      // Verify AudioSegment structure
      expect(result.audioSegments[0]).toHaveProperty('audioUrl');
      expect(result.audioSegments[0]).toHaveProperty('speaker');
      expect(result.audioSegments[0]).toHaveProperty('duration');
      expect(result.audioSegments[0]).toHaveProperty('startTime');
      
      expect(result.audioSegments[0].audioUrl).toMatch(/^gs:\/\//);
      expect(result.audioSegments[0].speaker).toBe('narrator');
      expect(typeof result.audioSegments[0].duration).toBe('number');
      expect(typeof result.audioSegments[0].startTime).toBe('number');
    });
  });

  describe('Error handling', () => {
    it('should throw error if character voice not found in map', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'Test text', speaker: 'unknown_character' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
      };

      await expect(
        narrationGenerator.generatePerPage(
          narrationSegments,
          'ja' as Language,
          1,
          mockJobId,
          characterVoiceMap
        )
      ).rejects.toThrow('No voice configuration found for character: unknown_character');
    });

    it('should throw error if TTS returns no audio content', async () => {
      const narrationSegments: NarrationSegment[] = [
        { text: 'Test text', speaker: 'narrator' },
      ];

      const characterVoiceMap: CharacterVoiceMap = {
        narrator: { voiceName: 'ja-JP-Wavenet-A', pitch: -2.0, speakingRate: 0.95 },
      };

      // Mock TTS to return empty response
      const mockTtsClient = (narrationGenerator as any).ttsClient;
      vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([{}]);

      await expect(
        narrationGenerator.generatePerPage(
          narrationSegments,
          'ja' as Language,
          1,
          mockJobId,
          characterVoiceMap
        )
      ).rejects.toThrow('No audio content received for segment 0 on page 1');
    });
  });
});
