import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeApp,
  getApps,
} from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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

describe('FCM Token Management', () => {
  const mockAuth = {
    currentUser: null,
  };

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    getIdToken: jest.fn().mockResolvedValue('test-id-token'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
      }),
    });
  });

  describe('Requirement 11.6: Register for push notifications on app launch', () => {
    it('should register for push notifications when user authenticates', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
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

      // Wait for FCM setup to complete (async effect)
      await waitFor(() => {
        expect(notificationService.registerForPushNotifications).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should not register for push notifications when user is not authenticated', async () => {
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(notificationService.registerForPushNotifications).not.toHaveBeenCalled();
      });
    });
  });

  describe('Requirement 11.7: Store FCM token in UserProfile.fcmToken field', () => {
    it('should store FCM token in Firestore when token is available', async () => {
      const mockFCMToken = 'ExponentPushToken[test-token-123]';
      (notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(mockFCMToken);
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
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

      // Wait for FCM setup to complete (async effect)
      await waitFor(() => {
        expect(notificationService.updateFCMToken).toHaveBeenCalledWith(
          mockFCMToken,
          'test-id-token'
        );
      }, { timeout: 2000 });
    });

    it('should not call updateFCMToken when token is null', async () => {
      (notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(null);
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
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

      // Wait a bit to ensure updateFCMToken is not called
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(notificationService.updateFCMToken).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 11.8: Listen for token refresh events and update Firestore', () => {
    it('should re-register for push notifications on each authentication', async () => {
      const mockFCMToken = 'ExponentPushToken[refreshed-token]';
      (notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(mockFCMToken);
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      let authCallback: any;
      (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // First authentication
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
        authCallback(mockUser);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await waitFor(() => {
        expect(notificationService.registerForPushNotifications).toHaveBeenCalledTimes(1);
      }, { timeout: 2000 });

      // Simulate token refresh by triggering auth state change again
      const newMockUser = { ...mockUser, uid: 'test-user-id-2' };
      await act(async () => {
        authCallback(newMockUser);
      });

      // Should register again for the new user
      await waitFor(() => {
        expect(notificationService.registerForPushNotifications).toHaveBeenCalledTimes(2);
      }, { timeout: 2000 });
    });
  });

  describe('Requirement 11.9: Handle permission denied gracefully', () => {
    it('should continue app operation when notification permission is denied', async () => {
      (notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(null);
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
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

      // App should continue working normally
      expect(result.current.user).toEqual({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('should handle FCM setup errors gracefully without blocking authentication', async () => {
      (notificationService.registerForPushNotifications as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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

      // Error should be logged but not thrown
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error setting up FCM:',
          expect.any(Error)
        );
      }, { timeout: 2000 });

      // App should continue working
      expect(result.current.user).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Notification listeners setup', () => {
    it('should setup notification listeners on mount', async () => {
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(notificationService.setupNotificationListener).toHaveBeenCalled();
        expect(notificationService.setupNotificationResponseListener).toHaveBeenCalled();
      });
    });

    it('should cleanup notification listeners on unmount', async () => {
      const mockForegroundRemove = jest.fn();
      const mockResponseRemove = jest.fn();
      (notificationService.setupNotificationListener as jest.Mock).mockReturnValue({ remove: mockForegroundRemove });
      (notificationService.setupNotificationResponseListener as jest.Mock).mockReturnValue({ remove: mockResponseRemove });

      const { unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(notificationService.setupNotificationListener).toHaveBeenCalled();
      });

      unmount();

      // Each listener should be removed once
      expect(mockForegroundRemove).toHaveBeenCalledTimes(1);
      expect(mockResponseRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with authentication flow', () => {
    it('should complete full FCM registration flow on successful login', async () => {
      const mockFCMToken = 'ExponentPushToken[integration-test]';
      (notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(mockFCMToken);
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
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

      // Verify complete flow
      await waitFor(() => {
        expect(notificationService.registerForPushNotifications).toHaveBeenCalled();
        expect(mockUser.getIdToken).toHaveBeenCalled();
        expect(notificationService.updateFCMToken).toHaveBeenCalledWith(
          mockFCMToken,
          'test-id-token'
        );
      }, { timeout: 2000 });
    });
  });
});
