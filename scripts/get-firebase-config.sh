#!/bin/bash

# Get Firebase configuration for mobile app
# This script helps retrieve Firebase config values from GCP

set -e

PROJECT_ID="outbreak-radar-for-kids-dev"

echo "==================================="
echo "Firebase Configuration Helper"
echo "==================================="
echo ""
echo "Project ID: $PROJECT_ID"
echo ""
echo "To get your Firebase configuration:"
echo ""
echo "1. Go to Firebase Console:"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/settings/general"
echo ""
echo "2. Scroll down to 'Your apps' section"
echo ""
echo "3. If no app exists:"
echo "   - Click 'Add app' button"
echo "   - Select platform (Web for Expo)"
echo "   - Register the app"
echo ""
echo "4. Copy the configuration values and update mobile/.env:"
echo ""
echo "   EXPO_PUBLIC_FIREBASE_API_KEY=<apiKey>"
echo "   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=$PROJECT_ID.firebaseapp.com"
echo "   EXPO_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID"
echo "   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=$PROJECT_ID.appspot.com"
echo "   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>"
echo "   EXPO_PUBLIC_FIREBASE_APP_ID=<appId>"
echo ""
echo "5. Backend API URL is already configured:"
echo "   EXPO_PUBLIC_API_BASE_URL=https://pashabook-worker-837474970403.asia-northeast1.run.app"
echo ""
echo "==================================="
