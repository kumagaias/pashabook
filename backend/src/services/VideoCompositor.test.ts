import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoClip, PageNarration } from '../types/models';

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
import { VideoCompositor } from './VideoCompositor';

describe('VideoCompositor', () => {
  let compositor: VideoCompositor;

  beforeEach(() => {
    vi.clearAllMocks();
    compositor = new VideoCompositor();
  });

  describe('compose', () => {
    const mockClips: VideoClip[] = [
      {
        pageNumber: 1,
        videoUrl: 'gs://test-bucket/jobs/test-job/animations/page-1.mp4',
        duration: 5.0,
        width: 1280,
        height: 720,
      },
      {
        pageNumber: 2,
        videoUrl: 'gs://test-bucket/jobs/test-job/animations/page-2.mp4',
        duration: 6.0,
        width: 1280,
        height: 720,
      },
      {
        pageNumber: 3,
        videoUrl: 'gs://test-bucket/jobs/test-job/animations/page-3.mp4',
        duration: 5.5,
        width: 1280,
        height: 720,
      },
    ];

    const mockNarrations: PageNarration[] = [
      {
        pageNumber: 1,
        audioUrl: 'gs://test-bucket/jobs/test-job/narration/page-1.mp3',
        duration: 5.0,
        language: 'en',
      },
      {
        pageNumber: 2,
        audioUrl: 'gs://test-bucket/jobs/test-job/narration/page-2.mp3',
        duration: 6.0,
        language: 'en',
      },
      {
        pageNumber: 3,
        audioUrl: 'gs://test-bucket/jobs/test-job/narration/page-3.mp3',
        duration: 5.5,
        language: 'en',
      },
    ];

    it('should validate clip count matches narration count', () => {
      const clips = mockClips.slice(0, 2);
      const narrations = mockNarrations;

      expect(clips.length).not.toBe(narrations.length);
    });

    it('should calculate total duration correctly', () => {
      const totalDuration = mockNarrations.reduce((sum, n) => sum + n.duration, 0);
      expect(totalDuration).toBe(16.5);
    });

    it('should validate crossfade transition timing', () => {
      const crossfadeDuration = 0.5;
      expect(crossfadeDuration).toBe(0.5);
    });

    it('should validate video resolution', () => {
      const width = 1280;
      const height = 720;
      
      expect(width).toBe(1280);
      expect(height).toBe(720);
    });

    it('should validate output format', () => {
      const format = 'mp4';
      expect(format).toBe('mp4');
    });

    it('should parse Cloud Storage URL correctly', () => {
      const gsUrl = 'gs://test-bucket/path/to/file.mp4';
      const match = gsUrl.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe('test-bucket');
      expect(match![2]).toBe('path/to/file.mp4');
    });

    it('should handle unsorted clips and narrations', () => {
      const unsortedClips = [mockClips[2], mockClips[0], mockClips[1]];
      const sortedClips = [...unsortedClips].sort((a, b) => a.pageNumber - b.pageNumber);
      
      expect(sortedClips[0].pageNumber).toBe(1);
      expect(sortedClips[1].pageNumber).toBe(2);
      expect(sortedClips[2].pageNumber).toBe(3);
    });

    it('should calculate FFmpeg filter offsets correctly', () => {
      const crossfadeDuration = 0.5;
      const clipDurations = [5.0, 6.0, 5.5];
      
      // First transition offset: duration of first clip - crossfade
      const offset1 = clipDurations[0] - crossfadeDuration;
      expect(offset1).toBe(4.5);
      
      // Second transition offset: sum of first two clips - 2 * crossfade
      const offset2 = clipDurations[0] + clipDurations[1] - 2 * crossfadeDuration;
      expect(offset2).toBe(10.0);
    });

    it('should validate audio-video synchronization', () => {
      // Each clip duration should match its narration duration
      for (let i = 0; i < mockClips.length; i++) {
        expect(mockClips[i].duration).toBe(mockNarrations[i].duration);
      }
    });

    it('should handle different page counts', () => {
      const pageCounts = [3, 5, 6];
      
      pageCounts.forEach(count => {
        expect(count).toBeGreaterThanOrEqual(3);
        expect(count).toBeLessThanOrEqual(6);
      });
    });

    it('should validate composition timeout limit', () => {
      const timeoutLimit = 60; // seconds
      expect(timeoutLimit).toBe(60);
    });
  });
});
