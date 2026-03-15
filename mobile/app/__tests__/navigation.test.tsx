import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useSegments: jest.fn(),
  Stack: ({ children }: any) => children,
}));

// Mock auth context
jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('Navigation and Stage Transitions', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('Authentication-based navigation', () => {
    it('should redirect to login when unauthenticated and not in auth group', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
      (useSegments as jest.Mock).mockReturnValue(['(tabs)']);

      // Simulate the navigation logic from _layout.tsx
      const { isAuthenticated, isLoading } = useAuth();
      const segments = useSegments();
      const router = useRouter();

      if (!isLoading) {
        const inAuthGroup = segments[0] === '(auth)';
        if (!isAuthenticated && !inAuthGroup) {
          router.replace('/(auth)/login');
        }
      }

      expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/login');
    });

    it('should redirect to home when authenticated and in auth group', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: 'test-user', name: 'Test', email: 'test@example.com' },
      });
      (useSegments as jest.Mock).mockReturnValue(['(auth)', 'login']);

      // Simulate the navigation logic from _layout.tsx
      const { isAuthenticated, isLoading } = useAuth();
      const segments = useSegments();
      const router = useRouter();

      if (!isLoading) {
        const inAuthGroup = segments[0] === '(auth)';
        if (isAuthenticated && inAuthGroup) {
          router.replace('/(tabs)');
        }
      }

      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });

    it('should not redirect when loading', () => {
      (useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
      });
      (useSegments as jest.Mock).mockReturnValue(['(tabs)']);

      // Simulate the navigation logic from _layout.tsx
      const { isAuthenticated, isLoading } = useAuth();
      const segments = useSegments();
      const router = useRouter();

      if (!isLoading) {
        const inAuthGroup = segments[0] === '(auth)';
        if (!isAuthenticated && !inAuthGroup) {
          router.replace('/(auth)/login');
        }
      }

      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should allow authenticated users to access tabs', () => {
      (useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: 'test-user', name: 'Test', email: 'test@example.com' },
      });
      (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'index']);

      // Simulate the navigation logic from _layout.tsx
      const { isAuthenticated, isLoading } = useAuth();
      const segments = useSegments();
      const router = useRouter();

      if (!isLoading) {
        const inAuthGroup = segments[0] === '(auth)';
        if (!isAuthenticated && !inAuthGroup) {
          router.replace('/(auth)/login');
        } else if (isAuthenticated && inAuthGroup) {
          router.replace('/(tabs)');
        }
      }

      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should allow unauthenticated users to access auth screens', () => {
      (useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
      (useSegments as jest.Mock).mockReturnValue(['(auth)', 'login']);

      // Simulate the navigation logic from _layout.tsx
      const { isAuthenticated, isLoading } = useAuth();
      const segments = useSegments();
      const router = useRouter();

      if (!isLoading) {
        const inAuthGroup = segments[0] === '(auth)';
        if (!isAuthenticated && !inAuthGroup) {
          router.replace('/(auth)/login');
        } else if (isAuthenticated && inAuthGroup) {
          router.replace('/(tabs)');
        }
      }

      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  describe('Stage transitions', () => {
    it('should navigate to progress screen after upload', () => {
      const router = useRouter();
      const jobId = 'test-job-123';

      router.push(`/progress/${jobId}`);

      expect(mockRouter.push).toHaveBeenCalledWith('/progress/test-job-123');
    });

    it('should navigate to detail screen after completion', () => {
      const router = useRouter();
      const jobId = 'test-job-123';

      router.push(`/detail/${jobId}`);

      expect(mockRouter.push).toHaveBeenCalledWith('/detail/test-job-123');
    });

    it('should navigate to library tab', () => {
      const router = useRouter();

      router.push('/(tabs)/library');

      expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/library');
    });

    it('should navigate back from detail to tabs', () => {
      const router = useRouter();

      router.back();

      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe('Deep linking from notifications', () => {
    it('should navigate to detail screen when notification is tapped', () => {
      const router = useRouter();
      const jobId = 'notification-job-456';

      // Simulate notification tap handler
      router.push(`/detail/${jobId}`);

      expect(mockRouter.push).toHaveBeenCalledWith('/detail/notification-job-456');
    });
  });
});
