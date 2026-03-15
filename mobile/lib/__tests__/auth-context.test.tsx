import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeApp,
  getApps,
} from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { AuthProvider, useAuth } from '../auth-context';
import * as notificationService from '../notification-service';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
}));

// Mock notification service
jest.mock('../notification-service', () => ({
  registerForPushNotifications: jest.fn(),
  updateFCMToken: jest.fn(),
  setupNotificationListener: jest.fn(),
  setupNotificationResponseListener: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('AuthContext', () => {
  const mockAuth = {
    currentUser: null,
  };

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    getIdToken: jest.fn().mockResolvedValue('test-token'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks to default behavior
    (getApps as jest.Mock).mockReturnValue([]);
    (initializeApp as jest.Mock).mockReturnValue({});
    (getAuth as jest.Mock).mockReturnValue(mockAuth);
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      callback(null);
      return jest.fn();
    });
    (notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(null);
    (notificationService.updateFCMToken as jest.Mock).mockResolvedValue(true);
    (notificationService.setupNotificationListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
    (notificationService.setupNotificationResponseListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
  });

  describe('AsyncStorage persistence', () => {
    it('should store auth token in AsyncStorage on login', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          userId: 'test-user-id',
          name: 'Test User',
          email: 'test@example.com',
        }),
      });

      // Setup onAuthStateChanged to call callback with user
      (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pashabook_token',
        'test-token'
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pashabook_user',
        expect.stringContaining('test-user-id')
      );
    });

    it('should clear AsyncStorage on logout', async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pashabook_token');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pashabook_user');
    });

    it('should retrieve ID token from AsyncStorage when user is not available', async () => {
      mockAuth.currentUser = null;
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('stored-token');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const token = await result.current.getIdToken();

      expect(token).toBe('stored-token');
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@pashabook_token');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      // Should handle error and clear user data
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Authentication state', () => {
    it('should initialize with unauthenticated state', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should update state when user logs in', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          userId: 'test-user-id',
          name: 'Test User',
          email: 'test@example.com',
        }),
      });

      (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.user).toEqual({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('should update state when user logs out', async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          userId: 'test-user-id',
          name: 'Test User',
          email: 'test@example.com',
        }),
      });

      // Start with authenticated user
      let authCallback: any;
      (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(mockUser);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Simulate logout - call signOut and trigger auth state change
      await act(async () => {
        await result.current.logout();
        // Simulate Firebase auth state change to null
        authCallback(null);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(signOut).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pashabook_token');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pashabook_user');
    });

    it('should handle registration and create user profile', async () => {
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.register(
          'Test User',
          'test@example.com',
          'password123'
        );
      });

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/register'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Test User',
            email: 'test@example.com',
          }),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle login errors with user-friendly messages', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/invalid-credential',
        message: 'Invalid credentials',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrong-password');
        })
      ).rejects.toThrow('Invalid email or password. Please try again.');
    });

    it('should handle registration errors', async () => {
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'Email already in use',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await expect(
        act(async () => {
          await result.current.register(
            'Test User',
            'existing@example.com',
            'password123'
          );
        })
      ).rejects.toThrow(
        'This email is already registered. Please login instead.'
      );
    });

    it('should validate email and password on login', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await expect(
        act(async () => {
          await result.current.login('', '');
        })
      ).rejects.toThrow('Email and password are required');
    });

    it('should validate password length on registration', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await expect(
        act(async () => {
          await result.current.register('Test', 'test@example.com', '12345');
        })
      ).rejects.toThrow('Email and password (min 6 characters) are required');
    });
  });

  describe('Loading state', () => {
    it('should start with isLoading true', () => {
      (onAuthStateChanged as jest.Mock).mockImplementation(() => {
        return jest.fn(); // Don't call callback immediately
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should set isLoading false after auth state is determined', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

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
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleErrorSpy.mockRestore();
    });
  });
});
