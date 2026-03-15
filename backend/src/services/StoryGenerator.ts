import { VertexAI } from '@google-cloud/vertexai';
import { Storage } from '@google-cloud/storage';
import { config } from '../config/gcp';
import { AnalysisResult, Story, StoryPage, NarrationSegment, Illustration } from '../types/models';

export class StoryGenerator {
  private vertexAI: VertexAI;
  private model: any;
  private storage: Storage;
  private bucket: string;

  constructor() {
    this.vertexAI = new VertexAI({
      project: config.projectId,
      location: config.vertexAI.location,
    });
    
    // Use gemini-2.5-flash-image for interleaved output (text + images)
    this.model = this.vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
    });
    
    this.storage = new Storage({
      projectId: config.projectId,
    });
    this.bucket = config.storageBucket;
  }

  /**
   * Generates a story with interleaved illustrations using Gemini 2.5 Flash Image
   * @param analysis - Analysis results from ImageAnalyzer
   * @param language - Language for story generation ('ja' or 'en')
   * @param jobId - Job ID for storing illustrations
   * @returns Generated story with title, pages, and illustration URLs
   */
  async generate(analysis: AnalysisResult, language: string, jobId: string): Promise<{ story: Story; illustrations: Illustration[] }> {
    const startTime = Date.now();
    
    try {
      // Create the story generation prompt based on language
      const prompt = this.createStoryPrompt(analysis, language);
      
      // Create the request with interleaved output (TEXT + IMAGE)
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
          responseMimeType: 'application/json', // Request JSON output
          responseModalities: ['TEXT', 'IMAGE'], // Enable interleaved output
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

      // Extract interleaved parts (text + images)
      const result = response.response;
      const parts = result.candidates[0].content.parts;
      
      console.log(`[StoryGenerator] Received ${parts.length} parts from Gemini (text + images)`);
      
      // Extract text and images from interleaved output
      let storyText = '';
      const imageBuffers: Buffer[] = [];
      
      for (const part of parts) {
        if (part.text) {
          storyText += part.text;
        } else if (part.inlineData && part.inlineData.data) {
          // Extract base64-encoded image
          const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
          imageBuffers.push(imageBuffer);
        }
      }
      
      console.log(`[StoryGenerator] Extracted ${imageBuffers.length} images from interleaved output`);
      
      // Parse the JSON response
      const storyData = this.parseStoryResponse(storyText, analysis);
      
      // Validate that we have the correct number of images
      if (imageBuffers.length !== storyData.pages.length) {
        console.warn(`[StoryGenerator] Image count mismatch: expected ${storyData.pages.length}, got ${imageBuffers.length}`);
        // If we have fewer images than pages, this will trigger fallback to Imagen 3
        if (imageBuffers.length < storyData.pages.length) {
          throw new Error(`Incomplete image generation: expected ${storyData.pages.length} images, got ${imageBuffers.length}`);
        }
      }
      
      // Upload images to Cloud Storage
      const illustrations: Illustration[] = [];
      for (let i = 0; i < Math.min(imageBuffers.length, storyData.pages.length); i++) {
        const pageNumber = i + 1;
        const imageBuffer = imageBuffers[i];
        
        const fileName = `jobs/${jobId}/illustrations/page-${pageNumber}.jpg`;
        const file = this.storage.bucket(this.bucket).file(fileName);

        await file.save(imageBuffer, {
          metadata: {
            contentType: 'image/jpeg',
            metadata: {
              jobId,
              pageNumber: pageNumber.toString(),
              source: 'gemini-interleaved',
            },
          },
        });

        const imageUrl = `gs://${this.bucket}/${fileName}`;
        
        illustrations.push({
          pageNumber,
          imageUrl,
          width: 1280,
          height: 720,
        });
      }
      
      // Calculate estimated durations for each page
      const storyWithDurations = this.addDurationEstimates(storyData, language);
      
      // Validate completion time
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (elapsedTime > config.timeouts.storyGeneration) {
        console.warn(`Story generation took ${elapsedTime}s, exceeding ${config.timeouts.storyGeneration}s limit`);
      }
      
      console.log(`[StoryGenerator] Successfully generated story with ${illustrations.length} illustrations`);
      
      return {
        story: storyWithDurations,
        illustrations,
      };
    } catch (error) {
      const elapsedTime = (Date.now() - startTime) / 1000;
      console.error(`[StoryGenerator] Story generation failed after ${elapsedTime}s:`, error);
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

**CRITICAL - JSON構造化出力形式（必須）:**

ナレーションは必ず「narrationSegments」フィールドとして、以下の厳密なJSON配列形式で出力してください:

[
  {"text": "ナレーターのテキスト", "speaker": "narrator"},
  {"text": "主人公のセリフ", "speaker": "protagonist"},
  {"text": "脇役のセリフ", "speaker": "supporting_character"}
]

各セグメントの必須フィールド:
- "text": セリフまたはナレーションの内容（文字列）
- "speaker": 話者の種類（"narrator", "protagonist", "supporting_character"のいずれか）

この構造化形式により:
- キャラクターボイス分離時のパースエラーを防止
- 各キャラクターに異なるTTS音声を割り当て可能
- ナレーターと登場人物の声を明確に区別

重要: 古い形式の"narrationText"フィールドは使用しないでください。必ず"narrationSegments"配列を使用してください。

必ずJSON形式で回答してください:
{
  "title": "物語のタイトル",
  "pages": [
    {
      "pageNumber": 1,
      "narrationSegments": [
        {"text": "ナレーターのテキスト", "speaker": "narrator"},
        {"text": "主人公のセリフ", "speaker": "protagonist"}
      ],
      "imagePrompt": "画像生成プロンプト（スタイル「${style}」を含む）",
      "animationMode": "standard"
    }
  ]
}

narrationSegmentsは必ず配列形式で、各要素に「text」と「speaker」フィールドを含めてください。
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
5. Create narration text for each page with 20-100 words total
6. Create an image generation prompt for each page (include style "${style}")
7. Based on the climax elements (${climaxList}), designate EXACTLY 1 page with the most emotionally intense moment as "highlight"
8. Designate other pages as "standard"
9. Create an engaging title

IMPORTANT: The story MUST have exactly 3 pages. Stories with 4+ pages or 2- pages will be rejected.

**CRITICAL - JSON Structured Output Format (REQUIRED):**

Narration MUST be output as a "narrationSegments" field in this strict JSON array format:

[
  {"text": "Narrator text here", "speaker": "narrator"},
  {"text": "Character dialogue here", "speaker": "protagonist"},
  {"text": "Supporting character dialogue", "speaker": "supporting_character"}
]

Required fields for each segment:
- "text": The dialogue or narration content (string)
- "speaker": The speaker type (must be one of: "narrator", "protagonist", "supporting_character")

This structured format enables:
- Prevention of parse errors in character voice separation
- Assignment of distinct TTS voices to each character type
- Clear distinction between narrator and character voices

IMPORTANT: Do NOT use the old "narrationText" field format. You MUST use the "narrationSegments" array format.

Please respond ONLY with valid JSON:
{
  "title": "Story Title",
  "pages": [
    {
      "pageNumber": 1,
      "narrationSegments": [
        {"text": "Narrator text here", "speaker": "narrator"},
        {"text": "Character dialogue here", "speaker": "protagonist"}
      ],
      "imagePrompt": "Image generation prompt (include style \"${style}\")",
      "animationMode": "standard"
    }
  ]
}

narrationSegments MUST be an array with each element containing "text" and "speaker" fields.
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
        
        // Validate narrationSegments (new format)
        let narrationSegments: NarrationSegment[] = [];
        let narrationText = '';
        
        if (page.narrationSegments && Array.isArray(page.narrationSegments)) {
          // New format: validate narrationSegments
          if (page.narrationSegments.length === 0) {
            throw new Error(`Empty narrationSegments at page ${page.pageNumber}`);
          }
          
          for (let j = 0; j < page.narrationSegments.length; j++) {
            const segment = page.narrationSegments[j];
            
            // Validate segment structure
            if (typeof segment !== 'object' || segment === null) {
              throw new Error(`Invalid narrationSegment ${j} at page ${page.pageNumber}: must be an object`);
            }
            
            // Validate text field
            if (!segment.text || typeof segment.text !== 'string' || segment.text.trim() === '') {
              throw new Error(`Invalid or missing text in narrationSegment ${j} at page ${page.pageNumber}`);
            }
            
            // Validate speaker field
            if (!segment.speaker || typeof segment.speaker !== 'string') {
              throw new Error(`Invalid or missing speaker in narrationSegment ${j} at page ${page.pageNumber}`);
            }
            
            const validSpeakers = ['narrator', 'protagonist', 'supporting_character'];
            if (!validSpeakers.includes(segment.speaker)) {
              throw new Error(`Invalid speaker value "${segment.speaker}" in narrationSegment ${j} at page ${page.pageNumber}. Must be one of: ${validSpeakers.join(', ')}`);
            }
            
            // Add validated segment
            narrationSegments.push({
              text: segment.text.trim(),
              speaker: segment.speaker as 'narrator' | 'protagonist' | 'supporting_character',
            });
          }
          
          // Combine all segments for word count validation and backward compatibility
          narrationText = narrationSegments.map(s => s.text).join(' ');
        } else if (page.narrationText && typeof page.narrationText === 'string') {
          // Old format: convert to narrationSegments for backward compatibility
          narrationText = page.narrationText;
          narrationSegments = [{ text: narrationText, speaker: 'narrator' }];
          console.warn(`Page ${page.pageNumber} uses deprecated narrationText field. Please use narrationSegments instead.`);
        } else {
          throw new Error(`Missing narrationSegments at page ${page.pageNumber}. The narrationSegments field is required and must be a non-empty array.`);
        }
        
        // Validate word count (20-100 words)
        // For Japanese, count characters instead of words (1 character ≈ 1 word)
        const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(narrationText);
        const wordCount = isJapanese 
          ? narrationText.replace(/\s+/g, '').length 
          : narrationText.trim().split(/\s+/).length;
        
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
          narrationText, // Backward compatibility
          narrationSegments, // New format
          imagePrompt: page.imagePrompt,
          animationMode: page.animationMode,
          estimatedDuration: 0, // Will be calculated by addDurationEstimates
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

  /**
   * Calculates estimated duration for each page using language-specific formulas
   * @param story - Story with pages (estimatedDuration will be 0)
   * @param language - Language for duration calculation ('ja' or 'en')
   * @returns Story with estimated durations calculated
   */
  private addDurationEstimates(story: Story, language: string): Story {
    const pagesWithDurations = story.pages.map(page => {
      const estimatedDuration = this.calculateEstimatedDuration(page.narrationText, language);
      
      console.log(`Page ${page.pageNumber}: Estimated duration ${estimatedDuration.toFixed(2)}s`);
      
      return {
        ...page,
        estimatedDuration,
      };
    });
    
    return {
      ...story,
      pages: pagesWithDurations,
    };
  }

  /**
   * Calculates estimated duration for a narration text using language-specific formulas
   * @param narrationText - Text to calculate duration for
   * @param language - Language ('ja' or 'en')
   * @returns Estimated duration in seconds
   */
  private calculateEstimatedDuration(narrationText: string, language: string): number {
    if (language === 'ja') {
      // Japanese: character count / 250 characters-per-minute
      // Remove whitespace for accurate character count
      const characterCount = narrationText.replace(/\s+/g, '').length;
      const durationMinutes = characterCount / 250;
      const durationSeconds = durationMinutes * 60;
      
      return Math.max(durationSeconds, 2); // Minimum 2 seconds
    } else {
      // English: word count / 180 words-per-minute
      const wordCount = narrationText.trim().split(/\s+/).length;
      const durationMinutes = wordCount / 180;
      const durationSeconds = durationMinutes * 60;
      
      return Math.max(durationSeconds, 2); // Minimum 2 seconds
    }
  }
}
