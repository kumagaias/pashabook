# FCM Token Management Implementation

## Overview

This document describes the implementation of FCM (Firebase Cloud Messaging) token management for push notifications in the Pashabook mobile app.

## Architecture

### Components

1. **Mobile App (React Native)**
   - Registers for push notifications on app launch
   - Stores FCM token in Firestore
   - Handles token refresh events
   - Gracefully handles permission denied scenarios

2. **Backend API (Cloud Run)**
   - Provides `/api/user/fcm-token` endpoint for token updates
   - Validates and stores tokens in Firestore
   - Retrieves tokens when sending notifications

3. **Firestore**
   - Stores FCM tokens in `/users/{userId}` collection
   - Token stored in `fcmToken` field of UserProfile document

## Implementation Details

### Mobile App

#### Token Registration Flow

1. **App Launch**: When user authenticates, the app automatically registers for push notifications
2. **Permission Request**: If not already granted, requests notification permissions from user
3. **Token Retrieval**: Gets FCM token from Expo Push Notifications API
4. **Token Storage**: Sends token to backend API for storage in Firestore

#### Token Refresh Handling

- Expo Push Tokens are relatively stable and don't require explicit refresh listeners
- Token is re-registered on each app launch to ensure it's up-to-date
- If token changes, the new token is automatically sent to backend

#### Permission Denied Handling

- If user denies notification permissions, the app continues to function normally
- No FCM token is stored in Firestore
- Backend gracefully skips notification sending for users without tokens
- User can enable notifications later through device settings

### Backend API

#### Endpoint: PUT /api/user/fcm-token

**Request:**
```json
{
  "fcmToken": "ExponentPushToken[...]"
}
```

**Response:**
```json
{
  "success": true
}
```

**Validation:**
- Requires Firebase Authentication token in Authorization header
- Validates FCM token is non-empty string
- Updates only the authenticated user's profile

**Error Handling:**
- 400: Invalid or missing FCM token
- 401: Unauthorized (missing or invalid auth token)
- 500: Firestore update error

### Firestore Schema

```typescript
interface UserProfile {
  userId: string;
  name: string;
  email: string;
  fcmToken?: string; // Optional - only present if user granted permissions
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Security Considerations

1. **Authentication Required**: All FCM token operations require valid Firebase ID token
2. **User Isolation**: Users can only update their own FCM tokens
3. **Token Validation**: Backend validates token format before storage
4. **Graceful Degradation**: Missing tokens don't break app functionality

## Testing

### Backend Tests

- Token update with valid token
- Rejection of empty/invalid tokens
- Firestore error handling
- Authentication requirement

### Mobile Tests

- Token registration on physical device
- Permission denied handling
- Token update API call
- Network error handling
- Notification listener setup

## Usage

### Mobile App

```typescript
// Automatic registration on app launch (in auth-context.tsx)
const fcmToken = await registerForPushNotifications();
if (fcmToken) {
  const idToken = await auth.currentUser.getIdToken();
  await updateFCMToken(fcmToken, idToken);
}
```

### Backend (Sending Notifications)

```typescript
// Retrieve user's FCM token from Firestore
const userDoc = await db.collection('users').doc(userId).get();
const userData = userDoc.data() as UserProfile;

if (userData.fcmToken) {
  // Send notification using FCM Admin SDK
  await sendCompletionNotification(
    userData.fcmToken,
    jobId,
    language
  );
}
```

## Requirements Validated

This implementation satisfies the following requirements from the spec:

- **Requirement 11.6**: Mobile app registers for push notifications on app launch
- **Requirement 11.7**: FCM token stored in Firestore `/users/{userId}` collection
- **Requirement 11.8**: Token refresh events update Firestore automatically (via re-registration on app launch)
- **Requirement 11.9**: Permission denied handled gracefully without blocking app functionality

## Future Enhancements

1. **Token Cleanup**: Remove stale tokens when FCM returns invalid token errors
2. **Multi-Device Support**: Store array of tokens per user for multiple devices
3. **Token Expiry Tracking**: Monitor token age and proactively refresh
4. **Analytics**: Track notification permission grant/deny rates
