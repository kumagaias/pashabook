import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { API_BASE_URL } from './firebase';

// Configure notification behavior
// This handler controls how notifications are displayed when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,  // Show notification banner
    shouldPlaySound: true,  // Play notification sound
    shouldSetBadge: false,  // Don't update app badge
  }),
});

/**
 * Register for push notifications and get FCM token
 * Handles permission requests and token retrieval
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Only works on physical devices
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Permission denied
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get FCM token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || 'a422b0d3-0d13-4f41-946a-1866e9d51dcb',
    });

    // For Android, configure notification channels
    if (Platform.OS === 'android') {
      // Default channel
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
      });

      // Job completion channel (matches backend FCM config)
      await Notifications.setNotificationChannelAsync('job_completion', {
        name: 'Job Completion',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
        sound: 'default',
      });
    }

    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Update FCM token in Firestore via backend API
 */
export async function updateFCMToken(
  token: string,
  idToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/fcm-token`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fcmToken: token }),
    });

    if (!response.ok) {
      console.error('Failed to update FCM token:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating FCM token:', error);
    return false;
  }
}

/**
 * Setup notification listener for when app is in foreground
 * This listener is called when a notification is received while the app is open
 * The notification will be displayed according to the handler configuration above
 * 
 * @param onNotification - Callback function to handle the notification
 * @returns Subscription object with remove() method to cleanup
 */
export function setupNotificationListener(
  onNotification: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(onNotification);
}

/**
 * Setup notification response listener for when user taps notification
 * This listener is called when the user taps on a notification
 * Works for both foreground and background notifications
 * 
 * The notification data payload should contain:
 * - jobId: string - The job ID to navigate to
 * - type: string - The notification type (e.g., 'job_complete')
 * 
 * @param onResponse - Callback function to handle the notification tap
 * @returns Subscription object with remove() method to cleanup
 */
export function setupNotificationResponseListener(
  onResponse: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(onResponse);
}

/**
 * Setup FCM token refresh listener
 * Listens for token changes and updates Firestore
 */
export function setupTokenRefreshListener(
  onTokenRefresh: (newToken: string) => void
) {
  // Expo push tokens don't have a built-in refresh listener
  // Token refresh is handled by re-registering on app launch
  // This function is a placeholder for future implementation if needed
  return { remove: () => {} };
}
