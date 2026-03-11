import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NarrationGenerator } from './NarrationGenerator';
import { StoryPage, Language } from '../types/models';

// Mock the Google Cloud clients
vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: vi.fn(() => ({
    synthesizeSpeech: vi.fn(),
  })),
}));

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn(),
      })),
    })),
  })),
}));

describe('NarrationGenerator', () => {
  let generator: NarrationGenerator;
  let mockTtsClient: any;
  let mockStorage: any;
  let mockFile: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock file
    mockFile = {
      save: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock storage
    mockStorage = {
      bucket: vi.fn(() => ({
        file: vi.fn(() => mockFile),
      })),
    };

    // Create mock TTS client
    mockTtsClient = {
      synthesizeSpeech: vi.fn(),
    };

    // Mock the constructors
    const { TextToSpeechClient } = await import('@google-cloud/text-to-speech');
    const { Storage } = await import('@google-cloud/storage');
    
    vi.mocked(TextToSpeechClient).mockImplementation(() => mockTtsClient);
    vi.mocked(Storage).mockImplementation(() => mockStorage);

    generator = new NarrationGenerator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generatePerPage', () => {
    it('should generate narration for a Japanese page', async () => {
      const pageText = 'これは日本語のテストです。子供向けの物語を作ります。';
      const language: Language = 'ja';
      const pageNumber = 1;
      const jobId = 'test-job-123';

      // Mock TTS response
      const mockAudioContent = Buffer.from('mock-audio-data');
      mockTtsClient.synthesizeSpeech.mockResolvedValue([
        { audioContent: mockAudioContent },
      ]);

      const result = await generator.generatePerPage(pageText, language, pageNumber, jobId);

      // Verify TTS was called with Japanese voice
      expect(mockTtsClient.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { text: pageText },
          voice: expect.objectContaining({
            languageCode: 'ja-JP',
            name: 'ja-JP-Neural2-B',
            ssmlGender: 'FEMALE',
          }),
          audioConfig: expect.objectContaining({
            audioEncoding: 'MP3',
            speakingRate: 0.95,
          }),
        })
      );

      // Verify file was saved
      expect(mockFile.save).toHaveBeenCalledWith(
        mockAudioContent,
        expect.objectContaining({
          metadata: expect.objectContaining({
            contentType: 'audio/mpeg',
          }),
        })
      );

      // Verify result structure
      expect(result).toEqual({
        pageNumber,
        audioUrl: expect.stringContaining(`jobs/${jobId}/narration/page-${pageNumber}.mp3`),
        duration: expect.any(Number),
        language,
      });

      expect(result.duration).toBeGreaterThan(0);
    });

    it('should generate narration for an English page', async () => {
      const pageText = 'This is a test story for children. It has about twenty words in total.';
      const language: Language = 'en';
      const pageNumber = 2;
      const jobId = 'test-job-456';

      // Mock TTS response
      const mockAudioContent = Buffer.from('mock-audio-data');
      mockTtsClient.synthesizeSpeech.mockResolvedValue([
        { audioContent: mockAudioContent },
      ]);

      const result = await generator.generatePerPage(pageText, language, pageNumber, jobId);

      // Verify TTS was called with English voice
      expect(mockTtsClient.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.objectContaining({
            languageCode: 'en-US',
            name: 'en-US-Neural2-F',
            ssmlGender: 'FEMALE',
          }),
        })
      );

      // Verify result
      expect(result.language).toBe('en');
      expect(result.pageNumber).toBe(pageNumber);
    });

    it('should use warm and gentle voice tone settings', async () => {
      const pageText = 'Test narration text';
      const language: Language = 'en';

      mockTtsClient.synthesizeSpeech.mockResolvedValue([
        { audioContent: Buffer.from('mock-audio') },
      ]);

      await generator.generatePerPage(pageText, language, 1, 'test-job');

      // Verify warm tone settings
      expect(mockTtsClient.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({
            speakingRate: 0.95, // Slightly slower for children
            pitch: 0.0,
            effectsProfileId: ['small-bluetooth-speaker-class-device'], // Warm tone
          }),
        })
      );
    });

    it('should calculate duration based on text length', async () => {
      const shortText = 'Short text.';
      const longText = 'This is a much longer text with many more words to test duration calculation. '.repeat(5);

      mockTtsClient.synthesizeSpeech.mockResolvedValue([
        { audioContent: Buffer.from('mock-audio') },
      ]);

      const shortResult = await generator.generatePerPage(shortText, 'en', 1, 'test-job');
      const longResult = await generator.generatePerPage(longText, 'en', 2, 'test-job');

      // Longer text should have longer duration
      expect(longResult.duration).toBeGreaterThan(shortResult.duration);
    });

    it('should throw error when TTS service fails', async () => {
      mockTtsClient.synthesizeSpeech.mockRejectedValue(new Error('TTS service error'));

      await expect(
        generator.generatePerPage('Test text', 'en', 1, 'test-job')
      ).rejects.toThrow('Failed to generate narration for page 1');
    });

    it('should throw error when no audio content is received', async () => {
      mockTtsClient.synthesizeSpeech.mockResolvedValue([{}]);

      await expect(
        generator.generatePerPage('Test text', 'en', 1, 'test-job')
      ).rejects.toThrow('No audio content received from TTS service');
    });

    it('should throw error when Cloud Storage upload fails', async () => {
      mockTtsClient.synthesizeSpeech.mockResolvedValue([
        { audioContent: Buffer.from('mock-audio') },
      ]);
      mockFile.save.mockRejectedValue(new Error('Storage error'));

      await expect(
        generator.generatePerPage('Test text', 'en', 1, 'test-job')
      ).rejects.toThrow('Failed to generate narration for page 1');
    });
  });

  describe('generateAll', () => {
    const createMockPages = (count: number): StoryPage[] => {
      return Array.from({ length: count }, (_, i) => ({
        pageNumber: i + 1,
        narrationText: `This is page ${i + 1} narration text with enough words to meet requirements.`,
        imagePrompt: `Image prompt for page ${i + 1}`,
        animationMode: 'standard' as const,
      }));
    };

    beforeEach(() => {
      // Mock successful TTS responses
      mockTtsClient.synthesizeSpeech.mockResolvedValue([
        { audioContent: Buffer.from('mock-audio-data') },
      ]);
    });

    it('should generate narrations for all pages in parallel', async () => {
      const pages = createMockPages(5);
      const language: Language = 'en';
      const jobId = 'test-job-789';

      const results = await generator.generateAll(pages, language, jobId);

      // Verify all pages were processed
      expect(results).toHaveLength(5);
      expect(mockTtsClient.synthesizeSpeech).toHaveBeenCalledTimes(5);

      // Verify results are sorted by page number
      results.forEach((result, index) => {
        expect(result.pageNumber).toBe(index + 1);
        expect(result.language).toBe(language);
        expect(result.audioUrl).toContain(`page-${index + 1}.mp3`);
        expect(result.duration).toBeGreaterThan(0);
      });
    });

    it('should handle Japanese language for all pages', async () => {
      const pages: StoryPage[] = [
        {
          pageNumber: 1,
          narrationText: 'これは日本語のページです。子供向けの物語を作ります。',
          imagePrompt: 'Image prompt',
          animationMode: 'standard',
        },
        {
          pageNumber: 2,
          narrationText: '次のページも日本語で書かれています。楽しい冒険が続きます。',
          imagePrompt: 'Image prompt',
          animationMode: 'highlight',
        },
      ];

      const results = await generator.generateAll(pages, 'ja', 'test-job');

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.language).toBe('ja');
      });

      // Verify Japanese voice was used
      expect(mockTtsClient.synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.objectContaining({
            languageCode: 'ja-JP',
          }),
        })
      );
    });

    it('should complete within 30 seconds timeout', async () => {
      const pages = createMockPages(6);
      const startTime = Date.now();

      await generator.generateAll(pages, 'en', 'test-job');

      const elapsedTime = (Date.now() - startTime) / 1000;
      expect(elapsedTime).toBeLessThan(30);
    });

    it('should warn if generation exceeds timeout', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const pages = createMockPages(3);

      // Mock slow TTS response (simulate taking longer than timeout)
      // Use a shorter delay for testing but still trigger the warning
      const startTime = Date.now();
      mockTtsClient.synthesizeSpeech.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve([{ audioContent: Buffer.from('mock-audio') }]);
          }, 11); // Small delay to simulate processing time
        })
      );

      // Mock Date.now to simulate timeout exceeded
      const originalDateNow = Date.now;
      let callCount = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return startTime; // Start time
        }
        // Return time that exceeds timeout (31 seconds later)
        return startTime + 31000;
      });

      await generator.generateAll(pages, 'en', 'test-job');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeding 30s limit')
      );

      consoleSpy.mockRestore();
      vi.spyOn(Date, 'now').mockRestore();
    }, 10000); // Set test timeout to 10 seconds

    it('should throw error if any page generation fails', async () => {
      const pages = createMockPages(3);

      // Make the second call fail
      mockTtsClient.synthesizeSpeech
        .mockResolvedValueOnce([{ audioContent: Buffer.from('mock-audio') }])
        .mockRejectedValueOnce(new Error('TTS error'))
        .mockResolvedValueOnce([{ audioContent: Buffer.from('mock-audio') }]);

      await expect(
        generator.generateAll(pages, 'en', 'test-job')
      ).rejects.toThrow('Failed to generate narrations');
    });

    it('should return narrations sorted by page number', async () => {
      // Create pages in random order
      const pages: StoryPage[] = [
        { pageNumber: 3, narrationText: 'Page 3', imagePrompt: 'Prompt 3', animationMode: 'standard' },
        { pageNumber: 1, narrationText: 'Page 1', imagePrompt: 'Prompt 1', animationMode: 'standard' },
        { pageNumber: 2, narrationText: 'Page 2', imagePrompt: 'Prompt 2', animationMode: 'highlight' },
      ];

      const results = await generator.generateAll(pages, 'en', 'test-job');

      // Verify results are sorted
      expect(results[0].pageNumber).toBe(1);
      expect(results[1].pageNumber).toBe(2);
      expect(results[2].pageNumber).toBe(3);
    });

    it('should store audio files in correct Cloud Storage path', async () => {
      const pages = createMockPages(2);
      const jobId = 'test-job-storage';

      await generator.generateAll(pages, 'en', jobId);

      // Verify storage paths
      expect(mockStorage.bucket).toHaveBeenCalled();
      expect(mockFile.save).toHaveBeenCalledTimes(2);
      
      // Check that files were saved with correct metadata
      expect(mockFile.save).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          metadata: expect.objectContaining({
            contentType: 'audio/mpeg',
            metadata: expect.objectContaining({
              jobId,
            }),
          }),
        })
      );
    });

    it('should return audio URLs with correct format', async () => {
      const pages = createMockPages(3);
      const jobId = 'test-job-url';

      const results = await generator.generateAll(pages, 'en', jobId);

      results.forEach((result, index) => {
        expect(result.audioUrl).toMatch(
          new RegExp(`gs://.*jobs/${jobId}/narration/page-${index + 1}\\.mp3`)
        );
      });
    });
  });
});
