import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { LanguageProvider, useLanguage } from '../language-context';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

describe('LanguageContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Language switching', () => {
    it('should initialize with device language (Japanese)', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'ja' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('ja');
    });

    it('should initialize with device language (English)', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('en');
    });

    it('should default to English for unsupported languages', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'fr' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('en');
    });

    it('should switch language from Japanese to English', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'ja' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('ja');

      await act(async () => {
        await result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pashabook_language',
        'en'
      );
    });

    it('should switch language from English to Japanese', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('en');

      await act(async () => {
        await result.current.setLanguage('ja');
      });

      expect(result.current.language).toBe('ja');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pashabook_language',
        'ja'
      );
    });

    it('should handle language switch errors gracefully', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.setLanguage('ja');
        })
      ).rejects.toThrow('Storage error');

      // Language should not change on error
      expect(result.current.language).toBe('en');
    });
  });

  describe('AsyncStorage persistence', () => {
    it('should load stored language preference on mount', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ja');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('ja');
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@pashabook_language');
    });

    it('should persist language preference to AsyncStorage', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setLanguage('ja');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pashabook_language',
        'ja'
      );
    });

    it('should save device language on first launch', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'ja' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pashabook_language',
        'ja'
      );
    });

    it('should handle AsyncStorage load errors gracefully', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to device language
      expect(result.current.language).toBe('en');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading language:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should ignore invalid stored language values', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid');
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should use device language and save it
      expect(result.current.language).toBe('en');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pashabook_language',
        'en'
      );
    });
  });

  describe('Loading state', () => {
    it('should start with isLoading true', () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should set isLoading false after loading', async () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([
        { languageCode: 'en' },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Context usage', () => {
    it('should throw error when used outside provider', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow('useLanguage must be used within a LanguageProvider');

      consoleErrorSpy.mockRestore();
    });
  });
});
