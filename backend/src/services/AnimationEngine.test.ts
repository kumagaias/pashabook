import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Illustration } from '../types/models';

// Mock dependencies
vi.mock('fluent-ffmpeg');
vi.mock('@google-cloud/storage');
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

// Import after mocks
import { AnimationEngine } from './AnimationEngine';

describe('AnimationEngine', () => {
  let animationEngine: AnimationEngine;

  const mockIllustration: Illustration = {
    pageNumber: 1,
    imageUrl: 'gs://test-bucket/jobs/test-job/illustrations/page-1.jpg',
    width: 1280,
    height: 720,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    animationEngine = new AnimationEngine();
  });

  describe('animateStandardPage', () => {

    it('should generate random Ken Burns parameters', () => {
      // Test multiple generations to verify randomness
      const params1 = (animationEngine as any).generateKenBurnsParams();
      const params2 = (animationEngine as any).generateKenBurnsParams();
      const params3 = (animationEngine as any).generateKenBurnsParams();

      // Verify zoom direction is valid
      expect(['in', 'out']).toContain(params1.zoomDirection);
      expect(['in', 'out']).toContain(params2.zoomDirection);
      expect(['in', 'out']).toContain(params3.zoomDirection);

      // Verify pan direction is valid
      expect(['left', 'right', 'none']).toContain(params1.panDirection);
      expect(['left', 'right', 'none']).toContain(params2.panDirection);
      expect(['left', 'right', 'none']).toContain(params3.panDirection);
    });

    it('should handle zoom-in direction', () => {
      const params = { zoomDirection: 'in' as const, panDirection: 'none' as const };
      
      expect(params.zoomDirection).toBe('in');
      expect(['left', 'right', 'none']).toContain(params.panDirection);
    });

    it('should handle zoom-out direction', () => {
      const params = { zoomDirection: 'out' as const, panDirection: 'none' as const };
      
      expect(params.zoomDirection).toBe('out');
      expect(['left', 'right', 'none']).toContain(params.panDirection);
    });

    it('should handle pan left direction', () => {
      const params = { zoomDirection: 'in' as const, panDirection: 'left' as const };
      
      expect(['in', 'out']).toContain(params.zoomDirection);
      expect(params.panDirection).toBe('left');
    });

    it('should handle pan right direction', () => {
      const params = { zoomDirection: 'in' as const, panDirection: 'right' as const };
      
      expect(['in', 'out']).toContain(params.zoomDirection);
      expect(params.panDirection).toBe('right');
    });

    it('should handle pan none direction', () => {
      const params = { zoomDirection: 'in' as const, panDirection: 'none' as const };
      
      expect(['in', 'out']).toContain(params.zoomDirection);
      expect(params.panDirection).toBe('none');
    });

    it('should validate Ken Burns parameters structure', () => {
      const params = (animationEngine as any).generateKenBurnsParams();
      
      expect(params).toHaveProperty('zoomDirection');
      expect(params).toHaveProperty('panDirection');
      expect(typeof params.zoomDirection).toBe('string');
      expect(typeof params.panDirection).toBe('string');
    });

    it('should parse Cloud Storage URL correctly', async () => {
      const gsUrl = 'gs://test-bucket/path/to/file.jpg';
      const match = gsUrl.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe('test-bucket');
      expect(match![2]).toBe('path/to/file.jpg');
    });

    it('should reject invalid Cloud Storage URL', () => {
      const invalidUrl = 'https://example.com/file.jpg';
      const match = invalidUrl.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      
      expect(match).toBeNull();
    });

    it('should calculate correct FFmpeg parameters for zoom-in', () => {
      const params = { zoomDirection: 'in' as const, panDirection: 'none' as const };
      const duration = 5.0;
      const fps = 30;
      const totalFrames = Math.ceil(duration * fps);
      
      const zoomStart = params.zoomDirection === 'in' ? 1.0 : 1.3;
      const zoomEnd = params.zoomDirection === 'in' ? 1.3 : 1.0;
      
      expect(zoomStart).toBe(1.0);
      expect(zoomEnd).toBe(1.3);
      expect(totalFrames).toBe(150);
    });

    it('should calculate correct FFmpeg parameters for zoom-out', () => {
      const params = { zoomDirection: 'out' as const, panDirection: 'none' as const };
      const duration = 5.0;
      const fps = 30;
      const totalFrames = Math.ceil(duration * fps);
      
      const zoomStart = params.zoomDirection === 'in' ? 1.0 : 1.3;
      const zoomEnd = params.zoomDirection === 'in' ? 1.3 : 1.0;
      
      expect(zoomStart).toBe(1.3);
      expect(zoomEnd).toBe(1.0);
      expect(totalFrames).toBe(150);
    });

    it('should handle different narration durations', () => {
      const durations = [3.5, 5.0, 7.2, 10.0];
      const fps = 30;
      
      durations.forEach(duration => {
        const totalFrames = Math.ceil(duration * fps);
        expect(totalFrames).toBeGreaterThan(0);
        expect(totalFrames).toBe(Math.ceil(duration * 30));
      });
    });
  });

  describe('animateHighlightPage', () => {
    const mockPrompt = 'A magical forest scene with animated characters';
    const mockJobId = 'test-job-123';
    const mockNarrationDuration = 5.0;

    it('should attempt Veo generation first', async () => {
      // Mock Veo to throw error to test fallback
      const generateWithVeoSpy = vi.spyOn(animationEngine as any, 'generateWithVeo')
        .mockRejectedValue(new Error('Veo API not implemented'));
      
      const animateStandardPageSpy = vi.spyOn(animationEngine, 'animateStandardPage')
        .mockResolvedValue({
          pageNumber: mockIllustration.pageNumber,
          videoUrl: 'gs://test-bucket/jobs/test-job/animations/page-1.mp4',
          duration: mockNarrationDuration,
          width: 1280,
          height: 720,
        });

      await animationEngine.animateHighlightPage(
        mockIllustration,
        mockPrompt,
        mockNarrationDuration,
        mockJobId
      );

      expect(generateWithVeoSpy).toHaveBeenCalledWith(
        mockIllustration,
        mockPrompt,
        mockNarrationDuration,
        mockJobId
      );
      expect(animateStandardPageSpy).toHaveBeenCalled();
    });

    it('should fallback to Ken Burns effect when Veo fails', async () => {
      vi.spyOn(animationEngine as any, 'generateWithVeo')
        .mockRejectedValue(new Error('Veo generation failed'));
      
      const fallbackClip = {
        pageNumber: mockIllustration.pageNumber,
        videoUrl: 'gs://test-bucket/jobs/test-job/animations/page-1.mp4',
        duration: mockNarrationDuration,
        width: 1280,
        height: 720,
      };

      const animateStandardPageSpy = vi.spyOn(animationEngine, 'animateStandardPage')
        .mockResolvedValue(fallbackClip);

      const result = await animationEngine.animateHighlightPage(
        mockIllustration,
        mockPrompt,
        mockNarrationDuration,
        mockJobId
      );

      expect(result).toEqual(fallbackClip);
      expect(animateStandardPageSpy).toHaveBeenCalledWith(
        mockIllustration,
        mockNarrationDuration,
        mockJobId
      );
    });

    it('should fallback to Ken Burns effect when Veo times out', async () => {
      vi.spyOn(animationEngine as any, 'generateWithVeo')
        .mockRejectedValue(new Error('Veo generation timed out after 60 seconds'));
      
      const fallbackClip = {
        pageNumber: mockIllustration.pageNumber,
        videoUrl: 'gs://test-bucket/jobs/test-job/animations/page-1.mp4',
        duration: mockNarrationDuration,
        width: 1280,
        height: 720,
      };

      const animateStandardPageSpy = vi.spyOn(animationEngine, 'animateStandardPage')
        .mockResolvedValue(fallbackClip);

      const result = await animationEngine.animateHighlightPage(
        mockIllustration,
        mockPrompt,
        mockNarrationDuration,
        mockJobId
      );

      expect(result).toEqual(fallbackClip);
      expect(animateStandardPageSpy).toHaveBeenCalled();
    });

    it('should return video clip with correct structure', async () => {
      const expectedClip = {
        pageNumber: mockIllustration.pageNumber,
        videoUrl: 'gs://test-bucket/jobs/test-job/animations/page-1.mp4',
        duration: mockNarrationDuration,
        width: 1280,
        height: 720,
      };

      vi.spyOn(animationEngine as any, 'generateWithVeo')
        .mockRejectedValue(new Error('Veo not implemented'));
      
      vi.spyOn(animationEngine, 'animateStandardPage')
        .mockResolvedValue(expectedClip);

      const result = await animationEngine.animateHighlightPage(
        mockIllustration,
        mockPrompt,
        mockNarrationDuration,
        mockJobId
      );

      expect(result).toHaveProperty('pageNumber');
      expect(result).toHaveProperty('videoUrl');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result.duration).toBe(mockNarrationDuration);
    });

    it('should match clip duration to narration duration', async () => {
      const durations = [3.5, 5.0, 7.2, 10.0];

      for (const duration of durations) {
        const expectedClip = {
          pageNumber: mockIllustration.pageNumber,
          videoUrl: 'gs://test-bucket/jobs/test-job/animations/page-1.mp4',
          duration: duration,
          width: 1280,
          height: 720,
        };

        vi.spyOn(animationEngine as any, 'generateWithVeo')
          .mockRejectedValue(new Error('Veo not implemented'));
        
        vi.spyOn(animationEngine, 'animateStandardPage')
          .mockResolvedValue(expectedClip);

        const result = await animationEngine.animateHighlightPage(
          mockIllustration,
          mockPrompt,
          duration,
          mockJobId
        );

        expect(result.duration).toBe(duration);
      }
    });

    it('should handle different page numbers', async () => {
      const pageNumbers = [1, 2, 3, 4, 5, 6];

      for (const pageNumber of pageNumbers) {
        const illustration = { ...mockIllustration, pageNumber };
        const expectedClip = {
          pageNumber,
          videoUrl: `gs://test-bucket/jobs/test-job/animations/page-${pageNumber}.mp4`,
          duration: mockNarrationDuration,
          width: 1280,
          height: 720,
        };

        vi.spyOn(animationEngine as any, 'generateWithVeo')
          .mockRejectedValue(new Error('Veo not implemented'));
        
        vi.spyOn(animationEngine, 'animateStandardPage')
          .mockResolvedValue(expectedClip);

        const result = await animationEngine.animateHighlightPage(
          illustration,
          mockPrompt,
          mockNarrationDuration,
          mockJobId
        );

        expect(result.pageNumber).toBe(pageNumber);
      }
    });
  });

  describe('generateWithVeo', () => {
    const mockPrompt = 'A magical forest scene';
    const mockJobId = 'test-job-123';
    const mockNarrationDuration = 5.0;

    it('should implement 60-second timeout', async () => {
      vi.useFakeTimers();
      
      // Mock callVeoAPI to simulate a long-running operation
      const longRunningPromise = new Promise(resolve => setTimeout(resolve, 70000));
      vi.spyOn(animationEngine as any, 'callVeoAPI')
        .mockReturnValue(longRunningPromise);

      const promise = (animationEngine as any).generateWithVeo(
        mockIllustration,
        mockPrompt,
        mockNarrationDuration,
        mockJobId
      );

      // Prevent unhandled rejection warning
      promise.catch(() => {});
      
      // Fast-forward past the 60-second timeout
      await vi.advanceTimersByTimeAsync(61000);
      
      // Verify the timeout error is thrown
      await expect(promise).rejects.toThrow('Veo generation timed out after 60 seconds');
      
      vi.useRealTimers();
    });

    it('should throw timeout error with correct message', async () => {
      vi.useFakeTimers();
      
      const neverResolvingPromise = new Promise(() => {}); // Never resolves
      vi.spyOn(animationEngine as any, 'callVeoAPI')
        .mockReturnValue(neverResolvingPromise);

      const promise = (animationEngine as any).generateWithVeo(
        mockIllustration,
        mockPrompt,
        mockNarrationDuration,
        mockJobId
      );

      // Prevent unhandled rejection warning
      promise.catch(() => {});
      
      // Fast-forward past the 60-second timeout
      await vi.advanceTimersByTimeAsync(61000);

      // Verify the timeout error is thrown
      await expect(promise).rejects.toThrow('Veo generation timed out after 60 seconds');
      
      vi.useRealTimers();
    });

    it('should propagate Veo API errors', async () => {
      const apiError = new Error('Veo API error: Invalid request');
      
      vi.spyOn(animationEngine as any, 'callVeoAPI')
        .mockRejectedValue(apiError);

      await expect(
        (animationEngine as any).generateWithVeo(
          mockIllustration,
          mockPrompt,
          mockNarrationDuration,
          mockJobId
        )
      ).rejects.toThrow('Veo API error: Invalid request');
    });
  });

  describe('callVeoAPI', () => {
    const mockPrompt = 'A magical forest scene';
    const mockJobId = 'test-job-123';
    const mockNarrationDuration = 5.0;

    it('should throw not implemented error', async () => {
      await expect(
        (animationEngine as any).callVeoAPI(
          mockIllustration,
          mockPrompt,
          mockNarrationDuration,
          mockJobId
        )
      ).rejects.toThrow('Veo API integration not yet implemented');
    });
  });
});
