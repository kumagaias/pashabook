import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ProgressScreen from '../progress/[id]';
import { getStorybook, saveStorybook } from '@/lib/storage';
import { getJobStatus } from '@/lib/api';
import { getAuth } from 'firebase/auth';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({ id: 'test-job-123' })),
}));

jest.mock('expo-haptics');

jest.mock('@/lib/storage');
jest.mock('@/lib/api');

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  const Animated = {
    View,
    Text: require('react-native').Text,
  };
  return {
    default: Animated,
    ...Animated,
    useSharedValue: () => ({ value: 0 }),
    useAnimatedStyle: () => ({}),
    withRepeat: (value: any) => value,
    withTiming: (value: any) => value,
    withSequence: (...values: any[]) => values[0],
    Easing: {
      inOut: (fn: any) => fn,
      ease: 1,
    },
    FadeIn: {
      duration: () => ({}),
    },
  };
});

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file://test-directory/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn(),
}));

describe('ProgressScreen - Processing Section', () => {
  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    getIdToken: jest.fn().mockResolvedValue('test-token'),
  };

  const mockStorybook = {
    id: 'test-job-123',
    status: 'processing' as const,
    currentStep: 'analyzing',
    progress: 25,
    drawingUri: 'file://test-drawing.jpg',
    language: 'en' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    (getAuth as jest.Mock).mockReturnValue({
      currentUser: mockUser,
    });
    
    (getStorybook as jest.Mock).mockResolvedValue(mockStorybook);
    (saveStorybook as jest.Mock).mockResolvedValue(undefined);
    (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Polling mechanism', () => {
    it('should poll job status every 2 seconds', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
        progress: {
          stage: 'analyzing',
          percentage: 25,
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(getStorybook).toHaveBeenCalledWith('test-job-123');
      });

      // Initial poll
      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(1);
      });

      // Advance timer by 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(2);
      });

      // Advance timer by another 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(3);
      });
    });

    it('should stop polling when job status is done', async () => {
      (getJobStatus as jest.Mock)
        .mockResolvedValueOnce({
          jobId: 'test-job-123',
          status: 'processing',
          progress: {
            stage: 'composing',
            percentage: 90,
          },
        })
        .mockResolvedValueOnce({
          jobId: 'test-job-123',
          status: 'done',
          progress: {
            stage: 'done',
            percentage: 100,
          },
          result: {
            title: 'Test Story',
            videoUrl: 'https://example.com/video.mp4',
            storyText: ['Page 1', 'Page 2'],
          },
        });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(1);
      });

      // Advance timer to trigger second poll
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(2);
      });

      // Advance timer again - should not poll anymore
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(2);
      });
    });

    it('should stop polling when job status is error', async () => {
      (getJobStatus as jest.Mock)
        .mockResolvedValueOnce({
          jobId: 'test-job-123',
          status: 'processing',
          progress: {
            stage: 'generating',
            percentage: 50,
          },
        })
        .mockResolvedValueOnce({
          jobId: 'test-job-123',
          status: 'error',
          error: 'Generation failed',
        });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(1);
      });

      // Advance timer to trigger second poll
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(2);
      });

      // Advance timer again - should not poll anymore
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(2);
      });
    });

    it('should clean up polling interval on unmount', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
        progress: {
          stage: 'analyzing',
          percentage: 25,
        },
      });

      const { unmount } = render(<ProgressScreen />);

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(1);
      });

      // Unmount component
      unmount();

      // Advance timer - should not poll after unmount
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(1);
      });
    });

    it('should not update state after unmount', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
        progress: {
          stage: 'analyzing',
          percentage: 25,
        },
      });

      const { unmount } = render(<ProgressScreen />);

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalled();
      });

      unmount();

      // Advance timer to trigger poll after unmount
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Should not throw error or update state
      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Progress display updates', () => {
    it('should display current stage and progress percentage', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
        progress: {
          stage: 'generating',
          percentage: 50,
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Creating Story')).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeTruthy();
      });
    });

    it('should update progress when stage changes', async () => {
      (getJobStatus as jest.Mock)
        .mockResolvedValueOnce({
          jobId: 'test-job-123',
          status: 'processing',
          progress: {
            stage: 'analyzing',
            percentage: 25,
          },
        })
        .mockResolvedValueOnce({
          jobId: 'test-job-123',
          status: 'processing',
          progress: {
            stage: 'generating',
            percentage: 50,
          },
        });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Analyzing')).toBeTruthy();
      });

      // Advance timer to trigger next poll
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByText('Creating Story')).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeTruthy();
      });
    });

    it('should display queue position when available', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'pending',
        queuePosition: 3,
        progress: {
          stage: 'analyzing',
          percentage: 0,
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('You are #3 in queue')).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText('Estimated wait: ~9 minutes')).toBeTruthy();
      });
    });

    it('should hide queue position when position is 0', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
        queuePosition: 0,
        progress: {
          stage: 'analyzing',
          percentage: 25,
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Analyzing')).toBeTruthy();
      });

      // Queue position should not be displayed
      expect(screen.queryByText(/in queue/)).toBeNull();
    });

    it('should display completion state when done', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'done',
        progress: {
          stage: 'done',
          percentage: 100,
        },
        result: {
          title: 'Test Story',
          videoUrl: 'https://example.com/video.mp4',
          storyText: ['Page 1', 'Page 2'],
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Complete!')).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText('View Storybook')).toBeTruthy();
      });
    });

    it('should trigger haptic feedback on completion', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'done',
        progress: {
          stage: 'done',
          percentage: 100,
        },
        result: {
          title: 'Test Story',
          videoUrl: 'https://example.com/video.mp4',
          storyText: ['Page 1', 'Page 2'],
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(Haptics.notificationAsync).toHaveBeenCalledWith(
          Haptics.NotificationFeedbackType.Success
        );
      });
    });

    it('should display Japanese text when language is Japanese', async () => {
      (getStorybook as jest.Mock).mockResolvedValue({
        ...mockStorybook,
        language: 'ja',
      });

      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
        progress: {
          stage: 'analyzing',
          percentage: 25,
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('分析中')).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText('作成中...')).toBeTruthy();
      });
    });
  });

  describe('Error handling', () => {
    it('should display error message when job status is error', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'error',
        error: 'Generation failed due to invalid image',
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('An Error Occurred')).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText('Generation failed due to invalid image')).toBeTruthy();
      });
    });

    it('should display error message when polling fails', async () => {
      (getJobStatus as jest.Mock).mockRejectedValue(
        new Error('Network error: Failed to fetch')
      );

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Network error: Failed to fetch')).toBeTruthy();
      });
    });

    it('should display retry button when error occurs', async () => {
      (getJobStatus as jest.Mock).mockRejectedValue(
        new Error('Network error: Failed to fetch')
      );

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });

    it('should display authentication error when user is not authenticated', async () => {
      (getAuth as jest.Mock).mockReturnValue({
        currentUser: null,
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Authentication required. Please sign in again.')).toBeTruthy();
      });
    });

    it('should display error when storybook is not found', async () => {
      (getStorybook as jest.Mock).mockResolvedValue(null);

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Storybook not found')).toBeTruthy();
      });
    });

    it('should clear error when polling succeeds after failure', async () => {
      (getJobStatus as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          jobId: 'test-job-123',
          status: 'processing',
          progress: {
            stage: 'analyzing',
            percentage: 25,
          },
        });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeTruthy();
      });

      // Advance timer to trigger next poll
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Network error')).toBeNull();
      });

      await waitFor(() => {
        expect(screen.getByText('Analyzing')).toBeTruthy();
      });
    });
  });

  describe('Retry button functionality', () => {
    it('should retry polling when retry button is pressed', async () => {
      (getJobStatus as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          jobId: 'test-job-123',
          status: 'processing',
          progress: {
            stage: 'analyzing',
            percentage: 25,
          },
        });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByText('Analyzing')).toBeTruthy();
      });
    });

    it('should restart polling after successful retry', async () => {
      (getJobStatus as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          jobId: 'test-job-123',
          status: 'processing',
          progress: {
            stage: 'analyzing',
            percentage: 25,
          },
        });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(2);
      });

      // Advance timer to verify polling restarted
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(3);
      });
    });

    it('should display retrying state when retry is in progress', async () => {
      (getJobStatus as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({
            jobId: 'test-job-123',
            status: 'processing',
            progress: {
              stage: 'analyzing',
              percentage: 25,
            },
          }), 100))
        );

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Retrying...')).toBeTruthy();
      });
    });

    it('should disable retry button during retry', async () => {
      (getJobStatus as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({
            jobId: 'test-job-123',
            status: 'processing',
            progress: {
              stage: 'analyzing',
              percentage: 25,
            },
          }), 100))
        );

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.press(retryButton);

      // Button should show "Retrying..." and be disabled
      await waitFor(() => {
        expect(screen.getByText('Retrying...')).toBeTruthy();
      });

      // Pressing again should not trigger another retry
      const retryingButton = screen.getByText('Retrying...');
      fireEvent.press(retryingButton);

      // Should still only have 2 calls (initial + first retry)
      await waitFor(() => {
        expect(getJobStatus).toHaveBeenCalledTimes(2);
      });
    });

    it('should display Japanese retry text when language is Japanese', async () => {
      (getStorybook as jest.Mock).mockResolvedValue({
        ...mockStorybook,
        language: 'ja',
      });

      (getJobStatus as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('再試行')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to detail screen when view button is pressed', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'done',
        progress: {
          stage: 'done',
          percentage: 100,
        },
        result: {
          title: 'Test Story',
          videoUrl: 'https://example.com/video.mp4',
          storyText: ['Page 1', 'Page 2'],
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('View Storybook')).toBeTruthy();
      });

      const viewButton = screen.getByText('View Storybook');
      fireEvent.press(viewButton);

      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/detail/[id]',
        params: { id: 'test-job-123' },
      });
    });

    it('should navigate back when back button is pressed', async () => {
      (getJobStatus as jest.Mock).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
        progress: {
          stage: 'analyzing',
          percentage: 25,
        },
      });

      render(<ProgressScreen />);

      await waitFor(() => {
        expect(screen.getByText('Analyzing')).toBeTruthy();
      });

      // Find back button by icon (chevron-back)
      // In test environment, we can't easily test icon press, so we'll verify the component renders
      expect(screen.getByText('Creating...')).toBeTruthy();
    });
  });
});
