import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageAnalyzer } from './ImageAnalyzer';
import { config } from '../config/gcp';

// Create mock model before mocking the module
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

// Mock the VertexAI module
vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('ImageAnalyzer', () => {
  let analyzer: ImageAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new ImageAnalyzer();
  });

  describe('analyze', () => {
    const mockImageUrl = 'https://storage.googleapis.com/test-bucket/test-image.jpg';

    beforeEach(() => {
      // Mock fetch to return image data
      (global.fetch as any).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('fake-image-data'),
      });
    });

    it('should successfully analyze an image and return structured results', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      characters: [
                        {
                          name: 'Dragon',
                          description: 'A friendly green dragon with purple wings',
                        },
                      ],
                      setting: 'A magical forest with tall trees',
                      style: 'Colorful crayon drawing with bold lines',
                      emotionalTone: 'Joyful and adventurous',
                      climaxIndicators: ['Dragon breathing fire', 'Character riding the dragon'],
                    }),
                  },
                ],
              },
            },
          ],
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await analyzer.analyze(mockImageUrl, 'en');

      expect(result).toEqual({
        characters: [
          {
            name: 'Dragon',
            description: 'A friendly green dragon with purple wings',
          },
        ],
        setting: 'A magical forest with tall trees',
        style: 'Colorful crayon drawing with bold lines',
        emotionalTone: 'Joyful and adventurous',
        climaxIndicators: ['Dragon breathing fire', 'Character riding the dragon'],
      });

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(mockImageUrl);
    });

    it('should handle Japanese language prompts', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      characters: [
                        {
                          name: 'ドラゴン',
                          description: '緑色の優しいドラゴン',
                        },
                      ],
                      setting: '魔法の森',
                      style: 'カラフルなクレヨン画',
                      emotionalTone: '楽しい',
                      climaxIndicators: ['ドラゴンが火を吹く'],
                    }),
                  },
                ],
              },
            },
          ],
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await analyzer.analyze(mockImageUrl, 'ja');

      expect(result.characters[0].name).toBe('ドラゴン');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should handle response with markdown code blocks', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n' + JSON.stringify({
                      characters: [{ name: 'Hero', description: 'Brave knight' }],
                      setting: 'Castle',
                      style: 'Medieval art',
                      emotionalTone: 'Heroic',
                      climaxIndicators: ['Battle scene'],
                    }) + '\n```',
                  },
                ],
              },
            },
          ],
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await analyzer.analyze(mockImageUrl, 'en');

      expect(result.characters[0].name).toBe('Hero');
    });

    it('should timeout if analysis exceeds 30 seconds', async () => {
      vi.useFakeTimers();
      
      // Mock a slow response that exceeds the timeout
      mockGenerateContent.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              response: {
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          text: JSON.stringify({
                            characters: [],
                            setting: '',
                            style: '',
                            emotionalTone: '',
                            climaxIndicators: [],
                          }),
                        },
                      ],
                    },
                  },
                ],
              },
            });
          }, (config.timeouts.analysis + 1) * 1000);
        });
      });

      const promise = analyzer.analyze(mockImageUrl, 'en');
      
      // Prevent unhandled rejection warning
      promise.catch(() => {});
      
      // Fast-forward time by 31 seconds (past the 30s timeout)
      await vi.advanceTimersByTimeAsync(31000);
      
      await expect(promise).rejects.toThrow('Analysis timeout');
      
      vi.useRealTimers();
    });

    it('should handle Gemini API errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      await expect(analyzer.analyze(mockImageUrl, 'en')).rejects.toThrow('Failed to analyze image');
    });

    it('should handle image fetch errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(analyzer.analyze(mockImageUrl, 'en')).rejects.toThrow('Failed to analyze image');
    });

    it('should validate required fields in response', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      characters: [],
                      setting: 'Forest',
                      // Missing style, emotionalTone, climaxIndicators
                    }),
                  },
                ],
              },
            },
          ],
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await expect(analyzer.analyze(mockImageUrl, 'en')).rejects.toThrow('Failed to parse analysis response');
    });

    it('should validate character structure', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      characters: [
                        {
                          name: 'Hero',
                          // Missing description
                        },
                      ],
                      setting: 'Castle',
                      style: 'Medieval',
                      emotionalTone: 'Heroic',
                      climaxIndicators: ['Battle'],
                    }),
                  },
                ],
              },
            },
          ],
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await expect(analyzer.analyze(mockImageUrl, 'en')).rejects.toThrow('Failed to parse analysis response');
    });

    it('should handle invalid JSON in response', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'This is not valid JSON',
                  },
                ],
              },
            },
          ],
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await expect(analyzer.analyze(mockImageUrl, 'en')).rejects.toThrow('Failed to parse analysis response');
    });
  });
});
