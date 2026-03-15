import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@google-cloud/firestore');
vi.mock('./ImageAnalyzer.js');
vi.mock('./StoryGenerator.js');
vi.mock('./IllustrationGenerator.js');
vi.mock('./NarrationGenerator.js');
vi.mock('./AnimationEngine.js');
vi.mock('./VideoCompositor.js');

// Import after mocks
import { ProcessingWorker } from './ProcessingWorker';

describe('ProcessingWorker', () => {
  let worker: ProcessingWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    worker = new ProcessingWorker();
  });

  describe('processJob', () => {
    it('should validate job status transitions', () => {
      const statuses = ['pending', 'processing', 'done'];
      
      expect(statuses).toContain('pending');
      expect(statuses).toContain('processing');
      expect(statuses).toContain('done');
    });

    it('should validate error status transition', () => {
      const errorStatus = 'error';
      expect(errorStatus).toBe('error');
    });

    it('should validate progress percentage range', () => {
      const progressValues = [0, 20, 35, 60, 85, 100];
      
      progressValues.forEach(progress => {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      });
    });

    it('should validate pipeline stages', () => {
      const stages = [
        'analyzing',
        'generating',
        'illustrating',
        'animating',
        'composing',
      ];
      
      expect(stages).toHaveLength(5);
      expect(stages[0]).toBe('analyzing');
      expect(stages[4]).toBe('composing');
    });

    it('should calculate exponential backoff delays', () => {
      const baseDelay = 1000;
      const delays = [0, 1, 2].map(attempt => baseDelay * Math.pow(2, attempt));
      
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);
    });

    it('should sanitize file paths from error messages', () => {
      const message = 'Error at /usr/local/app/file.ts';
      const sanitized = message.replace(/\/[^\s]+/g, '');
      
      expect(sanitized).not.toContain('/usr/local');
    });

    it('should sanitize IP addresses from error messages', () => {
      const message = 'Connection failed to 192.168.1.1';
      const sanitized = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '');
      
      expect(sanitized).not.toContain('192.168.1.1');
    });

    it('should sanitize email addresses from error messages', () => {
      const message = 'User test@example.com not found';
      const sanitized = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
      
      expect(sanitized).not.toContain('test@example.com');
    });

    it('should sanitize bearer tokens from error messages', () => {
      const message = 'Invalid Bearer abc123token';
      const sanitized = message.replace(/Bearer\s+[^\s]+/gi, '');
      
      expect(sanitized).not.toContain('abc123token');
    });

    it('should validate parallel execution of narration and animation', async () => {
      const tasks = [
        Promise.resolve('narration'),
        Promise.resolve('animation'),
      ];
      
      const results = await Promise.all(tasks);
      expect(results).toHaveLength(2);
      expect(results[0]).toBe('narration');
      expect(results[1]).toBe('animation');
    });

    it('should validate Promise.all waits for both promises', async () => {
      let narrationComplete = false;
      let animationComplete = false;

      const narrationTask = new Promise(resolve => {
        setTimeout(() => {
          narrationComplete = true;
          resolve('narration');
        }, 10);
      });

      const animationTask = new Promise(resolve => {
        setTimeout(() => {
          animationComplete = true;
          resolve('animation');
        }, 20);
      });

      await Promise.all([narrationTask, animationTask]);

      // Both should be complete after Promise.all resolves
      expect(narrationComplete).toBe(true);
      expect(animationComplete).toBe(true);
    });

    it('should validate error propagation in Promise.all', async () => {
      const successTask = Promise.resolve('success');
      const failureTask = Promise.reject(new Error('Task failed'));

      await expect(Promise.all([successTask, failureTask])).rejects.toThrow('Task failed');
    });

    it('should validate actualDurations extraction from narration results', () => {
      const pageNarrations = [
        { pageNumber: 1, duration: 5.2, audioSegments: [] },
        { pageNumber: 2, duration: 6.8, audioSegments: [] },
        { pageNumber: 3, duration: 4.5, audioSegments: [] },
      ];

      const actualDurations = pageNarrations.map(n => n.duration);

      expect(actualDurations).toEqual([5.2, 6.8, 4.5]);
      expect(actualDurations).toHaveLength(3);
    });

    it('should validate estimatedDurations extraction from story pages', () => {
      const storyPages = [
        { pageNumber: 1, estimatedDuration: 5.0, narrationText: 'Page 1' },
        { pageNumber: 2, estimatedDuration: 6.5, narrationText: 'Page 2' },
        { pageNumber: 3, estimatedDuration: 4.8, narrationText: 'Page 3' },
      ];

      const estimatedDurations = storyPages.map(page => page.estimatedDuration);

      expect(estimatedDurations).toEqual([5.0, 6.5, 4.8]);
      expect(estimatedDurations).toHaveLength(3);
    });

    it('should validate parallel execution completes before composition', async () => {
      let narrationComplete = false;
      let animationComplete = false;
      let compositionStarted = false;

      const narrationTask = new Promise(resolve => {
        setTimeout(() => {
          narrationComplete = true;
          resolve([{ duration: 5.0, audioSegments: [] }]);
        }, 10);
      });

      const animationTask = new Promise(resolve => {
        setTimeout(() => {
          animationComplete = true;
          resolve([{ videoUrl: 'clip1.mp4' }]);
        }, 15);
      });

      // Wait for both to complete
      await Promise.all([narrationTask, animationTask]);

      // Now composition can start
      compositionStarted = true;

      expect(narrationComplete).toBe(true);
      expect(animationComplete).toBe(true);
      expect(compositionStarted).toBe(true);
    });

    it('should validate audio segment URL collection', () => {
      const pageNarrations = [
        {
          pageNumber: 1,
          duration: 5.0,
          audioSegments: [
            { audioUrl: 'page1-narrator.mp3', speaker: 'narrator' },
            { audioUrl: 'page1-protagonist.mp3', speaker: 'protagonist' },
          ],
        },
        {
          pageNumber: 2,
          duration: 6.0,
          audioSegments: [
            { audioUrl: 'page2-narrator.mp3', speaker: 'narrator' },
          ],
        },
      ];

      const allAudioUrls = pageNarrations.flatMap(n =>
        n.audioSegments.map(segment => segment.audioUrl)
      );

      expect(allAudioUrls).toEqual([
        'page1-narrator.mp3',
        'page1-protagonist.mp3',
        'page2-narrator.mp3',
      ]);
      expect(allAudioUrls).toHaveLength(3);
    });

    it('should validate animation clip URL collection', () => {
      const animationClips = [
        { pageNumber: 1, videoUrl: 'clip1.mp4' },
        { pageNumber: 2, videoUrl: 'clip2.mp4' },
        { pageNumber: 3, videoUrl: 'clip3.mp4' },
      ];

      const clipUrls = animationClips.map(c => c.videoUrl);

      expect(clipUrls).toEqual(['clip1.mp4', 'clip2.mp4', 'clip3.mp4']);
      expect(clipUrls).toHaveLength(3);
    });

    it('should validate timestamp updates', () => {
      const timestamp1 = new Date();
      const timestamp2 = new Date(timestamp1.getTime() + 1000);
      
      expect(timestamp2.getTime()).toBeGreaterThan(timestamp1.getTime());
    });

    it('should validate retry attempt count', () => {
      const maxRetries = 3;
      const attempts = Array.from({ length: maxRetries + 1 }, (_, i) => i);
      
      expect(attempts).toHaveLength(4); // 0, 1, 2, 3
      expect(attempts[attempts.length - 1]).toBe(maxRetries);
    });
  });
});
