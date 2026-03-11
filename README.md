# Pashabook MVP

AI-powered storybook generator that transforms children's drawings into animated video storybooks with narration.

## Overview

Pashabook uses Google Cloud AI services (Gemini 2.0 Flash, Imagen 3, Veo 3.1 Fast, Cloud TTS) to:
- Analyze children's drawings
- Generate age-appropriate stories (3-8 years)
- Create consistent illustrations
- Produce animations with Ken Burns effects and Veo
- Add narration in Japanese or English
- Compose final video storybooks

## Tech Stack

**Frontend:**
- React Native (Expo)
- TypeScript
- AsyncStorage (local library)

**Backend:**
- Node.js 20
- Cloud Functions (API endpoints)
- Cloud Run (processing worker)
- Firebase Authentication
- Firestore (job tracking)
- Cloud Storage (assets, 24h TTL)
- Cloud Tasks (job queue)

**AI Services:**
- Gemini 2.0 Flash (analysis, story generation)
- Imagen 3 (illustrations)
- Veo 3.1 Fast (highlight animations)
- Cloud TTS (narration)
- FFmpeg (standard animations, composition)

## Project Structure

```
.
├── mobile/              # React Native app
├── backend/             # Node.js backend services
├── infra/               # Infrastructure as Code
│   ├── terraform/       # GCP resource definitions
│   ├── firestore.rules  # Firestore security rules
│   └── storage.rules    # Cloud Storage security rules
├── .tool-versions       # Tool version management
└── Makefile             # Build commands
```

## Prerequisites

- Node.js 20 (LTS)
- Terraform 1.10+
- Google Cloud Project with billing enabled
- Firebase project
- gitleaks (for security scanning)

## Quick Start

### Current Status

✅ Backend implementation complete (all tests passing)
✅ Mobile app implementation complete (all tests passing)
⚠️ Infrastructure needs to be deployed to GCP project `pashabook-dev`

### Setup Instructions

See [NEXT_STEPS.md](NEXT_STEPS.md) for detailed setup instructions.

**Quick setup:**

1. Create GCP project `pashabook-dev` and enable billing
2. Deploy infrastructure: `cd infra/terraform && terraform apply`
3. Deploy backend: `cd infra && ./deploy.sh`
4. Configure Firebase and update `mobile/.env`
5. Run mobile app: `cd mobile && npm start`

## Development

### Running Tests

Backend:
```bash
cd backend
npm test
```

Mobile:
```bash
cd mobile
npm test
```

All tests:
```bash
make test
```

### Local Development

Mobile app:
```bash
cd mobile
npm start
```

Backend (already deployed to Cloud Run):
```bash
cd backend
npm run dev  # For local testing only
```

## Deployment

### Backend (Cloud Run)

Deploy backend to Cloud Run:
```bash
cd infra
./scripts/deploy.sh
```

### Web App (Firebase Hosting)

Build and deploy web app:
```bash
make web-deploy
```

Or manually:
```bash
cd mobile
npx expo export --platform web
firebase deploy --only hosting
```

Preview locally:
```bash
make web-preview  # Opens http://localhost:8000
```

### Mobile App (iOS/Android)

Build for production:
```bash
cd mobile
# iOS
eas build --platform ios

# Android
eas build --platform android
```

See [Expo documentation](https://docs.expo.dev/build/introduction/) for details.

## Features

- User authentication (Email/Password)
- Image upload with validation (JPEG/PNG, <10MB, >=500x500px)
- Drawing analysis with Gemini 2.0 Flash
- Story generation (5-6 pages, bilingual)
- Illustration generation with Imagen 3
- Standard page animations (Ken Burns effect)
- Highlight page animations (Veo 3.1 Fast with FFmpeg fallback)
- Narration generation (Cloud TTS)
- Video composition with crossfade transitions
- Progress tracking
- Local library management
- 24-hour data retention

## Performance Targets

- Total generation time: <180 seconds
- Upload response: <2 seconds
- Status query: <1 second
- Concurrent jobs: 3 (Veo rate limit)

## Security

- Firebase Authentication for user management
- Firestore security rules for data access control
- Cloud Storage signed URLs (24h expiry)
- Job ownership verification
- Input validation and sanitization
- Error message sanitization

## License

Proprietary - Gemini Live Agent Challenge Hackathon Entry
