# Pashabook Mobile - Development Build Guide

## Overview

This guide explains how to build and run the Pashabook mobile app using Expo development builds.

## Prerequisites

### iOS Development (macOS only)
- Xcode 15.0 or later
- iOS Simulator or physical iOS device
- CocoaPods (installed automatically by Expo)

### Android Development
- Android Studio
- Android SDK (API 34 or later)
- Android Emulator or physical Android device
- Java Development Kit (JDK) 17

## Setup

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase and API configuration:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:
```
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_API_BASE_URL=https://your-cloud-run-url
```

### 3. Generate Native Code (if not already done)

```bash
npx expo prebuild --clean
```

This generates the `ios/` and `android/` directories with native code.

## Running Development Builds

### iOS (macOS only)

**Option 1: Run on iOS Simulator**
```bash
npm run ios
```

**Option 2: Run on specific simulator**
```bash
npx expo run:ios --device "iPhone 15 Pro"
```

**Option 3: Run on physical device**
```bash
npx expo run:ios --device
```

### Android

**Option 1: Run on Android Emulator**
```bash
npm run android
```

**Option 2: Run on physical device**
1. Enable USB debugging on your Android device
2. Connect device via USB
3. Run:
```bash
npm run android
```

## Development Workflow

### 1. Start Metro Bundler

```bash
npm run dev
```

This starts the Metro bundler with development client support.

### 2. Make Changes

Edit your code in the `app/`, `components/`, or `lib/` directories. The app will automatically reload with your changes.

### 3. Debugging

- **React DevTools**: Press `j` in the Metro terminal to open React DevTools
- **Element Inspector**: Shake your device or press `Cmd+D` (iOS) / `Cmd+M` (Android) to open the developer menu
- **Console Logs**: View logs in the Metro terminal

## Common Commands

```bash
# Start development server
npm run dev

# Build and run iOS
npm run ios

# Build and run Android
npm run android

# Clean and regenerate native code
npx expo prebuild --clean

# Run tests
npm test

# Lint code
npm run lint
```

## Troubleshooting

### iOS Build Fails

1. Clean build folder:
```bash
cd ios
xcodebuild clean
cd ..
```

2. Reinstall pods:
```bash
cd ios
pod install
cd ..
```

3. Try rebuilding:
```bash
npm run ios
```

### Android Build Fails

1. Clean Gradle cache:
```bash
cd android
./gradlew clean
cd ..
```

2. Try rebuilding:
```bash
npm run android
```

### Metro Bundler Issues

1. Clear Metro cache:
```bash
npx expo start --clear
```

2. Reset Metro bundler:
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### Native Module Issues

If you add or update native modules:

1. Reinstall dependencies:
```bash
npm install
```

2. Regenerate native code:
```bash
npx expo prebuild --clean
```

3. Rebuild the app:
```bash
npm run ios  # or npm run android
```

## Production Builds

For production builds, use EAS Build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Sharing Builds with EAS Update

EAS Update allows you to share your app with others via a public link. The link stays the same, and updates are automatically delivered.

### 1. Build Development Client (One Time)

Build the development client once and share the link/QR code:

```bash
# For iOS
eas build --profile development --platform ios

# For Android
eas build --profile development --platform android

# For both platforms
eas build --profile development --platform all
```

After the build completes, you'll get:
- A download link
- A QR code
- Installation instructions

Share this link with testers. They only need to install once.

### 2. Publish Updates (Every Code Change)

When you make code changes, publish an update:

```bash
# Publish to preview branch
eas update --branch preview --message "Description of changes"

# Or publish to development branch
eas update --branch development --message "Description of changes"
```

The app will automatically download the update on next launch.

### 3. Check Update Status

```bash
# View all updates
eas update:list

# View specific branch
eas update:list --branch preview
```

### Update Workflow Summary

```
┌─────────────────────────────────────────────────────┐
│ 1. Build once (eas build)                          │
│    → Get shareable link/QR code                    │
│    → Testers install the app                       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 2. Make code changes                                │
│    → Test locally                                   │
│    → Publish update (eas update)                    │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 3. Testers relaunch app                             │
│    → Update downloads automatically                 │
│    → Same link, new code!                           │
└─────────────────────────────────────────────────────┘
```

**Important Notes:**
- Updates work for JavaScript/TypeScript code changes
- Native code changes (dependencies, config) require a new build
- Updates are delivered on app restart
- Link/QR code never changes

## Additional Resources

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Prebuild](https://docs.expo.dev/workflow/prebuild/)
- [React Native Debugging](https://reactnative.dev/docs/debugging)
- [EAS Build](https://docs.expo.dev/build/introduction/)
