# Integration Guide

This document describes how all components of Pashabook MVP are wired together.

## Architecture Overview

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│ Cloud Functions │
│  (API Gateway)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  Cloud Tasks    │────▶│  Cloud Run   │
│     Queue       │     │   Worker     │
└─────────────────┘     └──────┬───────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Firestore     │   │ Cloud Storage   │   │   AI Services   │
│  (Database)     │   │   (Files)       │   │ (Gemini, Imagen)│
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## Component Integration

### 1. Frontend to Backend API

**Mobile App → Cloud Functions**

```typescript
// mobile/lib/api.ts
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Upload endpoint
POST /api/upload
Headers: Authorization: Bearer <firebase-token>
Body: multipart/form-data { image, language }
Response: { jobId, status }

// Status endpoint
GET /api/status/:jobId
Headers: Authorization: Bearer <firebase-token>
Response: { status, progress, currentStage, error }

// Video endpoint
GET /api/video/:jobId
Headers: Authorization: Bearer <firebase-token>
Response: { videoUrl, downloadUrl, expiresAt }
```

### 2. Firebase Authentication

**Configuration:**

```typescript
// mobile/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  // ...
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

**Backend verification:**

```typescript
// backend/src/middleware/auth.ts
import { auth } from '../config/firebase.js';

export async function verifyToken(token: string) {
  const decodedToken = await auth.verifyIdToken(token);
  return decodedToken.uid;
}
```

### 3. Cloud Tasks Queue

**Configuration:**

```bash
# Create queue
gcloud tasks queues create pashabook-processing \
  --max-concurrent-dispatches=3 \
  --max-dispatches-per-second=10 \
  --location=us-central1
```

**Enqueue job:**

```typescript
// backend/src/routes/upload.ts
import { CloudTasksClient } from '@google-cloud/tasks';

const client = new CloudTasksClient();
const task = {
  httpRequest: {
    httpMethod: 'POST',
    url: `${CLOUD_RUN_URL}/process`,
    body: Buffer.from(JSON.stringify({ jobId })).toString('base64'),
    headers: {
      'Content-Type': 'application/json',
    },
  },
};

await client.createTask({
  parent: queuePath,
  task,
});
```

### 4. Processing Pipeline

**Cloud Run Worker:**

```typescript
// backend/src/services/ProcessingWorker.ts
export class ProcessingWorker {
  async processJob(jobId: string): Promise<void> {
    // 1. Image Analysis
    const analysis = await this.imageAnalyzer.analyze(imageUrl, language);
    
    // 2. Story Generation
    const story = await this.storyGenerator.generate(analysis, language);
    
    // 3. Parallel: Narration + Illustration
    const [narrations, illustrations] = await Promise.all([
      this.narrationGenerator.generateAll(story.pages, language),
      this.illustrationGenerator.generateAll(story.pages, style, jobId),
    ]);
    
    // 4. Animation
    const clips = await this.generateAnimations(pages, illustrations, narrations);
    
    // 5. Video Composition
    const videoUrl = await this.videoCompositor.compose(clips, narrations);
    
    // 6. Update job status
    await this.updateJob(jobId, { status: 'done', videoUrl });
  }
}
```

### 5. AI Services Integration

**Gemini 2.0 Flash:**

```typescript
// backend/src/services/ImageAnalyzer.ts
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: config.projectId,
  location: config.location,
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
});
```

**Imagen 3:**

```typescript
// backend/src/services/IllustrationGenerator.ts
import { PredictionServiceClient } from '@google-cloud/aiplatform';

const client = new PredictionServiceClient({
  apiEndpoint: `${config.location}-aiplatform.googleapis.com`,
});

const [response] = await client.predict({
  endpoint: `projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001`,
  instances: [{ prompt }],
});
```

**Cloud TTS:**

```typescript
// backend/src/services/NarrationGenerator.ts
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const client = new TextToSpeechClient();

const [response] = await client.synthesizeSpeech({
  input: { text },
  voice: { languageCode, name: voiceName },
  audioConfig: { audioEncoding: 'MP3' },
});
```

### 6. Cloud Storage

**Upload files:**

```typescript
// backend/src/services/IllustrationGenerator.ts
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const bucket = storage.bucket(config.bucketName);
const file = bucket.file(`illustrations/${jobId}/page-${pageNumber}.jpg`);

await file.save(imageBuffer, {
  metadata: { contentType: 'image/jpeg' },
});

const [url] = await file.getSignedUrl({
  action: 'read',
  expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
});
```

### 7. Firestore Database

**Job record structure:**

```typescript
// backend/src/types/models.ts
export interface Job {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  currentStage: string;
  progressPercentage: number;
  language: 'ja' | 'en';
  uploadedImageUrl: string;
  analysis?: Analysis;
  story?: Story;
  illustrationUrls?: string[];
  narrationAudioUrl?: string;
  animationClipUrls?: string[];
  videoUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number; // TTL field
}
```

## Environment Variables

### Mobile App (.env)

```bash
EXPO_PUBLIC_API_URL=https://us-central1-PROJECT_ID.cloudfunctions.net
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=PROJECT_ID.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### Backend (.env)

```bash
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
STORAGE_BUCKET=pashabook-videos
CLOUD_RUN_URL=https://pashabook-worker-xxxxx-uc.a.run.app
CLOUD_TASKS_QUEUE=pashabook-processing
```

## Deployment Steps

### 1. Deploy Backend

```bash
# Deploy Cloud Functions
cd backend
npm run build
gcloud functions deploy upload --runtime nodejs20 --trigger-http
gcloud functions deploy status --runtime nodejs20 --trigger-http
gcloud functions deploy video --runtime nodejs20 --trigger-http

# Deploy Cloud Run Worker
gcloud run deploy pashabook-worker \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### 2. Configure Firebase

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage
```

### 3. Setup Cloud Tasks

```bash
# Create queue
gcloud tasks queues create pashabook-processing \
  --location=us-central1
```

### 4. Deploy Mobile App

```bash
cd mobile
npm install
npx expo prebuild
npx expo run:ios  # or run:android
```

## Testing Integration

### End-to-End Test

```bash
# 1. Start mobile app
cd mobile && npm start

# 2. Upload a drawing
# 3. Monitor job status
# 4. Verify video generation
# 5. Check library save
```

### API Testing

```bash
# Test upload endpoint
curl -X POST https://API_URL/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@test.jpg" \
  -F "language=en"

# Test status endpoint
curl https://API_URL/api/status/$JOB_ID \
  -H "Authorization: Bearer $TOKEN"

# Test video endpoint
curl https://API_URL/api/video/$JOB_ID \
  -H "Authorization: Bearer $TOKEN"
```

## Monitoring

### Cloud Logging

```bash
# View function logs
gcloud logging read "resource.type=cloud_function" --limit 50

# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

### Cloud Monitoring

```bash
# View metrics
gcloud monitoring dashboards list
```

## Troubleshooting

### Common Issues

1. **Authentication errors**: Verify Firebase token is valid
2. **Upload failures**: Check file size and format
3. **Processing timeouts**: Increase Cloud Run timeout
4. **Storage errors**: Verify bucket permissions
5. **API errors**: Check Cloud Functions logs

### Debug Mode

Enable debug logging:

```typescript
// Set environment variable
DEBUG=true

// Check logs
console.log('[DEBUG]', message);
```
