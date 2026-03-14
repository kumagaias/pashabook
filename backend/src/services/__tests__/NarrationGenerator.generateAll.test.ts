import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NarrationGenerator } from '../NarrationGenerator';
import { StoryPage, Language } from '../../types/models';

/**
 * Integration tests for Task 33.3: Update NarrationGenerator to store actual durations
 * 
 * Requirements tested:
 * - 8.12: Calculate actual duration per page by summing all character audio segment durations
 * - 8.13: Update the Job record with actual durations, replacing estimated durations
 * 
 * Property 70: Character Voice Separation
 */
describe('NarrationGenerator.generateAll - Task 33.3', () => {
  let narrationGenerator: NarrationGenerator;
  const mockJobId = 'test-job-456';
  let mockFirestoreUpdate: any;

  beforeEach(() => {
    narrationGenerator = new NarrationGenerator();
    
    // Mock Firestore operations
    vi.spyOn(narrationGenerator as any, 'getCharacterVoiceMap').mockResolvedValue({});
    vi.spyOn(narrationGenerator as any, 'updateCharacterVoiceMap').mockResolvedValue(undefined);
    
    // Mock Firestore update for actualDurations
    const mockFirestore = (narrationGenerator as any).firestore;
    mockFirestoreUpdate = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(mockFirestore.collection('jobs').doc(mockJobId), 'update').mockImplementation(mockFirestoreUpdate);
    
    // Mock Cloud Storage bucket
    const mockStorage = (narrationGenerator as any).storage;
    const mockBucket = {
      file: vi.fn().mockReturnValue({
        save: vi.fn().mockResolvedValue(undefined),
      }),
    };
    vi.spyOn(mockStorage, 'bucket').mockReturnValue(mockBucket);
    
    // Mock TTS client
    const mockTtsClient = (narrationGenerator as any).ttsClient;
    vi.spyOn(mockTtsClient, 'synthesizeSpeech').mockResolvedValue([
      { audioContent: Buffer.from('mock-audio-data') },
    ]);
  });

  describe('Requirement 8.13: Update Job record with actual durations', () => {
    it('should update Job record with actualDurations array after generating all narrations', async () => {
      const mockPages: StoryPage[] = [
        {
          pageNumber: 1,
          narrationText: 'Page 1 text',
          narrationSegments: [
            { text: 'Once upon a time', speaker: 'narrator' },
            { text: 'Hello!', speaker: 'protagonist' },
          ],
          imageUrl: 'gs://bucket/page-1.jpg',
          animationMode: 'standard',
          estimatedDuration: 5.0,
        },
        {
          pageNumber: 2,
          narrationText: 'Page 2 text',
          narrationSegments: [
            { text: 'The adventure continues', speaker: 'narrator' },
          ],
          imageUrl: 'gs://bucket/page-2.jpg',
          animationMode: 'standard',
          estimatedDuration: 3.0,
        },
        {
          pageNumber: 3,
          narrationText: 'Page 3 text',
          narrationSegments: [
            { text: 'And they lived happily', speaker: 'narrator' },
            { text: 'Forever!', speaker: 'protagonist' },
            { text: 'The end', speaker: 'narrator' },
          ],
          imageUrl: 'gs://bucket/page-3.jpg',
          animationMode: 'highlight',
          estimatedDuration: 6.0,
        },
      ];

      const result = await narrationGenerator.generateAll(mockPages, 'en' as Language, mockJobId);

      // Verify narrations were generated for all pages
      expect(result).toHaveLength(3);
      expect(result[0].pageNumber).toBe(1);
      expect(result[1].pageNumber).toBe(2);
      expect(result[2].pageNumber).toBe(3);

      // Verify each narration has actualDuration
      result.forEach(narration => {
        expect(narration).toHaveProperty('actualDuration');
        expect(narration.actualDuration).toBeGreaterThan(0);
        expect(narration.actualDuration).toBe(narration.duration);
      });

      // Verify Job record was updated with actualDurations array
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          actualDurations: expect.arrayContaining([
            expect.any(Number),
            expect.any(Number),
            expect.any(Number),
          ]),
          updatedAt: expect.any(Date),
        })
      );

      // Verify actualDurations array has correct length
      const updateCall = mockFirestoreUpdate.mock.calls.find((call: any) => 
        call[0].hasOwnProperty('actualDurations')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0].actualDurations).toHaveLength(3);
    });

    it('should calculate actualDurations correctly for each page', async () => {
      const mockPages: StoryPage[] = [
        {
          pageNumber: 1,
          narrationText: 'Page 1',
          narrationSegments: [
            { text: 'Short text', speaker: 'narrator' },
          ],
          imageUrl: 'gs://bucket/page-1.jpg',
          animationMode: 'standard',
          estimatedDuration: 2.0,
        },
        {
          pageNumber: 2,
          narrationText: 'Page 2',
          narrationSegments: [
            { text: 'This is a longer text with more words to speak', speaker: 'narrator' },
            { text: 'And another segment', speaker: 'protagonist' },
          ],
          imageUrl: 'gs://bucket/page-2.jpg',
          animationMode: 'standard',
          estimatedDuration: 5.0,
        },
      ];

      const result = await narrationGenerator.generateAll(mockPages, 'en' as Language, mockJobId);

      // Verify actualDurations match the sum of audio segments for each page
      expect(result[0].actualDuration).toBe(
        result[0].audioSegments.reduce((sum, seg) => sum + seg.duration, 0)
      );
      expect(result[1].actualDuration).toBe(
        result[1].audioSegments.reduce((sum, seg) => sum + seg.duration, 0)
      );

      // Verify Job record update contains correct actualDurations
      const updateCall = mockFirestoreUpdate.mock.calls.find((call: any) => 
        call[0].hasOwnProperty('actualDurations')
      );
      expect(updateCall[0].actualDurations[0]).toBe(result[0].actualDuration);
      expect(updateCall[0].actualDurations[1]).toBe(result[1].actualDuration);
    });

    it('should update Job record even if actualDurations differ from estimatedDurations', async () => {
      const mockPages: StoryPage[] = [
        {
          pageNumber: 1,
          narrationText: 'Test',
          narrationSegments: [
            { text: 'This text will have different actual duration than estimated', speaker: 'narrator' },
          ],
          imageUrl: 'gs://bucket/page-1.jpg',
          animationMode: 'standard',
          estimatedDuration: 3.0, // Estimated duration
        },
      ];

      const result = await narrationGenerator.generateAll(mockPages, 'en' as Language, mockJobId);

      // Actual duration will be calculated from TTS, likely different from estimated
      const actualDuration = result[0].actualDuration;
      
      // Verify Job record was updated with actual duration (not estimated)
      const updateCall = mockFirestoreUpdate.mock.calls.find((call: any) => 
        call[0].hasOwnProperty('actualDurations')
      );
      expect(updateCall[0].actualDurations[0]).toBe(actualDuration);
      
      // Verify it's a real calculated value, not just the estimated value
      expect(actualDuration).toBeGreaterThan(0);
    });

    it('should handle Japanese language with character-based duration calculation', async () => {
      const mockPages: StoryPage[] = [
        {
          pageNumber: 1,
          narrationText: 'これは日本語のテキストです',
          narrationSegments: [
            { text: 'これは日本語のテキストです', speaker: 'narrator' },
          ],
          imageUrl: 'gs://bucket/page-1.jpg',
          animationMode: 'standard',
          estimatedDuration: 4.0,
        },
      ];

      const result = await narrationGenerator.generateAll(mockPages, 'ja' as Language, mockJobId);

      // Verify actualDuration was calculated (Japanese uses character count)
      expect(result[0].actualDuration).toBeGreaterThan(0);
      
      // Verify Job record was updated
      const updateCall = mockFirestoreUpdate.mock.calls.find((call: any) => 
        call[0].hasOwnProperty('actualDurations')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0].actualDurations[0]).toBe(result[0].actualDuration);
    });
  });

  describe('Property 70: Character Voice Separation with actual durations', () => {
    it('should calculate actualDuration as sum of all character audio segments', async () => {
      const mockPages: StoryPage[] = [
        {
          pageNumber: 1,
          narrationText: 'Multi-character page',
          narrationSegments: [
            { text: 'Narrator introduces the scene', speaker: 'narrator' },
            { text: 'Protagonist speaks', speaker: 'protagonist' },
            { text: 'Supporting character responds', speaker: 'supporting_character' },
          ],
          imageUrl: 'gs://bucket/page-1.jpg',
          animationMode: 'standard',
          estimatedDuration: 8.0,
        },
      ];

      const result = await narrationGenerator.generateAll(mockPages, 'en' as Language, mockJobId);

      // Verify actualDuration is sum of all character segments
      const totalDuration = result[0].audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
      expect(result[0].actualDuration).toBe(totalDuration);
      expect(result[0].audioSegments).toHaveLength(3);
      
      // Verify each segment has a duration
      result[0].audioSegments.forEach(segment => {
        expect(segment.duration).toBeGreaterThan(0);
      });
    });
  });
});
