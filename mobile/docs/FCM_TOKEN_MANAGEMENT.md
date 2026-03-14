# FCM Token Management Implementation

## Overview

This document describes the Firebase Cloud Messaging (FCM) token management implementation for push notifications in the Pashabook mobile app.

## Architecture

### Components

1. **notification-service.ts**: Core FCM token management service
2. **auth-context.tsx**: Integration with authentication flow
3. **app.json**: Expo configuration for push notifications

### Flow

```
App Launch
    ↓
AuthProvider initializes
    ↓
User authenticates (login/register)
    ↓
FCM token registration triggered
    ↓
Request notification permissions
    ↓
Get Expo Push Token
    ↓
Update token in Firestore via backend API
    ↓
Setup notification listeners
```

## Implementation Details

### 1. Notification Service (`notification-service.ts`)

**Key Functions:**

- `registerForPushNotifications()`: Requests permissions and retrieves FCM token
  - Only works on physical devices
  - Handles permission requests gracefully
  - Returns null if permission denied or on simulator
  
- `updateFCMToken(token, idToken)`: Updates FCM token in Firestore
  - Calls backend API endpoint `/api/user/fcm-token`
  - Requires Firebase ID token for authentication
  
- `setupNotificationResponseListener(callback)`: Handles notification taps
  - Navigates to job progress screen when user taps notification
  - Extracts jobId from notification data payload

### 2. Auth Context Integration (`auth-context.tsx`)

**FCM Setup Effect:**

```typescript
useEffect(() => {
  const setupFCM = async () => {
    if (!auth.currentUser) return;

    try {
      const fcmToken = await registerForPushNotifications();
      
      if (fcmToken) {
        const idToken = await auth.currentUser.getIdToken();
        await updateFCMToken(fcmToken, idToken);
      }
    } catch (error) {
      console.error('Error setting up FCM:', error);
    }
  };

  setupFCM();
  
  // Setup notification tap handler
  notificationListenerRef.current = setupNotificationResponseListener((response) => {
    const jobId = response.notification.request.content.data?.jobId;
    if (jobId) {
      router.push(`/progress/${jobId}`);
    }
  });

  return () => {
    if (notificationListenerRef.current) {
      notificationListenerRef.current.remove();
    }
  };
}, [user]);
```

**Key Points:**

- FCM setup runs when user state changes (login/register)
- Gracefully handles permission denial (no error thrown)
- Cleans up notification listeners on unmount
- Deep links to progress screen when notification tapped

### 3. Expo Configuration (`app.json`)

```json
{
  "plugins": [
    [
      "expo-notifications",
      {
        "icon": "./assets/images/notification-icon.png",
        "color": "#FF6B6B",
        "sounds": []
      }
    ]
  ]
}
```

## Backend API Requirements

The backend must implement the following endpoint:

### PUT /api/user/fcm-token

**Request:**
```json
{
  "fcmToken": "ExponentPushToken[...]"
}
```

**Headers:**
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

**Response:**
- 200 OK: Token updated successfully
- 401 Unauthorized: Invalid or missing token
- 500 Internal Server Error: Server error

**Implementation:**
- Extract userId from Firebase ID token
- Update UserProfile document in Firestore: `/users/{userId}`
- Set `fcmToken` field in UserProfile

## Token Refresh Handling

Firebase SDK automatically handles token refresh. The app listens for token refresh events and updates Firestore:

```typescript
// Token refresh is handled automatically by Firebase SDK
// The app re-registers on each app launch to ensure token is current
```

## Error Handling

### Permission Denied
- `registerForPushNotifications()` returns `null`
- No error thrown, app continues normally
- User can enable notifications later in device settings

### Network Errors
- `updateFCMToken()` returns `false`
- Error logged to console
- Token will be updated on next app launch

### Invalid/Expired Tokens
- Backend handles gracefully (FCM returns error)
- Cloud Run logs warning
- User re-registers on next app launch

## Testing

### Unit Tests

Run notification service tests:
```bash
npm test -- notification-service.test.ts
```

**Test Coverage:**
- ✅ Returns null on non-physical device
- ✅ Returns null when permission denied
- ✅ Returns FCM token when permission granted
- ✅ Requests permission if not already granted
- ✅ Handles errors gracefully
- ✅ Updates FCM token successfully
- ✅ Returns false on API error
- ✅ Handles network errors gracefully

### Manual Testing

1. **Physical Device Required**: Push notifications only work on physical devices
2. **Permission Flow**:
   - Install app on device
   - Login/register
   - Accept notification permission prompt
   - Verify token stored in Firestore
3. **Notification Tap**:
   - Trigger job completion notification from backend
   - Tap notification
   - Verify app opens to progress screen

## Deployment Checklist

- [ ] expo-notifications package installed
- [ ] expo-device package installed
- [ ] app.json updated with notification plugin
- [ ] Backend API endpoint `/api/user/fcm-token` implemented
- [ ] Firestore UserProfile schema includes `fcmToken` field
- [ ] FCM Admin SDK initialized in backend
- [ ] Tested on physical iOS device
- [ ] Tested on physical Android device

## Troubleshooting

### Token not updating in Firestore
- Check backend API logs for errors
- Verify Firebase ID token is valid
- Ensure user is authenticated before FCM setup

### Notifications not received
- Verify FCM token stored in Firestore
- Check backend notification sending logic
- Ensure app has notification permissions
- Test on physical device (not simulator)

### Deep linking not working
- Verify jobId in notification data payload
- Check router.push() navigation
- Ensure progress screen route exists

## References

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
