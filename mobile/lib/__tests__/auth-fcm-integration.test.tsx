import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../auth-context';
import * as NotificationService from '../notification-service';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

// Mock notification service
jest.mock('../notification-service', () => ({
  registerForPushNotifications: jest.fn(),
  updateFCMToken: jest.fn(),
  setupNotificationListener: jest.fn(() => ({ remove: jest.fn() })),
  setupNotificationResponseListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSegments: () => [],
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Auth FCM Integration', () => {
  let mockAuth: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock auth object
    mockAuth = {
      currentUser: null,
    };
    
    (getAuth as jest.Mock).mockReturnValue(mockAuth);
    
    // Mock fetch to return successful profile response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
      }),
    });
  });

  it('should register for push notifications when user is authenticated', async () => {
    const mockUser = {
      uid: 'test-user-123',
      email: 'test@example.com',
      getIdToken: jest.fn().mockResolvedValue('test-id-token'),
    };

    (NotificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(
      'ExponentPushToken[test-token]'
    );
    (NotificationService.updateFCMToken as jest.Mock).mockResolvedValue(true);

    // Mock auth state change
    let authStateCallback: any;
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      authStateCallback = callback;
      return jest.fn();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    // Simulate user login - update the mock auth object
    mockAuth.currentUser = mockUser;

    await waitFor(() => {
      if (authStateCallback) {
        authStateCallback(mockUser);
      }
    });

    // Wait for FCM setup
    await waitFor(
      () => {
        expect(NotificationService.registerForPushNotifications).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    expect(NotificationService.updateFCMToken).toHaveBeenCalledWith(
      'ExponentPushToken[test-token]',
      'test-id-token'
    );
  });

  it('should handle FCM registration failure gracefully', async () => {
    const mockUser = {
      uid: 'test-user-123',
      email: 'test@example.com',
      getIdToken: jest.fn().mockResolvedValue('test-id-token'),
    };

    // Simulate permission denied
    (NotificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(null);

    let authStateCallback: any;
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      authStateCallback = callback;
      return jest.fn();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    // Simulate user login - update the mock auth object
    mockAuth.currentUser = mockUser;

    await waitFor(() => {
      if (authStateCallback) {
        authStateCallback(mockUser);
      }
    });

    // Wait for FCM setup attempt
    await waitFor(
      () => {
        expect(NotificationService.registerForPushNotifications).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Should not call updateFCMToken if registration returns null
    expect(NotificationService.updateFCMToken).not.toHaveBeenCalled();
  });

  it('should setup notification response listener', async () => {
    const mockRemove = jest.fn();
    (NotificationService.setupNotificationResponseListener as jest.Mock).mockReturnValue({
      remove: mockRemove,
    });

    let authStateCallback: any;
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      authStateCallback = callback;
      return jest.fn();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { unmount } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(NotificationService.setupNotificationResponseListener).toHaveBeenCalled();
    });

    // Cleanup should remove listener
    unmount();

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
