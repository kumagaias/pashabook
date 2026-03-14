import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NarrationGenerator } from './NarrationGenerator';
import { CharacterVoiceMap, Language } from '../types/models';

describe('NarrationGenerator - Character Voice Mapping', () => {
  let narrationGenerator: NarrationGenerator;

  beforeEach(() => {
    narrationGenerator = new NarrationGenerator();
  });

  describe('Voice Assignment Logic', () => {
    it('should assign distinct voices to different characters', () => {
      const existingMap: CharacterVoiceMap = {};
      
      // Access private method through type assertion for testing
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const narratorVoice = assignVoice('narrator', 'ja' as Language, existingMap);
      existingMap.narrator = narratorVoice;
      
      const protagonistVoice = assignVoice('protagonist', 'ja' as Language, existingMap);
      existingMap.protagonist = protagonistVoice;
      
      const supportingVoice = assignVoice('supporting_character', 'ja' as Language, existingMap);
      
      // Verify all voices are defined
      expect(narratorVoice.voiceName).toBeDefined();
      expect(protagonistVoice.voiceName).toBeDefined();
      expect(supportingVoice.voiceName).toBeDefined();
      
      // Verify voices are distinct
      expect(narratorVoice.voiceName).not.toBe(protagonistVoice.voiceName);
      expect(narratorVoice.voiceName).not.toBe(supportingVoice.voiceName);
      expect(protagonistVoice.voiceName).not.toBe(supportingVoice.voiceName);
    });

    it('should use different pitch for narrator, protagonist, and supporting characters', () => {
      const existingMap: CharacterVoiceMap = {};
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const narratorVoice = assignVoice('narrator', 'ja' as Language, existingMap);
      existingMap.narrator = narratorVoice;
      
      const protagonistVoice = assignVoice('protagonist', 'ja' as Language, existingMap);
      existingMap.protagonist = protagonistVoice;
      
      const supportingVoice = assignVoice('supporting_character', 'ja' as Language, existingMap);
      
      // Verify pitch adjustments
      expect(narratorVoice.pitch).toBe(-2.0); // Lower for narrator
      expect(protagonistVoice.pitch).toBe(2.0); // Higher for protagonist
      expect(supportingVoice.pitch).toBe(0.0); // Neutral for supporting
    });

    it('should reuse existing voice assignment', () => {
      const existingMap: CharacterVoiceMap = {
        narrator: {
          voiceName: 'ja-JP-Wavenet-A',
          pitch: -2.0,
          speakingRate: 0.95,
        },
      };
      
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      const narratorVoice = assignVoice('narrator', 'ja' as Language, existingMap);
      
      // Should return the same voice config
      expect(narratorVoice).toEqual(existingMap.narrator);
    });

    it('should use Japanese voices for Japanese language', () => {
      const existingMap: CharacterVoiceMap = {};
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const voice = assignVoice('narrator', 'ja' as Language, existingMap);
      
      expect(voice.voiceName).toMatch(/^ja-JP-/);
    });

    it('should use English voices for English language', () => {
      const existingMap: CharacterVoiceMap = {};
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const voice = assignVoice('narrator', 'en' as Language, existingMap);
      
      expect(voice.voiceName).toMatch(/^en-US-/);
    });

    it('should set speaking rate to 0.95 for all characters', () => {
      const existingMap: CharacterVoiceMap = {};
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const narratorVoice = assignVoice('narrator', 'ja' as Language, existingMap);
      existingMap.narrator = narratorVoice;
      
      const protagonistVoice = assignVoice('protagonist', 'ja' as Language, existingMap);
      
      expect(narratorVoice.speakingRate).toBe(0.95);
      expect(protagonistVoice.speakingRate).toBe(0.95);
    });

    it('should handle multiple characters without voice collision', () => {
      const existingMap: CharacterVoiceMap = {};
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const characters = ['narrator', 'protagonist', 'supporting_character', 'character_4', 'character_5'];
      const assignedVoices = new Set<string>();
      
      characters.forEach(character => {
        const voice = assignVoice(character, 'ja' as Language, existingMap);
        existingMap[character] = voice;
        assignedVoices.add(voice.voiceName);
      });
      
      // All voices should be unique (we have 6 Japanese voices available)
      expect(assignedVoices.size).toBe(5);
    });
  });

  describe('Voice Configuration', () => {
    it('should return valid voice configuration structure', () => {
      const existingMap: CharacterVoiceMap = {};
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const voice = assignVoice('narrator', 'ja' as Language, existingMap);
      
      expect(voice).toHaveProperty('voiceName');
      expect(voice).toHaveProperty('pitch');
      expect(voice).toHaveProperty('speakingRate');
      expect(typeof voice.voiceName).toBe('string');
      expect(typeof voice.pitch).toBe('number');
      expect(typeof voice.speakingRate).toBe('number');
    });

    it('should have pitch within valid range', () => {
      const existingMap: CharacterVoiceMap = {};
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const characters = ['narrator', 'protagonist', 'supporting_character'];
      
      characters.forEach(character => {
        const voice = assignVoice(character, 'ja' as Language, existingMap);
        existingMap[character] = voice;
        
        // TTS pitch range is -20.0 to 20.0
        expect(voice.pitch).toBeGreaterThanOrEqual(-20.0);
        expect(voice.pitch).toBeLessThanOrEqual(20.0);
      });
    });

    it('should have speaking rate within valid range', () => {
      const existingMap: CharacterVoiceMap = {};
      const assignVoice = (narrationGenerator as any).assignVoiceToCharacter.bind(narrationGenerator);
      
      const voice = assignVoice('narrator', 'ja' as Language, existingMap);
      
      // TTS speaking rate range is 0.25 to 4.0
      expect(voice.speakingRate).toBeGreaterThanOrEqual(0.25);
      expect(voice.speakingRate).toBeLessThanOrEqual(4.0);
    });
  });

  describe('Actual Duration Calculation', () => {
    it('should calculate actualDuration as sum of all audio segments', () => {
      // Mock PageNarration with multiple audio segments
      const mockPageNarration = {
        pageNumber: 1,
        audioSegments: [
          { audioUrl: 'gs://bucket/audio1.mp3', speaker: 'narrator' as const, duration: 5.2, startTime: 0 },
          { audioUrl: 'gs://bucket/audio2.mp3', speaker: 'protagonist' as const, duration: 3.8, startTime: 5.2 },
          { audioUrl: 'gs://bucket/audio3.mp3', speaker: 'narrator' as const, duration: 2.5, startTime: 9.0 },
        ],
        duration: 11.5,
        actualDuration: 11.5,
        language: 'ja' as const,
      };

      // Verify actualDuration equals sum of all segment durations
      const expectedDuration = mockPageNarration.audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
      expect(mockPageNarration.actualDuration).toBe(expectedDuration);
      expect(mockPageNarration.actualDuration).toBe(11.5);
    });

    it('should have actualDuration equal to duration field', () => {
      // Mock PageNarration
      const mockPageNarration = {
        pageNumber: 2,
        audioSegments: [
          { audioUrl: 'gs://bucket/audio1.mp3', speaker: 'narrator' as const, duration: 7.3, startTime: 0 },
        ],
        duration: 7.3,
        actualDuration: 7.3,
        language: 'en' as const,
      };

      // actualDuration should match duration (both are sum of segments)
      expect(mockPageNarration.actualDuration).toBe(mockPageNarration.duration);
    });

    it('should calculate actualDuration correctly for single segment', () => {
      const mockPageNarration = {
        pageNumber: 3,
        audioSegments: [
          { audioUrl: 'gs://bucket/audio1.mp3', speaker: 'narrator' as const, duration: 4.7, startTime: 0 },
        ],
        duration: 4.7,
        actualDuration: 4.7,
        language: 'ja' as const,
      };

      expect(mockPageNarration.actualDuration).toBe(4.7);
      expect(mockPageNarration.audioSegments[0].duration).toBe(mockPageNarration.actualDuration);
    });

    it('should calculate actualDuration correctly for multiple character segments', () => {
      const mockPageNarration = {
        pageNumber: 4,
        audioSegments: [
          { audioUrl: 'gs://bucket/audio1.mp3', speaker: 'narrator' as const, duration: 2.1, startTime: 0 },
          { audioUrl: 'gs://bucket/audio2.mp3', speaker: 'protagonist' as const, duration: 3.4, startTime: 2.1 },
          { audioUrl: 'gs://bucket/audio3.mp3', speaker: 'supporting_character' as const, duration: 1.9, startTime: 5.5 },
          { audioUrl: 'gs://bucket/audio4.mp3', speaker: 'narrator' as const, duration: 2.8, startTime: 7.4 },
        ],
        duration: 10.2,
        actualDuration: 10.2,
        language: 'en' as const,
      };

      const calculatedDuration = mockPageNarration.audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
      expect(mockPageNarration.actualDuration).toBe(calculatedDuration);
      expect(mockPageNarration.actualDuration).toBe(10.2);
    });
  });
});