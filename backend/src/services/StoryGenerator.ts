import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config/gcp';
import { AnalysisResult, Story, StoryPage } from '../types/models';

export class StoryGenerator {
  private vertexAI: VertexAI;
  private model: any;

  constructor() {
    this.vertexAI = new VertexAI({
      project: config.projectId,
      location: config.vertexAI.location,
    });
    
    this.model = this.vertexAI.getGenerativeModel({
      model: config.vertexAI.geminiModel,
    });
  }

  /**
   * Generates a story based on image analysis using Gemini 2.0 Flash
   * @param analysis - Analysis results from ImageAnalyzer
   * @param language - Language for story generation ('ja' or 'en')
   * @returns Generated story with title and pages
   */
  async generate(analysis: AnalysisResult, language: string): Promise<Story> {
    const startTime = Date.now();
    
    try {
      // Create the story generation prompt based on language
      const prompt = this.createStoryPrompt(analysis, language);
      
      // Create the request
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 4096,
        },
      };

      // Generate content with timeout
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let isResolved = false;
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            reject(new Error('Story generation timeout'));
          }
        }, config.timeouts.storyGeneration * 1000);
      });

      const responsePromise = this.model.generateContent(request).then(
        (result: any) => {
          if (!isResolved) {
            isResolved = true;
            if (timeoutId !== undefined) clearTimeout(timeoutId);
          }
          return result;
        },
        (error: any) => {
          if (!isResolved) {
            isResolved = true;
            if (timeoutId !== undefined) clearTimeout(timeoutId);
          }
          throw error;
        }
      );
      
      const response = await Promise.race([responsePromise, timeoutPromise]);

      // Extract and parse the response
      const result = response.response;
      const text = result.candidates[0].content.parts[0].text;
      
      // Parse the JSON response
      const storyData = this.parseStoryResponse(text, analysis);
      
      // Validate completion time
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (elapsedTime > config.timeouts.storyGeneration) {
        console.warn(`Story generation took ${elapsedTime}s, exceeding ${config.timeouts.storyGeneration}s limit`);
      }
      
      return storyData;
    } catch (error) {
      const elapsedTime = (Date.now() - startTime) / 1000;
      console.error(`Story generation failed after ${elapsedTime}s:`, error);
      throw new Error(`Failed to generate story: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates the story generation prompt based on the selected language
   */
  private createStoryPrompt(analysis: AnalysisResult, language: string): string {
    const { characters, setting, style, emotionalTone, climaxIndicators } = analysis;
    
    const characterList = characters.map(c => `- ${c.name}: ${c.description}`).join('\n');
    const climaxList = climaxIndicators.join(', ');
    
    if (language === 'ja') {
      return `子供の絵の分析結果に基づいて、3〜8歳の子供向けの物語を作成してください。

分析結果:
キャラクター:
${characterList}

設定: ${setting}
スタイル: ${style}
感情的トーン: ${emotionalTone}
クライマックス要素: ${climaxList}

重要な要件:
1. 必ず正確に3ページの物語を作成してください（テスト用の一時的な制限）
2. 3〜8歳の子供に適した語彙を使用してください
3. すべてのキャラクターを物語に含めてください
4. 設定と感情的トーンを反映してください
5. 各ページに20〜100語のナレーションテキストを作成してください
6. 各ページに画像生成用のプロンプトを作成してください（スタイル「${style}」を含める）
7. クライマックス要素(${climaxList})に基づいて、物語の最も感情的に強烈な1ページを「highlight」として指定してください
8. その他のページは「standard」として指定してください
9. 魅力的なタイトルを作成してください

注意: ページ数は必ず3ページにしてください。4ページ以上や2ページ以下は受け付けられません。

必ずJSON形式で回答してください:
{
  "title": "物語のタイトル",
  "pages": [
    {
      "pageNumber": 1,
      "narrationText": "ページのナレーション（20〜100語）",
      "imagePrompt": "画像生成プロンプト（スタイル「${style}」を含む）",
      "animationMode": "standard" または "highlight"
    }
  ]
}

他のテキストは含めないでください。`;
    } else {
      return `Create a story for children aged 3-8 based on the analysis of a child's drawing.

Analysis Results:
Characters:
${characterList}

Setting: ${setting}
Style: ${style}
Emotional Tone: ${emotionalTone}
Climax Elements: ${climaxList}

CRITICAL Requirements:
1. Create a story with EXACTLY 3 pages (temporary limit for testing) - NO MORE, NO LESS
2. Use vocabulary appropriate for children aged 3-8 years
3. Include all characters in the story
4. Reflect the setting and emotional tone
5. Create narration text for each page with 20-100 words
6. Create an image generation prompt for each page (include style "${style}")
7. Based on the climax elements (${climaxList}), designate EXACTLY 1 page with the most emotionally intense moment as "highlight"
8. Designate other pages as "standard"
9. Create an engaging title

IMPORTANT: The story MUST have exactly 3 pages. Stories with 4+ pages or 2- pages will be rejected.

Please respond ONLY with valid JSON:
{
  "title": "Story Title",
  "pages": [
    {
      "pageNumber": 1,
      "narrationText": "Page narration (20-100 words)",
      "imagePrompt": "Image generation prompt (include style \"${style}\")",
      "animationMode": "standard" or "highlight"
    }
  ]
}

Do not include any other text.`;
    }
  }

  /**
   * Parses the Gemini response and validates the structure
   */
  private parseStoryResponse(text: string, analysis: AnalysisResult): Story {
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(cleanText);
      
      // Validate required fields
      if (!parsed.title || typeof parsed.title !== 'string' || parsed.title.trim() === '') {
        throw new Error('Missing or invalid title field');
      }
      
      if (!parsed.pages || !Array.isArray(parsed.pages)) {
        throw new Error('Missing or invalid pages field');
      }
      
      // Validate page count (3 pages for testing, will be 5-6 pages after quota increase)
      if (parsed.pages.length < 3 || parsed.pages.length > 3) {
        throw new Error(`Invalid page count: ${parsed.pages.length}. Must be 3 pages (temporary limit for testing).`);
      }
      
      // Count highlight pages (1 page for 3-page story)
      const highlightCount = parsed.pages.filter((p: any) => p.animationMode === 'highlight').length;
      if (highlightCount < 1 || highlightCount > 1) {
        throw new Error(`Invalid highlight page count: ${highlightCount}. Must be 1 page (temporary limit for testing).`);
      }
      
      // Validate each page
      const pages: StoryPage[] = [];
      for (let i = 0; i < parsed.pages.length; i++) {
        const page = parsed.pages[i];
        
        if (typeof page.pageNumber !== 'number' || page.pageNumber !== i + 1) {
          throw new Error(`Invalid page number at index ${i}: expected ${i + 1}, got ${page.pageNumber}`);
        }
        
        if (!page.narrationText || typeof page.narrationText !== 'string') {
          throw new Error(`Invalid narrationText at page ${page.pageNumber}`);
        }
        
        // Validate word count (20-100 words)
        // For Japanese, count characters instead of words (1 character ≈ 1 word)
        const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(page.narrationText);
        const wordCount = isJapanese 
          ? page.narrationText.replace(/\s+/g, '').length 
          : page.narrationText.trim().split(/\s+/).length;
        
        if (wordCount < 20 || wordCount > 100) {
          throw new Error(`Invalid word count at page ${page.pageNumber}: ${wordCount}. Must be 20-100 words.`);
        }
        
        if (!page.imagePrompt || typeof page.imagePrompt !== 'string' || page.imagePrompt.trim() === '') {
          throw new Error(`Invalid imagePrompt at page ${page.pageNumber}`);
        }
        
        // Validate that style is included in image prompt
        if (!page.imagePrompt.toLowerCase().includes(analysis.style.toLowerCase().substring(0, 10))) {
          console.warn(`Style description may not be fully incorporated in page ${page.pageNumber} image prompt`);
        }
        
        if (page.animationMode !== 'standard' && page.animationMode !== 'highlight') {
          throw new Error(`Invalid animationMode at page ${page.pageNumber}: ${page.animationMode}`);
        }
        
        pages.push({
          pageNumber: page.pageNumber,
          narrationText: page.narrationText,
          imagePrompt: page.imagePrompt,
          animationMode: page.animationMode,
        });
      }
      
      // Validate that all characters appear in the story
      const storyText = pages.map(p => p.narrationText + ' ' + p.imagePrompt).join(' ').toLowerCase();
      for (const character of analysis.characters) {
        if (!storyText.includes(character.name.toLowerCase())) {
          console.warn(`Character "${character.name}" may not be incorporated in the story`);
        }
      }
      
      return {
        title: parsed.title,
        pages,
      };
    } catch (error) {
      console.error('Error parsing story response:', error);
      console.error('Raw response text:', text);
      throw new Error(`Failed to parse story response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
