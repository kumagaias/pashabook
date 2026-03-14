# Notification Handling Implementation

## Overview

This document describes the implementation of FCM notification handling in the Pashabook mobile app, specifically for Task 29.3: "Implement notification handling in mobile app".

## Implementation Summary

### What Was Implemented

1. **Foreground Notification Listener**: Listens for FCM notifications when the app is in the foreground
2. **Background Notification Listener**: Handles FCM notifications when the app is in the background (already implemented)
3. **Notification Data Parsing**: Extracts `jobId` from notification data payload
4. **Navigation on Tap**: Navigates to the detail screen (`/detail/[id]`) when notification is tapped
5. **Notification Display**: Shows notification title and body automatically

### Files Modified

1. **mobile/lib/auth-context.tsx**
   - Added `setupNotificationListener` import
   - Added `foregroundListenerRef` to track foreground notification listener
   - Implemented foreground notification listener in FCM setup effect
   - Updated navigation path from `/progress/${jobId}` to `/detail/${jobId}` for notification taps
   - Added cleanup for foreground listener on unmount

2. **mobile/lib/__tests__/notification-service.test.ts**
   - Added tests for `setupNotificationListener` function
   - Added tests for `setupNotificationResponseListener` function
   - All 10 tests pass

3. **mobile/lib/__tests__/notification-integration.test.ts** (NEW)
   - Created integration tests for notification data payload parsing
   - Tests for navigation path construction
   - Tests for notification handler configuration
   - All 6 tests pass

## Technical Details

### Notification Flow

```
Backend sends FCM notification
    ↓
Firebase Cloud Messaging delivers to device
    ↓
┌─────────────────────────────────────────┐
│ App State: Foreground                   │
│ - setupNotificationListener triggers    │
│ - Notification displayed automatically  │
│ - User sees banner/alert                │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ App State: Background/Killed            │
│ - System displays notification          │
│ - Notification stored in tray           │
└─────────────────────────────────────────┘
    ↓
User taps notification
    ↓
setupNotificationResponseListener triggers
    ↓
Parse jobId from notification.request.content.data
    ↓
Navigate to /detail/${jobId}
    ↓
Detail screen loads and displays completed storybook
```

### Notification Data Payload

The backend sends notifications with the following data structure:

```typescript
{
  notification: {
    title: "Your storybook is ready!",
    body: "Tap to view your animated storybook"
  },
  data: {
    jobId: string,        // e.g., "job-abc-123-xyz"
    type: "job_complete"  // Notification type identifier
  }
}
```

### Notification Handler Configuration

The notification handler is configured in `notification-service.ts` with the following settings:

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,    // Display banner/alert
    shouldPlaySound: true,    // Play notification sound
    shouldSetBadge: false,    // Don't update app badge
  }),
});
```

### Navigation Implementation

When a notification is tapped, the app:

1. Extracts `jobId` from `response.notification.request.content.data?.jobId`
2. Validates that `jobId` is a string
3. Navigates to `/detail/${jobId}` using `router.push()`
4. The detail screen loads the completed storybook and displays:
   - Video player with the final storybook video
   - Story pages with narration text
   - Download button
   - 24-hour deletion reminder

## Testing

### Unit Tests

Run notification service tests:
```bash
npm test -- notification-service.test.ts
```

**Coverage:**
- ✅ Foreground notification listener setup
- ✅ Background notification response listener setup
- ✅ FCM token registration
- ✅ Permission handling
- ✅ Error handling

### Integration Tests

Run notification integration tests:
```bash
npm test -- notification-integration.test.ts
```

**Coverage:**
- ✅ Notification data payload parsing
- ✅ jobId extraction
- ✅ Navigation path construction
- ✅ Notification handler configuration

### Manual Testing

1. **Foreground Notification**:
   - Open app and login
   - Upload a drawing and start generation
   - Keep app in foreground
   - Wait for job completion (~3 minutes)
   - Verify notification banner appears
   - Tap notification → should navigate to detail screen

2. **Background Notification**:
   - Open app and login
   - Upload a drawing and start generation
   - Close app or switch to another app
   - Wait for job completion (~3 minutes)
   - Verify notification appears in notification tray
   - Tap notification → app opens to detail screen

3. **Killed App Notification**:
   - Open app and login
   - Upload a drawing and start generation
   - Force quit the app
   - Wait for job completion (~3 minutes)
   - Verify notification appears in notification tray
   - Tap notification → app launches and navigates to detail screen

## Requirements Validation

This implementation satisfies the following requirements from the spec:

### Requirement 11.7
> "THE push notification SHALL display title 'Your storybook is ready!' and body 'Tap to view your animated storybook'"

✅ **Implemented**: Notification handler displays title and body automatically

### Requirement 11.8
> "WHEN user taps the push notification, THE mobile app SHALL open and navigate to the preview screen for that Job"

✅ **Implemented**: Navigation to `/detail/${jobId}` on notification tap

## Code Quality

- **Type Safety**: All functions use TypeScript with proper type annotations
- **Error Handling**: Graceful handling of missing jobId or invalid data
- **Memory Management**: Proper cleanup of listeners on unmount
- **Test Coverage**: 16 tests covering all notification handling scenarios
- **Documentation**: Inline comments explain notification flow

## Future Enhancements

Potential improvements for future iterations:

1. **Rich Notifications**: Add thumbnail image to notification
2. **Action Buttons**: Add "View" and "Share" action buttons
3. **Notification Grouping**: Group multiple storybook notifications
4. **Custom Sounds**: Use custom notification sound for storybook completion
5. **Notification History**: Store notification history in AsyncStorage
6. **Deep Link Validation**: Validate jobId exists before navigation

## Related Documentation

- [FCM Token Management](./FCM_TOKEN_MANAGEMENT.md)
- [Notification Service](../lib/notification-service.ts)
- [Auth Context](../lib/auth-context.tsx)
- [Detail Screen](../app/detail/[id].tsx)

## References

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)
