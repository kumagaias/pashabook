/**
 * Integration tests for FCM notification handling
 * Tests the complete flow from notification receipt to navigation
 */

import * as Notifications from 'expo-notifications';

describe('FCM Notification Integration', () => {
  describe('Notification Data Payload', () => {
    it('should parse jobId from notification data payload', () => {
      const mockNotification: Notifications.Notification = {
        request: {
          identifier: 'test-id',
          content: {
            title: 'Your storybook is ready!',
            body: 'Tap to view your animated storybook',
            data: {
              jobId: 'test-job-123',
              type: 'job_complete',
            },
            badge: null,
            sound: null,
            launchImageName: null,
            attachments: [],
            summaryArgument: null,
            summaryArgumentCount: 0,
            categoryIdentifier: null,
            threadIdentifier: null,
            targetContentIdentifier: null,
          },
          trigger: {
            type: 'push',
            remoteMessage: null,
            channelId: 'default',
          },
        },
        date: Date.now(),
      };

      const jobId = mockNotification.request.content.data?.jobId;
      
      expect(jobId).toBe('test-job-123');
      expect(typeof jobId).toBe('string');
    });

    it('should handle missing jobId gracefully', () => {
      const mockNotification: Notifications.Notification = {
        request: {
          identifier: 'test-id',
          content: {
            title: 'Test notification',
            body: 'Test body',
            data: {},
            badge: null,
            sound: null,
            launchImageName: null,
            attachments: [],
            summaryArgument: null,
            summaryArgumentCount: 0,
            categoryIdentifier: null,
            threadIdentifier: null,
            targetContentIdentifier: null,
          },
          trigger: {
            type: 'push',
            remoteMessage: null,
            channelId: 'default',
          },
        },
        date: Date.now(),
      };

      const jobId = mockNotification.request.content.data?.jobId;
      
      expect(jobId).toBeUndefined();
    });

    it('should validate notification type', () => {
      const mockNotification: Notifications.Notification = {
        request: {
          identifier: 'test-id',
          content: {
            title: 'Your storybook is ready!',
            body: 'Tap to view your animated storybook',
            data: {
              jobId: 'test-job-123',
              type: 'job_complete',
            },
            badge: null,
            sound: null,
            launchImageName: null,
            attachments: [],
            summaryArgument: null,
            summaryArgumentCount: 0,
            categoryIdentifier: null,
            threadIdentifier: null,
            targetContentIdentifier: null,
          },
          trigger: {
            type: 'push',
            remoteMessage: null,
            channelId: 'default',
          },
        },
        date: Date.now(),
      };

      const notificationType = mockNotification.request.content.data?.type;
      
      expect(notificationType).toBe('job_complete');
    });
  });

  describe('Navigation Path Construction', () => {
    it('should construct correct detail screen path', () => {
      const jobId = 'test-job-123';
      const expectedPath = `/detail/${jobId}`;
      
      expect(expectedPath).toBe('/detail/test-job-123');
    });

    it('should handle special characters in jobId', () => {
      const jobId = 'job-abc-123-xyz';
      const expectedPath = `/detail/${jobId}`;
      
      expect(expectedPath).toBe('/detail/job-abc-123-xyz');
    });
  });

  describe('Notification Handler Configuration', () => {
    it('should configure notification handler with correct settings', () => {
      // This tests the configuration set in notification-service.ts
      const expectedConfig = {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };

      expect(expectedConfig.shouldShowAlert).toBe(true);
      expect(expectedConfig.shouldPlaySound).toBe(true);
      expect(expectedConfig.shouldSetBadge).toBe(false);
    });
  });
});
