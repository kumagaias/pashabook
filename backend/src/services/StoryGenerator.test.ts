import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryGenerator } from './StoryGenerator';
import { AnalysisResult } from '../types/models';

// Mock the VertexAI module
vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
    }),
  })),
}));

describe('StoryGenerator', () => {
  let generator: StoryGenerator;
  let mockModel: any;
  
  const mockAnalysis: AnalysisResult = {
    characters: [
      { name: 'Luna', description: 'A brave cat with orange fur' },
      { name: 'Max', description: 'A friendly dog with brown spots' },
    ],
    setting: 'A magical forest with tall trees',
    style: 'Colorful watercolor with soft edges',
    emotionalTone: 'Adventurous and joyful',
    climaxIndicators: ['Luna climbing the tallest tree', 'Max discovering a hidden cave'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new StoryGenerator();
    mockModel = (generator as any).model;
  });

  describe('generate', () => {
    it('should generate a valid story with 5-6 pages', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Luna and Max\'s Adventure',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationText: 'Once upon a time in a magical forest, there lived a brave cat named Luna and a friendly dog named Max. They loved exploring together.',
                      imagePrompt: 'A magical forest with tall trees, colorful watercolor with soft edges, featuring Luna the orange cat and Max the brown spotted dog',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationText: 'One sunny morning, Luna and Max decided to explore the deepest part of the forest. The trees grew taller and the path became more mysterious.',
                      imagePrompt: 'Deep forest path with tall trees, colorful watercolor with soft edges, Luna and Max walking together',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationText: 'Suddenly, Luna spotted the tallest tree in the forest. Her eyes sparkled with excitement as she began to climb higher and higher into the sky.',
                      imagePrompt: 'Luna climbing a very tall tree, colorful watercolor with soft edges, dramatic upward perspective',
                      animationMode: 'highlight',
                    },

                  ],
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const story = await generator.generate(mockAnalysis, 'en');

      expect(story.title).toBe('Luna and Max\'s Adventure');
      expect(story.pages).toHaveLength(3);
      expect(story.pages[0].pageNumber).toBe(1);
      expect(story.pages[0].animationMode).toBe('standard');
      
      // Check highlight pages (exactly 1 for 3-page story)
      const highlightPages = story.pages.filter(p => p.animationMode === 'highlight');
      expect(highlightPages.length).toBe(1);
    });

    it('should generate Japanese story when language is ja', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'ルナとマックスの冒険',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationText: '昔々、魔法の森に勇敢な猫のルナと優しい犬のマックスが住んでいました。二人は一緒に探検するのが大好きでした。',
                      imagePrompt: '魔法の森、高い木々、カラフルな水彩画、柔らかいエッジ、オレンジ色の猫ルナと茶色の斑点のある犬マックス',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationText: 'ある晴れた朝、ルナとマックスは森の最も深い場所を探検することにしました。木々はより高くなり、道はより神秘的になりました。',
                      imagePrompt: '深い森の道、高い木々、カラフルな水彩画、柔らかいエッジ、一緒に歩くルナとマックス',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationText: '突然、ルナは森で一番高い木を見つけました。彼女の目は興奮で輝き、空に向かってどんどん高く登り始めました。',
                      imagePrompt: 'とても高い木に登るルナ、カラフルな水彩画、柔らかいエッジ、劇的な上向きの視点',
                      animationMode: 'highlight',
                    },

                  ],
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const story = await generator.generate(mockAnalysis, 'ja');

      expect(story.title).toBe('ルナとマックスの冒険');
      expect(story.pages).toHaveLength(3);
    });

    it('should handle timeout and throw error', async () => {
      vi.useFakeTimers();
      
      mockModel.generateContent.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 35000))
      );

      const promise = generator.generate(mockAnalysis, 'en');
      
      // Prevent unhandled rejection warning
      promise.catch(() => {});
      
      // Fast-forward time by 31 seconds (past the 30s timeout)
      await vi.advanceTimersByTimeAsync(31000);
      
      await expect(promise).rejects.toThrow('Story generation timeout');
      
      vi.useRealTimers();
    });

    it('should validate page count is exactly 3', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Wrong Page Count Story',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationText: 'Once upon a time in a magical forest, there lived a brave cat named Luna and a friendly dog named Max.',
                      imagePrompt: 'Forest scene with Luna and Max, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationText: 'They had an adventure and lived happily ever after. The end of their wonderful journey together.',
                      imagePrompt: 'Happy ending scene, colorful watercolor with soft edges',
                      animationMode: 'highlight',
                    },
                  ],
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(generator.generate(mockAnalysis, 'en')).rejects.toThrow('Invalid page count');
    });

    it('should validate highlight page count is exactly 1', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'No Highlights Story',
                  pages: Array(3).fill(null).map((_, i) => ({
                    pageNumber: i + 1,
                    narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                    imagePrompt: 'Scene description, colorful watercolor with soft edges',
                    animationMode: 'standard',
                  })),
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(generator.generate(mockAnalysis, 'en')).rejects.toThrow('Invalid highlight page count');
    });

    it('should validate narration word count is 20-100', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Short Text Story',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationText: 'Too short.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'highlight',
                    },
                  ],
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(generator.generate(mockAnalysis, 'en')).rejects.toThrow('Invalid word count');
    });

    it('should validate animation mode is standard or highlight', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Invalid Mode Story',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'invalid',
                    },
                    {
                      pageNumber: 2,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'highlight',
                    },
                  ],
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(generator.generate(mockAnalysis, 'en')).rejects.toThrow('Invalid animationMode');
    });

    it('should handle markdown code blocks in response', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: '```json\n' + JSON.stringify({
                  title: 'Markdown Story',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'highlight',
                    },
                  ],
                }) + '\n```',
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const story = await generator.generate(mockAnalysis, 'en');
      expect(story.title).toBe('Markdown Story');
    });

    it('should validate that title is non-empty', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: '',
                  pages: Array(5).fill(null).map((_, i) => ({
                    pageNumber: i + 1,
                    narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                    imagePrompt: 'Scene, colorful watercolor with soft edges',
                    animationMode: i === 2 ? 'highlight' : 'standard',
                  })),
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(generator.generate(mockAnalysis, 'en')).rejects.toThrow('Missing or invalid title');
    });

    it('should validate that image prompts are non-empty', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Empty Prompt Story',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: '',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationText: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.',
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'highlight',
                    },
                  ],
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(generator.generate(mockAnalysis, 'en')).rejects.toThrow('Invalid imagePrompt');
    });
  });
});
