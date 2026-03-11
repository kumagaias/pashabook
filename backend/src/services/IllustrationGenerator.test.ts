import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IllustrationGenerator } from './IllustrationGenerator';
import { StoryPage } from '../types/models';

// Mock Vertex AI
vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vi.fn(),
}));

// Mock Cloud Storage
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(),
}));

describe('IllustrationGenerator', () => {
  let generator: IllustrationGenerator;
  let mockVertexAI: any;
  let mockModel: any;
  let mockStorage: any;
  let mockFile: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Use fake timers to skip delays
    vi.useFakeTimers();

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

    // Create mock model with successful response
    const mockImageBase64 = Buffer.from('mock-image-data').toString('base64');
    mockModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: mockImageBase64,
                      mimeType: 'image/jpeg',
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    };

    // Create mock VertexAI instance
    mockVertexAI = {
      preview: {
        getGenerativeModel: vi.fn(() => mockModel),
      },
    };

    // Mock the constructors
    const { VertexAI } = await import('@google-cloud/vertexai');
    const { Storage } = await import('@google-cloud/storage');
    
    vi.mocked(VertexAI).mockImplementation(() => mockVertexAI);
    vi.mocked(Storage).mockImplementation(() => mockStorage);

    generator = new IllustrationGenerator();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('generateAll', () => {
    const createMockPages = (count: number): StoryPage[] => {
      return Array.from({ length: count }, (_, i) => ({
        pageNumber: i + 1,
        narrationText: `This is page ${i + 1} narration text with enough words to meet requirements.`,
        imagePrompt: `A colorful scene for page ${i + 1}`,
        animationMode: i === 2 ? ('highlight' as const) : ('standard' as const),
      }));
    };

    const mockStyle = 'Bright watercolor style with soft edges and vibrant colors';
    const mockCharacters = [
      { name: 'Luna', description: 'A small white rabbit with blue eyes' },
      { name: 'Max', description: 'A friendly brown bear wearing a red scarf' },
    ];

    it('should generate illustrations for all pages sequentially', async () => {
      const pages = createMockPages(3);
      const jobId = 'test-job-123';

      // Run test with timer advancement
      const promise = generator.generateAll(pages, mockStyle, mockCharacters, jobId);
      await vi.runAllTimersAsync();
      const results = await promise;

      // Verify all pages were processed
      expect(results).toHaveLength(3);
      expect(mockModel.generateContent).toHaveBeenCalledTimes(3);

      // Verify results are sorted by page number
      results.forEach((result, index) => {
        expect(result.pageNumber).toBe(index + 1);
        expect(result.imageUrl).toContain(`page-${index + 1}.jpg`);
        expect(result.width).toBe(1280);
        expect(result.height).toBe(720);
      });
    });

    it('should incorporate style description into prompts', async () => {
      const pages = createMockPages(2);
      const jobId = 'test-job-style';

      const promise = generator.generateAll(pages, mockStyle, mockCharacters, jobId);
      await vi.runAllTimersAsync();
      await promise;

      // Verify style is included in all prompts
      expect(mockModel.generateContent).toHaveBeenCalledTimes(2);
      
      const calls = mockModel.generateContent.mock.calls;
      calls.forEach((call: any) => {
        const prompt = call[0].contents[0].parts[0].text;
        expect(prompt).toContain(mockStyle);
      });
    });

    it('should incorporate character descriptions into prompts', async () => {
      const pages = createMockPages(2);
      const jobId = 'test-job-chars';

      const promise = generator.generateAll(pages, mockStyle, mockCharacters, jobId);
      await vi.runAllTimersAsync();
      await promise;

      // Verify characters are included in all prompts
      const calls = mockModel.generateContent.mock.calls;
      calls.forEach((call: any) => {
        const prompt = call[0].contents[0].parts[0].text;
        expect(prompt).toContain('Luna');
        expect(prompt).toContain('small white rabbit');
        expect(prompt).toContain('Max');
        expect(prompt).toContain('friendly brown bear');
      });
    });

    it('should generate illustrations at 1280x720 resolution', async () => {
      const pages = createMockPages(3);
      const jobId = 'test-job-resolution';

      const promise = generator.generateAll(pages, mockStyle, mockCharacters, jobId);
      await vi.runAllTimersAsync();
      const results = await promise;

      // Verify all illustrations have correct dimensions
      results.forEach((result) => {
        expect(result.width).toBe(1280);
        expect(result.height).toBe(720);
      });

      // Verify Vertex AI model was called with correct config
      const calls = mockModel.generateContent.mock.calls;
      calls.forEach((call: any) => {
        expect(call[0].generationConfig).toEqual({
          temperature: 0.4,
          candidateCount: 1,
        });
      });
    });

    it('should store images in Cloud Storage', async () => {
      const pages = createMockPages(2);
      const jobId = 'test-job-storage';

      const promise = generator.generateAll(pages, mockStyle, mockCharacters, jobId);
      await vi.runAllTimersAsync();
      await promise;

      // Verify storage was called for each page
      expect(mockFile.save).toHaveBeenCalledTimes(2);
      
      // Verify correct content type
      expect(mockFile.save).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          metadata: expect.objectContaining({
            contentType: 'image/jpeg',
          }),
        })
      );
    });

    it('should throw error if any page generation fails', async () => {
      // Use real timers for this test to avoid timeout issues
      vi.useRealTimers();
      
      const pages = createMockPages(3);

      // Make the second call fail
      const mockImageBase64 = Buffer.from('mock-image').toString('base64');
      mockModel.generateContent
        .mockResolvedValueOnce({
          response: {
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { data: mockImageBase64 } }],
                },
              },
            ],
          },
        })
        .mockRejectedValueOnce(new Error('Imagen generation failed'))
        .mockResolvedValueOnce({
          response: {
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { data: mockImageBase64 } }],
                },
              },
            ],
          },
        });

      await expect(generator.generateAll(pages, mockStyle, mockCharacters, 'test-job')).rejects.toThrow('Failed to generate illustrations');
      
      // Restore fake timers for subsequent tests
      vi.useFakeTimers();
    });

    it('should handle empty predictions array from Imagen', async () => {
      // Use real timers for this test to avoid timeout issues
      vi.useRealTimers();
      
      const pages = createMockPages(1);
      mockModel.generateContent.mockResolvedValue({
        response: {
          candidates: [],
        },
      });

      await expect(generator.generateAll(pages, mockStyle, mockCharacters, 'test-job')).rejects.toThrow('No image generated from Imagen API');
      
      // Restore fake timers for subsequent tests
      vi.useFakeTimers();
    });

    it('should use correct Vertex AI model parameters', async () => {
      const pages = createMockPages(1);

      const promise = generator.generateAll(pages, mockStyle, mockCharacters, 'test-job');
      await vi.runAllTimersAsync();
      await promise;

      expect(mockVertexAI.preview.getGenerativeModel).toHaveBeenCalledWith({
        model: 'imagen-3.0-generate-001',
      });

      const call = mockModel.generateContent.mock.calls[0];
      expect(call[0].generationConfig).toEqual({
        temperature: 0.4,
        candidateCount: 1,
      });
    });

    it('should include children-appropriate context in prompts', async () => {
      const pages = createMockPages(1);

      const promise = generator.generateAll(pages, mockStyle, mockCharacters, 'test-job');
      await vi.runAllTimersAsync();
      await promise;

      const call = mockModel.generateContent.mock.calls[0];
      const prompt = call[0].contents[0].parts[0].text;
      
      expect(prompt).toContain('children');
      expect(prompt).toContain('3-8 years');
      expect(prompt).toContain('storybook');
    });

    it('should store metadata with jobId and pageNumber', async () => {
      const pages = createMockPages(2);
      const jobId = 'test-job-metadata';

      const promise = generator.generateAll(pages, mockStyle, mockCharacters, jobId);
      await vi.runAllTimersAsync();
      await promise;

      // Check metadata for each saved file
      const saveCalls = mockFile.save.mock.calls;
      saveCalls.forEach((call: any, index: number) => {
        const metadata = call[1].metadata.metadata;
        expect(metadata.jobId).toBe(jobId);
        expect(metadata.pageNumber).toBe((index + 1).toString());
      });
    });
  });
});
