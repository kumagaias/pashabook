# Mobile App Setup Guide

## Prerequisites

- Node.js 20+ (LTS)
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

## Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/project/outbreak-radar-for-kids-dev/settings/general)
2. Scroll down to "Your apps" section
3. If no app exists, click "Add app" and select the platform (iOS/Android/Web)
4. Copy the Firebase configuration values
5. Update `mobile/.env` with the actual values:
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`

## Installation

```bash
cd mobile
npm install
```

## Running the App

### Development Mode

```bash
# Start Expo development server
npm start

# Run on iOS simulator (macOS only)
npm run ios

# Run on Android emulator
npm run android

# Run on web browser
npm run web
```

## Environment Variables

The app requires the following environment variables in `mobile/.env`:

- `EXPO_PUBLIC_FIREBASE_API_KEY`: Firebase API key
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`: Firebase project ID
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `EXPO_PUBLIC_FIREBASE_APP_ID`: Firebase app ID
- `EXPO_PUBLIC_API_BASE_URL`: Backend API URL (already configured)

## Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Troubleshooting

### Firebase Authentication Errors

If you see authentication errors:
1. Verify Firebase configuration in `.env`
2. Check that Email/Password authentication is enabled in Firebase Console
3. Ensure the backend API URL is correct

### Network Errors

If you see network errors:
1. Verify the backend service is running: `curl https://pashabook-worker-837474970403.asia-northeast1.run.app/health`
2. Check that your device/emulator can access the internet
3. For iOS simulator, ensure you're not using localhost URLs

### Build Errors

If you encounter build errors:
1. Clear cache: `npm start -- --clear`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Reset Expo cache: `expo start -c`
