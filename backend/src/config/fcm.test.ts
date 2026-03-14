import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing
vi.mock('firebase-admin', () => ({
  default: {
    messaging: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
}));

vi.mock('./firebase', () => ({
  initializeFirebase: vi.fn(),
}));

// Import after mocks
import { sendCompletionNotification } from './fcm';
import admin from 'firebase-admin';

describe('FCM Notification', () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    (admin.messaging as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      send: mockSend,
    });
  });

  describe('sendCompletionNotification', () => {
    it('should send notification with correct Japanese content', async () => {
      mockSend.mockResolvedValue('message-id');

      const result = await sendCompletionNotification(
        'valid-fcm-token',
        'test-job-id',
        'ja'
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({
        token: 'valid-fcm-token',
        notification: {
          title: 'ストーリーブックが完成しました！',
          body: 'タップしてアニメーションストーリーブックを見る',
        },
        data: {
          jobId: 'test-job-id',
          type: 'job_complete',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'job_completion',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
    });

    it('should send notification with correct English content', async () => {
      mockSend.mockResolvedValue('message-id');

      const result = await sendCompletionNotification(
        'valid-fcm-token',
        'test-job-id',
        'en'
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({
        token: 'valid-fcm-token',
        notification: {
          title: 'Your storybook is ready!',
          body: 'Tap to view your animated storybook',
        },
        data: {
          jobId: 'test-job-id',
          type: 'job_complete',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'job_completion',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
    });

    it('should handle invalid token error gracefully', async () => {
      const error = new Error('registration-token-not-registered');
      mockSend.mockRejectedValue(error);

      const result = await sendCompletionNotification(
        'invalid-token',
        'test-job-id',
        'en'
      );

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle expired token error gracefully', async () => {
      const error = new Error('invalid-registration-token');
      mockSend.mockRejectedValue(error);

      const result = await sendCompletionNotification(
        'expired-token',
        'test-job-id',
        'en'
      );

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle network error gracefully', async () => {
      const error = new Error('Network error');
      mockSend.mockRejectedValue(error);

      const result = await sendCompletionNotification(
        'valid-token',
        'test-job-id',
        'en'
      );

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should include jobId in data payload for deep linking', async () => {
      mockSend.mockResolvedValue('message-id');

      await sendCompletionNotification(
        'valid-fcm-token',
        'test-job-123',
        'en'
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.data).toEqual({
        jobId: 'test-job-123',
        type: 'job_complete',
      });
    });

    it('should set high priority for Android', async () => {
      mockSend.mockResolvedValue('message-id');

      await sendCompletionNotification(
        'valid-fcm-token',
        'test-job-id',
        'en'
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.android?.priority).toBe('high');
      expect(callArgs.android?.notification?.priority).toBe('high');
    });

    it('should include sound and badge for iOS', async () => {
      mockSend.mockResolvedValue('message-id');

      await sendCompletionNotification(
        'valid-fcm-token',
        'test-job-id',
        'en'
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.apns?.payload?.aps?.sound).toBe('default');
      expect(callArgs.apns?.payload?.aps?.badge).toBe(1);
    });
  });
});
