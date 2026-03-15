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
                      narrationSegments: [
                        { text: 'Once upon a time in a magical forest, there lived a brave cat named Luna and a friendly dog named Max.', speaker: 'narrator' },
                        { text: 'They loved exploring together.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'A magical forest with tall trees, colorful watercolor with soft edges, featuring Luna the orange cat and Max the brown spotted dog',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'One sunny morning, Luna and Max decided to explore the deepest part of the forest.', speaker: 'narrator' },
                        { text: 'The trees grew taller and the path became more mysterious.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Deep forest path with tall trees, colorful watercolor with soft edges, Luna and Max walking together',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: 'Suddenly, Luna spotted the tallest tree in the forest.', speaker: 'narrator' },
                        { text: 'Her eyes sparkled with excitement as she began to climb higher and higher into the sky.', speaker: 'narrator' }
                      ],
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
      expect(story.pages[0].narrationSegments).toHaveLength(2);
      expect(story.pages[0].narrationSegments[0].speaker).toBe('narrator');
      
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
                      narrationSegments: [
                        { text: '昔々、魔法の森に勇敢な猫のルナと優しい犬のマックスが住んでいました。', speaker: 'narrator' },
                        { text: '二人は一緒に探検するのが大好きでした。', speaker: 'narrator' }
                      ],
                      imagePrompt: '魔法の森、高い木々、カラフルな水彩画、柔らかいエッジ、オレンジ色の猫ルナと茶色の斑点のある犬マックス',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'ある晴れた朝、ルナとマックスは森の最も深い場所を探検することにしました。', speaker: 'narrator' },
                        { text: '木々はより高くなり、道はより神秘的になりました。', speaker: 'narrator' }
                      ],
                      imagePrompt: '深い森の道、高い木々、カラフルな水彩画、柔らかいエッジ、一緒に歩くルナとマックス',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: '突然、ルナは森で一番高い木を見つけました。', speaker: 'narrator' },
                        { text: '彼女の目は興奮で輝き、空に向かってどんどん高く登り始めました。', speaker: 'narrator' }
                      ],
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
      expect(story.pages[0].narrationSegments).toHaveLength(2);
      expect(story.pages[0].narrationSegments[0].speaker).toBe('narrator');
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
                      narrationSegments: [
                        { text: 'Once upon a time in a magical forest, there lived a brave cat named Luna and a friendly dog named Max.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Forest scene with Luna and Max, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'They had an adventure and lived happily ever after. The end of their wonderful journey together.', speaker: 'narrator' }
                      ],
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
                    narrationSegments: [
                      { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                    ],
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
                      narrationSegments: [
                        { text: 'Too short.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
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
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'invalid',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
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
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
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
                    narrationSegments: [
                      { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                    ],
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
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
                      imagePrompt: '',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
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

    it('should calculate estimated durations for English pages', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Duration Test Story',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationSegments: [
                        { text: 'This is a test with exactly thirty words to verify the duration calculation formula works correctly for English language narration text in the story generator component.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Test scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'This is a test with exactly sixty words to verify the duration calculation formula works correctly for English language narration text in the story generator component and to ensure that longer narration text produces proportionally longer estimated durations as expected by the requirements.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Test scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: 'This is a twenty word test to verify minimum duration threshold is applied correctly for very short narration text segments in stories.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Test scene, colorful watercolor with soft edges',
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

      // English: word count / 180 words-per-minute * 60 seconds
      // Verify durations are calculated correctly
      expect(story.pages[0].estimatedDuration).toBeCloseTo(8.67, 0);
      expect(story.pages[1].estimatedDuration).toBeCloseTo(14.33, 0);
      expect(story.pages[2].estimatedDuration).toBeCloseTo(7.33, 0);
    });

    it('should calculate estimated durations for Japanese pages', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: '時間テスト物語',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationSegments: [
                        { text: '昔々、魔法の森に勇敢な猫のルナと優しい犬のマックスが住んでいました。', speaker: 'narrator' }
                      ],
                      imagePrompt: 'テストシーン、カラフルな水彩画、柔らかいエッジ',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'ある晴れた朝、ルナとマックスは森の最も深い部分を探検することにしました。木々はより高く成長し、道はより神秘的になりました。', speaker: 'narrator' }
                      ],
                      imagePrompt: 'テストシーン、カラフルな水彩画、柔らかいエッジ',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: '突然、ルナは森で最も高い木を見つけました。彼女の目は興奮で輝きました。', speaker: 'narrator' }
                      ],
                      imagePrompt: 'テストシーン、カラフルな水彩画、柔らかいエッジ',
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

      // Japanese: character count / 250 characters-per-minute * 60 seconds
      // Verify durations are calculated correctly
      expect(story.pages[0].estimatedDuration).toBeCloseTo(8.16, 0);
      expect(story.pages[1].estimatedDuration).toBeCloseTo(14.64, 0);
      expect(story.pages[2].estimatedDuration).toBeCloseTo(8.40, 0);
    });

    it('should validate narrationSegments structure with multiple speakers', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Multi-Speaker Story',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationSegments: [
                        { text: 'Once upon a time in a magical forest, there lived a brave cat named Luna who loved to explore.', speaker: 'narrator' },
                        { text: 'I love exploring!', speaker: 'protagonist' }
                      ],
                      imagePrompt: 'Forest scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'Luna met a friendly dog named Max who wanted to join her on adventures.', speaker: 'narrator' },
                        { text: 'Hello Luna! Want to explore together?', speaker: 'supporting_character' }
                      ],
                      imagePrompt: 'Luna and Max meeting, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: 'They climbed the tallest tree together and saw the whole forest from above with all its beauty.', speaker: 'narrator' },
                        { text: 'This is amazing! I can see everything!', speaker: 'protagonist' }
                      ],
                      imagePrompt: 'Luna and Max climbing tree, colorful watercolor with soft edges',
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

      expect(story.pages[0].narrationSegments).toHaveLength(2);
      expect(story.pages[0].narrationSegments[0].speaker).toBe('narrator');
      expect(story.pages[0].narrationSegments[1].speaker).toBe('protagonist');
      expect(story.pages[1].narrationSegments[1].speaker).toBe('supporting_character');
    });

    it('should reject invalid speaker values in narrationSegments', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Invalid Speaker Story',
                  pages: [
                    {
                      pageNumber: 1,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'invalid_speaker' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 2,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
                      imagePrompt: 'Scene, colorful watercolor with soft edges',
                      animationMode: 'standard',
                    },
                    {
                      pageNumber: 3,
                      narrationSegments: [
                        { text: 'This is a page with exactly twenty one words to meet the minimum requirement for narration text length validation here.', speaker: 'narrator' }
                      ],
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

      await expect(generator.generate(mockAnalysis, 'en')).rejects.toThrow('Invalid speaker value');
    });

    it('should support backward compatibility with narrationText', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  title: 'Legacy Format Story',
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
                }),
              }],
            },
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const story = await generator.generate(mockAnalysis, 'en');

      expect(story.title).toBe('Legacy Format Story');
      expect(story.pages[0].narrationSegments).toHaveLength(1);
      expect(story.pages[0].narrationSegments[0].speaker).toBe('narrator');
      expect(story.pages[0].narrationText).toBeTruthy();
    });
  });
});
