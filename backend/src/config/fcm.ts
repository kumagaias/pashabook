import admin from 'firebase-admin';
import { initializeFirebase } from './firebase';

/**
 * Get FCM messaging instance
 */
export function getMessaging() {
  initializeFirebase();
  return admin.messaging();
}

/**
 * Send push notification when storybook is ready
 * @param fcmToken - User's FCM device token
 * @param jobId - Job ID for deep linking
 * @param language - User's language preference
 * @returns Success status
 */
export async function sendCompletionNotification(
  fcmToken: string,
  jobId: string,
  language: 'ja' | 'en'
): Promise<boolean> {
  try {
    const messaging = getMessaging();

    // Localized notification content
    const title = language === 'ja' 
      ? 'ストーリーブックが完成しました！' 
      : 'Your storybook is ready!';
    
    const body = language === 'ja'
      ? 'タップしてアニメーションストーリーブックを見る'
      : 'Tap to view your animated storybook';

    // Send notification
    await messaging.send({
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        jobId,
        type: 'job_complete',
      },
      // Android-specific options
      android: {
        priority: 'high',
        notification: {
          channelId: 'job_completion',
          priority: 'high',
        },
      },
      // iOS-specific options
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });

    console.log(`FCM notification sent successfully for job ${jobId}`);
    return true;
  } catch (error) {
    // Log warning but don't throw - notification failure shouldn't fail the job
    if (error instanceof Error) {
      // Check for invalid token errors
      if (error.message.includes('registration-token-not-registered') ||
          error.message.includes('invalid-registration-token')) {
        console.warn(`Invalid or expired FCM token for job ${jobId}:`, error.message);
      } else {
        console.warn(`Failed to send FCM notification for job ${jobId}:`, error.message);
      }
    } else {
      console.warn(`Failed to send FCM notification for job ${jobId}:`, error);
    }
    return false;
  }
}
