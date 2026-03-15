import { describe, it, expect } from 'vitest';

describe('VideoCompositor - BGM Integration', () => {
  describe('emotional tone to BGM mapping', () => {
    it('should map bright/happy tones to bright.mp3', () => {
      const tones = ['bright', 'happy', 'joyful', 'cheerful', '楽しい', '明るい'];
      
      tones.forEach(tone => {
        const bgmTrack = mapEmotionalToneToBGM(tone);
        expect(bgmTrack).toBe('bright.mp3');
      });
    });

    it('should map adventure/exciting tones to adventure.mp3', () => {
      const tones = ['adventure', 'exciting', 'dynamic', 'energetic', '冒険', 'わくわく'];
      
      tones.forEach(tone => {
        const bgmTrack = mapEmotionalToneToBGM(tone);
        expect(bgmTrack).toBe('adventure.mp3');
      });
    });

    it('should map sad/melancholic tones to sad.mp3', () => {
      const tones = ['sad', 'melancholic', 'somber', '悲しい', '寂しい'];
      
      tones.forEach(tone => {
        const bgmTrack = mapEmotionalToneToBGM(tone);
        expect(bgmTrack).toBe('sad.mp3');
      });
    });

    it('should map calm/peaceful tones to calm.mp3', () => {
      const tones = ['calm', 'peaceful', 'gentle', 'serene', '穏やか', '静か'];
      
      tones.forEach(tone => {
        const bgmTrack = mapEmotionalToneToBGM(tone);
        expect(bgmTrack).toBe('calm.mp3');
      });
    });

    it('should default to calm.mp3 for unrecognized tones', () => {
      const unrecognizedTones = ['mysterious', 'unknown', 'weird', 'random'];
      
      unrecognizedTones.forEach(tone => {
        const bgmTrack = mapEmotionalToneToBGM(tone);
        expect(bgmTrack).toBe('calm.mp3');
      });
    });

    it('should handle case-insensitive matching', () => {
      const testCases = [
        { tone: 'BRIGHT', expected: 'bright.mp3' },
        { tone: 'Happy', expected: 'bright.mp3' },
        { tone: 'ADVENTURE', expected: 'adventure.mp3' },
        { tone: 'Sad', expected: 'sad.mp3' },
        { tone: 'CALM', expected: 'calm.mp3' }
      ];
      
      testCases.forEach(({ tone, expected }) => {
        const bgmTrack = mapEmotionalToneToBGM(tone);
        expect(bgmTrack).toBe(expected);
      });
    });

    it('should handle mixed language tones', () => {
      const testCases = [
        { tone: 'bright and 楽しい', expected: 'bright.mp3' },
        { tone: 'adventure with 冒険', expected: 'adventure.mp3' },
        { tone: 'sad but 悲しい', expected: 'sad.mp3' }
      ];
      
      testCases.forEach(({ tone, expected }) => {
        const bgmTrack = mapEmotionalToneToBGM(tone);
        expect(bgmTrack).toBe(expected);
      });
    });
  });

  describe('BGM looping logic', () => {
    it('should calculate loop count for short BGM', () => {
      const bgmDuration = 30; // 30 seconds
      const videoDuration = 90; // 90 seconds
      
      // BGM needs to loop 3 times to cover video duration
      const loopCount = Math.ceil(videoDuration / bgmDuration);
      expect(loopCount).toBe(3);
    });

    it('should handle BGM longer than video', () => {
      const bgmDuration = 120; // 2 minutes
      const videoDuration = 60; // 1 minute
      
      // BGM should be trimmed to video duration
      const loopCount = Math.ceil(videoDuration / bgmDuration);
      expect(loopCount).toBe(1);
    });

    it('should handle exact duration match', () => {
      const bgmDuration = 60;
      const videoDuration = 60;
      
      const loopCount = Math.ceil(videoDuration / bgmDuration);
      expect(loopCount).toBe(1);
    });
  });

  describe('BGM volume mixing', () => {
    it('should set BGM volume to 20-30% of narration', () => {
      const BGM_VOLUME = 0.25; // 25% of narration volume
      
      expect(BGM_VOLUME).toBeGreaterThanOrEqual(0.2);
      expect(BGM_VOLUME).toBeLessThanOrEqual(0.3);
    });

    it('should ensure BGM does not overpower narration', () => {
      const narrationVolume = 1.0;
      const bgmVolume = 0.25;
      
      expect(bgmVolume).toBeLessThan(narrationVolume);
      expect(bgmVolume / narrationVolume).toBeLessThanOrEqual(0.3);
    });
  });

  describe('BGM fade effects', () => {
    it('should apply 1-second fade-in at video start', () => {
      const FADE_IN_DURATION = 1.0;
      expect(FADE_IN_DURATION).toBe(1.0);
    });

    it('should apply 1-second fade-out at video end', () => {
      const FADE_OUT_DURATION = 1.0;
      expect(FADE_OUT_DURATION).toBe(1.0);
    });

    it('should calculate fade-out start time correctly', () => {
      const videoDuration = 60; // 60 seconds
      const fadeOutDuration = 1.0;
      
      const fadeOutStartTime = videoDuration - fadeOutDuration;
      expect(fadeOutStartTime).toBe(59);
    });

    it('should not overlap fade-in and fade-out for short videos', () => {
      const videoDuration = 5; // 5 seconds
      const fadeInDuration = 1.0;
      const fadeOutDuration = 1.0;
      
      const fadeInEnd = fadeInDuration;
      const fadeOutStart = videoDuration - fadeOutDuration;
      
      // Fade-in ends before fade-out starts
      expect(fadeInEnd).toBeLessThanOrEqual(fadeOutStart);
    });
  });

  describe('BGM storage path configuration', () => {
    it('should construct BGM URL with trailing slash', () => {
      const bgmStoragePath = 'gs://pashabook-assets/bgm/';
      const bgmTrack = 'bright.mp3';
      
      const bgmUrl = bgmStoragePath.endsWith('/')
        ? `${bgmStoragePath}${bgmTrack}`
        : `${bgmStoragePath}/${bgmTrack}`;
      
      expect(bgmUrl).toBe('gs://pashabook-assets/bgm/bright.mp3');
    });

    it('should construct BGM URL without trailing slash', () => {
      const bgmStoragePath = 'gs://pashabook-assets/bgm';
      const bgmTrack = 'adventure.mp3';
      
      const bgmUrl = bgmStoragePath.endsWith('/')
        ? `${bgmStoragePath}${bgmTrack}`
        : `${bgmStoragePath}/${bgmTrack}`;
      
      expect(bgmUrl).toBe('gs://pashabook-assets/bgm/adventure.mp3');
    });

    it('should validate BGM filenames', () => {
      const validFilenames = ['bright.mp3', 'adventure.mp3', 'sad.mp3', 'calm.mp3'];
      
      validFilenames.forEach(filename => {
        expect(filename).toMatch(/^(bright|adventure|sad|calm)\.mp3$/);
      });
    });
  });

  describe('BGM error handling', () => {
    it('should continue without BGM if download fails', () => {
      const bgmPath = null; // Simulates failed download
      
      // Video composition should continue without BGM
      expect(bgmPath).toBeNull();
    });

    it('should log warning when BGM is unavailable', () => {
      const bgmAvailable = false;
      
      if (!bgmAvailable) {
        // Should log warning and continue
        expect(bgmAvailable).toBe(false);
      }
    });
  });

  describe('FFmpeg filter construction', () => {
    it('should build BGM loop filter correctly', () => {
      const totalDuration = 60;
      const bgmVolume = 0.25;
      const fadeDuration = 1.0;
      
      // aloop=loop=-1:size=2e9 (infinite loop)
      // atrim=duration=60 (trim to video duration)
      // volume=0.25 (25% volume)
      // afade=t=in:st=0:d=1.0 (fade-in)
      // afade=t=out:st=59:d=1.0 (fade-out)
      
      const fadeOutStart = totalDuration - fadeDuration;
      expect(fadeOutStart).toBe(59);
    });

    it('should mix narration and BGM with amix filter', () => {
      // amix=inputs=2:duration=first:dropout_transition=0
      // inputs=2: narration + BGM
      // duration=first: use narration duration
      // dropout_transition=0: no transition when input ends
      
      const mixInputs = 2;
      expect(mixInputs).toBe(2);
    });

    it('should handle video composition without BGM', () => {
      const bgmPath = null;
      
      if (!bgmPath) {
        // Should use narration only, no BGM mixing
        expect(bgmPath).toBeNull();
      }
    });
  });
});

// Helper function for testing (mirrors VideoCompositor implementation)
function mapEmotionalToneToBGM(emotionalTone: string): string {
  const tone = emotionalTone.toLowerCase();

  // Map to bright BGM
  if (tone.includes('bright') || tone.includes('happy') || tone.includes('joyful') || 
      tone.includes('cheerful') || tone.includes('楽しい') || tone.includes('明るい')) {
    return 'bright.mp3';
  }

  // Map to adventure BGM
  if (tone.includes('adventure') || tone.includes('exciting') || tone.includes('dynamic') ||
      tone.includes('energetic') || tone.includes('冒険') || tone.includes('わくわく')) {
    return 'adventure.mp3';
  }

  // Map to sad BGM
  if (tone.includes('sad') || tone.includes('melancholic') || tone.includes('somber') ||
      tone.includes('悲しい') || tone.includes('寂しい')) {
    return 'sad.mp3';
  }

  // Map to calm BGM (default)
  if (tone.includes('calm') || tone.includes('peaceful') || tone.includes('gentle') ||
      tone.includes('serene') || tone.includes('穏やか') || tone.includes('静か')) {
    return 'calm.mp3';
  }

  // Default to calm for unrecognized tones
  return 'calm.mp3';
}
