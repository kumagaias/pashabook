import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config/gcp';
import { AnalysisResult, CharacterDescription } from '../types/models';

export class ImageAnalyzer {
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
   * Analyzes an uploaded drawing using Gemini 2.0 Flash
   * @param imageUrl - Cloud Storage URL of the uploaded image
   * @param language - Language for analysis ('ja' or 'en')
   * @returns Analysis results including characters, setting, style, emotional tone, and climax indicators
   */
  async analyze(imageUrl: string, language: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Create the analysis prompt based on language
      const prompt = this.createAnalysisPrompt(language);
      
      // Fetch the image data
      const imageData = await this.fetchImageData(imageUrl);
      
      // Create the request with image and text
      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageData,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        },
      };

      // Generate content with timeout
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let isResolved = false;
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            reject(new Error('Analysis timeout'));
          }
        }, config.timeouts.analysis * 1000);
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
      const analysisData = this.parseAnalysisResponse(text);
      
      // Validate completion time
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (elapsedTime > config.timeouts.analysis) {
        console.warn(`Analysis took ${elapsedTime}s, exceeding ${config.timeouts.analysis}s limit`);
      }
      
      return analysisData;
    } catch (error) {
      const elapsedTime = (Date.now() - startTime) / 1000;
      console.error(`Image analysis failed after ${elapsedTime}s:`, error);
      throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates the analysis prompt based on the selected language
   */
  private createAnalysisPrompt(language: string): string {
    if (language === 'ja') {
      return `この子供の絵を分析して、以下の情報をJSON形式で抽出してください:

1. characters: キャラクターの配列。各キャラクターには以下を含む:
   - name: キャラクター名
   - description: 外見、服装、特徴の詳細な説明

2. setting: 背景や場所の説明

3. style: 絵のスタイル特性(色使い、線の特徴、技法など)

4. emotionalTone: 絵から感じられる感情的なトーン(楽しい、冒険的、平和など)

5. climaxIndicators: 物語のクライマックスとなりうる重要な感情的要素やアクション要素の配列(例: 「キャラクターの驚いた表情」、「ダイナミックな動き」、「重要なオブジェクト」など)

必ずJSON形式で回答してください。他のテキストは含めないでください。`;
    } else {
      return `Analyze this child's drawing and extract the following information in JSON format:

1. characters: An array of characters. Each character should include:
   - name: Character name
   - description: Detailed description of appearance, clothing, and features

2. setting: Description of the background and location

3. style: Art style characteristics (color usage, line characteristics, techniques, etc.)

4. emotionalTone: The emotional tone conveyed by the drawing (joyful, adventurous, peaceful, etc.)

5. climaxIndicators: An array of key emotional elements or action elements that could serve as story climax points (e.g., "character's surprised expression", "dynamic movement", "important object", etc.)

Please respond ONLY with valid JSON. Do not include any other text.`;
    }
  }

  /**
   * Fetches image data from Cloud Storage URL
   * Supports both gs:// and https:// URLs
   */
  private async fetchImageData(imageUrl: string): Promise<string> {
    try {
      // Handle gs:// URLs using Cloud Storage client
      if (imageUrl.startsWith('gs://')) {
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage({ projectId: config.projectId });
        
        // Parse gs://bucket-name/path/to/file
        const urlWithoutProtocol = imageUrl.replace('gs://', '');
        const firstSlashIndex = urlWithoutProtocol.indexOf('/');
        const bucketName = urlWithoutProtocol.substring(0, firstSlashIndex);
        const filePath = urlWithoutProtocol.substring(firstSlashIndex + 1);
        
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filePath);
        
        const [buffer] = await file.download();
        return buffer.toString('base64');
      }
      
      // Handle https:// URLs using fetch
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    } catch (error) {
      console.error('Error fetching image data:', error);
      throw new Error(`Failed to fetch image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parses the Gemini response and validates the structure
   */
  private parseAnalysisResponse(text: string): AnalysisResult {
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
      if (!parsed.characters || !Array.isArray(parsed.characters)) {
        throw new Error('Missing or invalid characters field');
      }
      
      if (!parsed.setting || typeof parsed.setting !== 'string') {
        throw new Error('Missing or invalid setting field');
      }
      
      if (!parsed.style || typeof parsed.style !== 'string') {
        throw new Error('Missing or invalid style field');
      }
      
      if (!parsed.emotionalTone || typeof parsed.emotionalTone !== 'string') {
        throw new Error('Missing or invalid emotionalTone field');
      }
      
      if (!parsed.climaxIndicators || !Array.isArray(parsed.climaxIndicators)) {
        throw new Error('Missing or invalid climaxIndicators field');
      }
      
      // Validate character structure
      for (const char of parsed.characters) {
        if (!char.name || typeof char.name !== 'string') {
          throw new Error('Invalid character: missing or invalid name');
        }
        if (!char.description || typeof char.description !== 'string') {
          throw new Error('Invalid character: missing or invalid description');
        }
      }
      
      return {
        characters: parsed.characters as CharacterDescription[],
        setting: parsed.setting,
        style: parsed.style,
        emotionalTone: parsed.emotionalTone,
        climaxIndicators: parsed.climaxIndicators,
      };
    } catch (error) {
      console.error('Error parsing analysis response:', error);
      console.error('Raw response text:', text);
      throw new Error(`Failed to parse analysis response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
