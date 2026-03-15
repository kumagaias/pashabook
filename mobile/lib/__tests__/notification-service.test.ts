import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { 
  registerForPushNotifications, 
  updateFCMToken,
  setupNotificationListener,
  setupNotificationResponseListener
} from '../notification-service';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
  },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('notification-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerForPushNotifications', () => {
    it('should return null on non-physical device', async () => {
      (Device.isDevice as any) = false;

      const token = await registerForPushNotifications();

      expect(token).toBeNull();
    });

    it('should return null when permission is denied', async () => {
      (Device.isDevice as any) = true;
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const token = await registerForPushNotifications();

      expect(token).toBeNull();
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return FCM token when permission is granted', async () => {
      (Device.isDevice as any) = true;
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: 'ExponentPushToken[test-token-123]',
      });

      const token = await registerForPushNotifications();

      expect(token).toBe('ExponentPushToken[test-token-123]');
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled();
    });

    it('should configure Android notification channels', async () => {
      // Temporarily change Platform.OS to android
      const Platform = require('react-native').Platform;
      const originalOS = Platform.OS;
      Platform.OS = 'android';

      (Device.isDevice as any) = true;
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: 'ExponentPushToken[test-token-123]',
      });

      const token = await registerForPushNotifications();

      expect(token).toBe('ExponentPushToken[test-token-123]');
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          name: 'default',
          importance: 5,
        })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'job_completion',
        expect.objectContaining({
          name: 'Job Completion',
          importance: 4, // AndroidImportance.HIGH
        })
      );

      // Restore original OS
      Platform.OS = originalOS;
    });

    it('should request permission if not already granted', async () => {
      (Device.isDevice as any) = true;
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: 'ExponentPushToken[test-token-456]',
      });

      const token = await registerForPushNotifications();

      expect(token).toBe('ExponentPushToken[test-token-456]');
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (Device.isDevice as any) = true;
      (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission error')
      );

      const token = await registerForPushNotifications();

      expect(token).toBeNull();
    });
  });

  describe('updateFCMToken', () => {
    it('should update FCM token successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await updateFCMToken('test-token', 'test-id-token');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/fcm-token'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-id-token',
          }),
          body: JSON.stringify({ fcmToken: 'test-token' }),
        })
      );
    });

    it('should return false on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await updateFCMToken('test-token', 'test-id-token');

      expect(result).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await updateFCMToken('test-token', 'test-id-token');

      expect(result).toBe(false);
    });
  });

  describe('setupNotificationListener', () => {
    it('should setup foreground notification listener', () => {
      const mockCallback = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      
      (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue(mockSubscription);

      const subscription = setupNotificationListener(mockCallback);

      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(mockCallback);
      expect(subscription).toBe(mockSubscription);
    });
  });

  describe('setupNotificationResponseListener', () => {
    it('should setup notification response listener', () => {
      const mockCallback = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue(mockSubscription);

      const subscription = setupNotificationResponseListener(mockCallback);

      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(mockCallback);
      expect(subscription).toBe(mockSubscription);
    });
  });
});
