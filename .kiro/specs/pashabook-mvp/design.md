# Design Document: Pashabook MVP

## Overview

Pashabook is an AI-powered storybook generation system that transforms children's drawings into animated video storybooks with narration. The system leverages Google Cloud's AI services (Gemini 2.5 Flash Image, Imagen 3, Veo 3.1 Fast, Cloud TTS) to analyze drawings, generate age-appropriate stories, create consistent illustrations, produce animations, and compose final videos.

The MVP targets the Gemini Live Agent Challenge hackathon with a focus on rapid generation (under 3 minutes), bilingual support (Japanese/English), and a clean user experience. The system uses a serverless architecture on Google Cloud Platform with asynchronous job processing to handle the multi-stage generation pipeline.

### Key Design Goals

- Fast generation pipeline (< 180 seconds end-to-end)
- Serverless architecture for cost efficiency and scalability
- Asynchronous processing with real-time progress tracking
- Bilingual support with language-specific AI models
- Graceful degradation (Veo fallback to FFmpeg)
- 24-hour data retention for hackathon demo purposes

## Architecture

### High-Level Architecture

```
┌─────────────┐
│ Mobile App  │
│(React Native│
│   + Expo)   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────────┐
│     Cloud Load Balancer                 │
└──────┬──────────────────────────────────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│  Cloud   │   │  Cloud   │   │  Cloud   │
│ Function │   │ Function │   │ Function │
│ (Upload) │   │ (Status) │   │ (Video)  │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     ▼              ▼              ▼
┌─────────────────────────────────────────┐
│           Firestore (Jobs)              │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│         Cloud Tasks (Queue)             │
│    (Max 3 concurrent jobs due to        │
│     Veo 3.1 Fast rate limits)           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│      Cloud Run (Processing Worker)      │
│  ┌────────────────────────────────┐    │
│  │  1. Image Analysis              │    │
│  │     (Gemini 2.5 Flash Image)   │    │
│  │     - Identifies climax        │    │
│  │       indicators               │    │
│  │                                │    │
│  │  2. Story + Illustration Gen   │    │
│  │     (Gemini 2.5 Flash Image)   │    │
│  │     - Interleaved output       │    │
│  │     - Selects 1-2 highlight    │    │
│  │       pages using climax       │    │
│  │     - JSON structured output   │    │
│  │     - Estimates audio durations│    │
│  │                                │    │
│  │  3. Parallel Execution:        │    │
│  │     a) Narration Generation    │    │
│  │        (Cloud TTS)             │    │
│  │        - Character voices      │    │
│  │        - Actual durations      │    │
│  │        - 0.3s silence padding  │    │
│  │     b) Animation Generation    │    │
│  │        (FFmpeg/Veo 3.1 Fast)   │    │
│  │        - Uses estimated        │    │
│  │          durations             │    │
│  │        - Ken Burns/Veo         │    │
│  │                                │    │
│  │  4. Video Composition          │    │
│  │     (FFmpeg)                   │    │
│  │     - Syncs with actual        │    │
│  │       durations                │    │
│  │     - Adjusts clip lengths     │    │
│  │     - Adds BGM from Cloud      │    │
│  │       Storage                  │    │
│  │     - Sends FCM notification   │    │
│  └────────────────────────────────┘    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│      Cloud Storage (Assets)             │
│  - Uploaded images                      │
│  - Generated illustrations              │
│  - Animation clips                      │
│  - Per-page narration audio             │
│  - Final videos                         │
│  (24-hour TTL)                          │
└─────────────────────────────────────────┘
       │
       ▼ (User saves to library)
┌─────────────────────────────────────────┐
│   Mobile AsyncStorage (Library)         │
│  - Video URL (signed, 24h expiry)       │
│  - Metadata (title, thumbnail, date)    │
│  - Persists locally on device           │
└─────────────────────────────────────────┘
```

### Component Responsibilities

**Frontend (React Native Mobile App)**
- User interface for upload, progress tracking, preview, and library
- Language selection and UI localization
- AsyncStorage management for library metadata
- Polling for job status updates
- Image picker integration for photo uploads

**Cloud Functions**
- `upload`: Validates and accepts image uploads, creates jobs, enqueues processing
- `status`: Returns job status and progress information
- `video`: Generates signed URLs for video access

**Cloud Run Worker**
- Executes the complete generation pipeline
- Manages AI service interactions
- Handles retries and fallback logic
- Updates job status in Firestore

**Firestore**
- Stores job records with status, progress, and asset URLs
- Provides real-time status tracking
- TTL-based cleanup after 24 hours

**Cloud Storage**
- Stores all generated assets
- Provides signed URLs for secure access
- Lifecycle policies for 24-hour retention

**Cloud Tasks**
- Queues processing jobs
- Ensures reliable asynchronous execution
- Handles retries on failure

### Technology Stack

- **Frontend**: React Native (Expo), TypeScript
- **Backend**: Node.js 20, Cloud Functions (2nd gen), Cloud Run
- **Authentication**: Firebase Authentication (Email/Password)
- **Push Notifications**: Firebase Cloud Messaging (FCM) for job completion notifications
- **AI Services**: Gemini 2.5 Flash Image (analysis, story + illustrations via interleaved output), Imagen 3 (fallback), Veo 3.1 Fast (highlight animations), Cloud TTS (narration with character-specific voices)
- **Storage**: Firestore, Cloud Storage, AsyncStorage (mobile local storage)
- **Queue**: Cloud Tasks
- **Video Processing**: FFmpeg
- **Deployment**: Google Cloud Platform

## Authentication Architecture

### Firebase Authentication Integration

**Authentication Flow:**
1. User registers/logs in via mobile app
2. Firebase Authentication validates credentials
3. User profile stored in Firestore `/users/{userId}` collection
4. Mobile app stores session token in AsyncStorage
5. API requests include Firebase ID token in Authorization header
6. Cloud Functions verify token using Firebase Admin SDK

**User Profile Schema (Firestore):**
```typescript
interface UserProfile {
  userId: string // Firebase UID
  name: string
  email: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Session Management:**
- Mobile: AsyncStorage stores Firebase ID token
- Token refresh handled automatically by Firebase SDK
- Logout clears AsyncStorage and revokes token

**Security:**
- Firestore Security Rules restrict user data access to authenticated users
- Job records include `userId` field for ownership verification
- Library data stored locally (AsyncStorage + FileSystem) per user session

## Push Notification Architecture

### Firebase Cloud Messaging (FCM) Integration

**Notification Flow:**
1. Mobile app registers for push notifications on app launch
2. FCM token obtained from Firebase SDK
3. Token stored in Firestore `/users/{userId}` collection (fcmToken field)
4. When job completes, Cloud Run worker sends notification via FCM Admin SDK
5. Mobile app receives notification and displays to user
6. User taps notification → app opens and navigates to preview screen

**FCM Token Management:**
- Token stored in UserProfile document in Firestore
- Token refreshed automatically by Firebase SDK
- Token updated in Firestore on refresh
- Stale tokens handled gracefully (FCM returns error, token removed from Firestore)

**Notification Payload:**
```typescript
{
  notification: {
    title: "Your storybook is ready!",
    body: "Tap to view your animated storybook"
  },
  data: {
    jobId: string,
    type: "job_complete"
  },
  token: string // User's FCM token from Firestore
}
```

**User Profile Schema Update:**
```typescript
interface UserProfile {
  userId: string // Firebase UID
  name: string
  email: string
  fcmToken?: string // FCM device token for push notifications
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Error Handling:**
- Invalid token: Remove from Firestore, user re-registers on next app launch
- Network error: Retry up to 3 times with exponential backoff
- User has no token: Skip notification (user may have disabled notifications)

## Components and Interfaces

### Frontend Components

#### App Component
Main application container managing routing and state.

```javascript
interface AppState {
  stage: 'upload' | 'processing' | 'preview' | 'library'
  language: 'ja' | 'en'
  currentJob: Job | null
  books: LibraryBook[]
}
```

#### UploadSection Component
Handles image upload with image picker.

```typescript
interface UploadSectionProps {
  onUpload: (imageUri: string) => Promise<void>
  language: 'ja' | 'en'
}
```

#### ProcessingSection Component
Displays generation progress with status updates and queue position.

```javascript
interface ProcessingSectionProps {
  jobId: string
  language: 'ja' | 'en'
}
```

**Queue Position Display:**
- When `queuePosition > 0`, display: "You are #N in queue" (or Japanese equivalent)
- When `queuePosition === 0` or undefined, display current processing stage message
- Update queue position on each status poll (every 2 seconds)
- Estimated wait time: ~3 minutes per position (based on average job completion time)

#### PreviewSection Component
Shows completed video with title editing and save/download options.

```javascript
interface PreviewSectionProps {
  job: Job
  onSave: (title: string) => void
  onDownload: () => void
  language: 'ja' | 'en'
}
```

#### LibrarySection Component
Displays saved storybooks with view and delete actions.

```javascript
interface LibrarySectionProps {
  books: LibraryBook[]
  onView: (book: LibraryBook) => void
  onDelete: (bookId: string) => void
  language: 'ja' | 'en'
}
```

### Backend API Endpoints

#### POST /api/upload
Accepts image upload and creates processing job.

**Request:**
```typescript
Content-Type: multipart/form-data
Authorization: Bearer <firebase-id-token>
{
  image: Binary (JPEG/PNG, < 10MB, >= 500x500px)
  language: 'ja' | 'en'
}
```

**Response:**
```typescript
{
  jobId: string
  status: 'pending'
  createdAt: string (ISO 8601)
}
```

**Errors:**
- 400: Invalid file format, size, or dimensions
- 500: Server error

#### GET /api/status/:jobId
Returns current job status and progress.

**Response:**
```typescript
{
  jobId: string
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: {
    stage: 'analyzing' | 'generating' | 'narrating' | 'animating' | 'composing'
    percentage: number (0-100)
  }
  queuePosition?: number // Present when status is 'pending' and position > 0
  result?: {
    title: string
    videoUrl: string
    storyText: string[]
  }
  error?: string
  updatedAt: string (ISO 8601)
}
```

**Note on Processing Order:** The pipeline follows an optimized order for performance:
1. 'analyzing' - Image analysis (Gemini 2.5 Flash Image)
2. 'generating' - Story + illustration generation with duration estimation (Gemini 2.5 Flash Image interleaved output)
3. 'narrating' and 'animating' - Parallel execution:
   - Narration generation with character voices (Cloud TTS) produces actual durations
   - Animation generation (FFmpeg/Veo 3.1 Fast) uses estimated durations from step 2
4. 'composing' - Video composition with duration adjustment, audio mixing, BGM, and FCM notification (FFmpeg)

Parallel execution of narration and animation reduces total pipeline time by 30-60 seconds. Video_Compositor performs final synchronization using actual narration durations, adjusting animation clip lengths if needed.

#### GET /api/video/:jobId
Generates signed URL for video access.

**Request:**
```typescript
Authorization: Bearer <firebase-id-token>
```

**Response:**
```typescript
{
  videoUrl: string (signed, 24-hour expiry)
  downloadUrl: string (signed, 24-hour expiry)
  expiresAt: string (ISO 8601)
}
```

**Errors:**
- 401: Unauthorized (invalid or missing token)
- 403: Forbidden (job belongs to different user)
- 404: Job not found or not complete
- 500: Server error

**Security Note:** All API endpoints verify Firebase ID tokens and check that the requested job's `userId` matches the authenticated user's ID, ensuring users can only access their own storybooks.

### Processing Pipeline Services

#### ImageAnalyzer
Analyzes uploaded drawings using Gemini 2.0 Flash.

```typescript
interface ImageAnalyzer {
  analyze(imageUrl: string, language: string): Promise<AnalysisResult>
}

interface AnalysisResult {
  characters: CharacterDescription[]
  setting: string
  style: string
  emotionalTone: string
  climaxIndicators: string[] // Key emotional elements for Story_Generator to use when selecting Highlight_Pages
}

interface CharacterDescription {
  name: string
  description: string
}
```

#### StoryGenerator
Generates story content with interleaved illustrations and duration estimation using Gemini 2.5 Flash Image.

```typescript
interface StoryGenerator {
  generate(analysis: AnalysisResult, language: string): Promise<Story>
}

interface Story {
  title: string
  pages: StoryPage[]
}

interface StoryPage {
  pageNumber: number
  narrationText: string // Deprecated: kept for backward compatibility
  narrationSegments: NarrationSegment[] // JSON structured format for character voices
  imagePrompt: string // Prompt for illustration generation
  animationMode: 'standard' | 'highlight'
  estimatedDuration: number // seconds, calculated from word count
}

interface NarrationSegment {
  text: string
  speaker: 'narrator' | 'protagonist' | 'supporting_character'
}
```

**Implementation Note:** Uses Gemini 2.5 Flash Image (gemini-2.5-flash-image) with Response_Modality set to ["TEXT", "IMAGE"] for interleaved output. This generates both story text and illustrations in a single API call, ensuring coherence between content and visuals. JSON structured output prevents parse errors in character voice separation. 

Duration estimation uses language-specific formulas for improved accuracy:
- Japanese: character count / 250 characters-per-minute (slower pacing for children aged 3-8, allows time to view illustrations)
- English: word count / 180 words-per-minute

Estimated durations enable parallel execution of narration and animation generation.

**Fallback to Imagen 3:** The system falls back to Imagen 3 for illustration generation when Gemini 2.5 Flash Image interleaved output fails. Fallback is triggered by any of the following conditions:
1. **API Error Response**: Gemini API returns 4xx or 5xx error status
2. **Request Timeout**: Gemini request exceeds 60-second timeout threshold
3. **Zero Images Returned**: Interleaved output contains text but no image data
4. **Partial Image Failure**: Some pages have images but others are missing (incomplete generation)
5. **Image Validation Failure**: Returned images fail dimension or format validation (not 1280x720, not JPEG/PNG)

When fallback occurs, the system uses the story text from Gemini (if available) and generates all page illustrations via Imagen 3 using the image prompts from the story generation step.

**Risk Note:** Gemini 2.5 Flash Image's image generation capability is currently experimental. Monitor fallback frequency to Imagen 3 during development. If fallback rate exceeds 20%, consider making Imagen 3 the primary method.

#### IllustrationGenerator
Creates page illustrations using Imagen 3 (fallback only).

```typescript
interface IllustrationGenerator {
  generateAll(pages: StoryPage[], style: string): Promise<Illustration[]>
}

interface Illustration {
  pageNumber: number
  imageUrl: string // Cloud Storage URL
  width: 1280
  height: 720
}
```

**Implementation Note:** This is a fallback mechanism used only when Gemini 2.5 Flash Image interleaved generation fails. Primary illustration generation is handled by StoryGenerator using interleaved output.

#### AnimationEngine
Creates video animations using FFmpeg or Veo 3.1 Fast with estimated durations.

```typescript
interface AnimationEngine {
  animateStandardPage(illustration: Illustration, estimatedDuration: number): Promise<VideoClip>
  animateHighlightPage(illustration: Illustration, prompt: string, estimatedDuration: number): Promise<VideoClip>
}

interface VideoClip {
  pageNumber: number
  videoUrl: string // Cloud Storage URL
  duration: number // seconds, matches estimated duration
  width: 1280
  height: 720
}

interface KenBurnsParams {
  zoomDirection: 'in' | 'out'
  panDirection: 'left' | 'right' | 'none'
}
```

**Implementation Note:** Uses estimated durations from Story_Generator to enable parallel execution with Narration_Generator. Video_Compositor performs final synchronization using actual narration durations.

#### NarrationGenerator
Creates audio narration with character-specific voices using Cloud TTS, producing actual durations.

```typescript
interface NarrationGenerator {
  generatePerPage(
    narrationSegments: NarrationSegment[], 
    language: string,
    characterVoiceMap: CharacterVoiceMap
  ): Promise<PageNarration>
  generateAll(pages: StoryPage[], language: string): Promise<PageNarration[]>
}

interface PageNarration {
  pageNumber: number
  audioSegments: AudioSegment[] // Separate audio for each character
  duration: number // Total duration in seconds (sum of all segments, actual duration)
  language: 'ja' | 'en'
}

interface AudioSegment {
  audioUrl: string // Cloud Storage URL
  speaker: 'narrator' | 'protagonist' | 'supporting_character'
  duration: number // seconds
  startTime: number // seconds, relative to page start
}

interface CharacterVoiceMap {
  [characterName: string]: VoiceConfig // e.g., {"protagonist": {...}, "narrator": {...}}
}

interface VoiceConfig {
  voiceName: string // e.g., 'ja-JP-Wavenet-B'
  pitch: number // -20.0 to 20.0
  speakingRate: number // 0.25 to 4.0
}
```

**Implementation Note:** Narration is generated per-page with character-specific voices. Each character type (narrator, protagonist, supporting characters) receives a distinct TTS voice configuration. Audio segments are generated separately and will be mixed by VideoCompositor. The `generateAll` method processes pages in parallel for efficiency. The total duration per page (actual duration from TTS) is used by Video_Compositor for final synchronization with animation clips.

**Character Voice Consistency:** To maintain consistent voice assignment across all pages, the system implements a character-to-voice mapping mechanism:

1. **Mapping Creation**: On first encounter of each character (during page 1 narration generation), the system assigns a TTS voice ID and stores the mapping in the Job record's `characterVoiceMap` field
2. **Mapping Structure**: `{"protagonist": "ja-JP-Wavenet-B", "supporting_character_1": "ja-JP-Wavenet-C", "narrator": "ja-JP-Wavenet-A"}`
3. **Mapping Persistence**: The mapping is stored in Firestore and retrieved for each subsequent page's narration generation
4. **Character Identification**: Character names from Image_Analyzer are used as keys in the mapping dictionary
5. **Lookup Process**: Before generating audio for any character segment, Narration_Generator checks the `characterVoiceMap` for an existing voice assignment. If found, use that voice ID. If not found (new character), assign a new voice ID and update the mapping in Firestore.

Example flow:
- Page 1: "protagonist" appears → assign ja-JP-Wavenet-B → store in Job.characterVoiceMap
- Page 3: "protagonist" appears → lookup Job.characterVoiceMap → retrieve ja-JP-Wavenet-B → use same voice
- Page 5: "protagonist" appears → lookup Job.characterVoiceMap → retrieve ja-JP-Wavenet-B → use same voice

This ensures characters like "くまのプーさん" (Winnie the Pooh) use the same TTS voice consistently across all pages, maintaining character voice identity throughout the storybook.

#### VideoCompositor
Combines clips, character audio tracks, and BGM using FFmpeg with duration adjustment and FCM notification.

```typescript
interface VideoCompositor {
  compose(
    clips: VideoClip[], 
    pageNarrations: PageNarration[],
    emotionalTone: string,
    userId: string,
    fcmToken: string
  ): Promise<FinalVideo>
}

interface FinalVideo {
  videoUrl: string // Cloud Storage URL
  duration: number // seconds
  width: 1280
  height: 720
  format: 'mp4'
}
```

**Implementation Note:** The compositor:
1. Synchronizes each video clip with actual narration duration from PageNarration
2. Adjusts clip duration if estimated duration differs from actual duration (adds static frames at end or trims excess)
3. Inserts 0.3-second silence padding between narrator segments and character dialogue segments for natural pacing (prevents audio from feeling rushed or overlapping)
4. Applies 50ms crossfade transitions between character voice segments (within character dialogue only, not between narrator and character segments)
5. Applies 0.5-second crossfade transitions between page clips
6. Selects BGM track based on emotional tone (bright, adventure, sad, calm) from Cloud Storage
   - BGM path configured via environment variable: `BGM_STORAGE_PATH` (default: `gs://pashabook-assets/bgm/`)
   - Filenames: `bright.mp3`, `adventure.mp3`, `sad.mp3`, `calm.mp3`
7. Mixes BGM at 20-30% of narration volume with 1-second fade-in/out
8. Sends FCM push notification to user's device when composition completes

The 0.3-second silence padding creates natural rhythm similar to human read-aloud, while the 50ms crossfade smooths voice changes within character dialogue.

**Duration Adjustment Tolerance:** The system tolerates duration differences up to ±3 seconds between estimated and actual durations. Within this range:
- Small differences (< 1 second): Minimal visual impact, Ken Burns effect continues smoothly
- Medium differences (1-3 seconds): Acceptable quality, static frames added at end or slight speed adjustment
- Large differences (> 3 seconds): May indicate estimation error; logged as warning for monitoring

If duration difference exceeds 3 seconds, the system logs a warning but continues processing. This threshold balances performance optimization (parallel execution) with video quality. The 250 characters-per-minute formula for Japanese typically produces estimates within ±1 second of actual duration.

**Duration Adjustment Implementation Details:**

When actual narration duration differs from estimated animation duration:

1. **Narration shorter than animation (need to shorten video)**:
   - **Preferred approach**: Use FFmpeg `setpts` filter to adjust playback speed by ±10% maximum
   - Example: If animation is 10s but narration is 9s, speed up video to 1.11x (10s / 9s = 1.11)
   - This preserves Ken Burns effect smoothness without abrupt cuts
   - **Fallback**: If speed adjustment exceeds ±10%, trim excess frames from end and add 0.5s freeze frame to soften transition

2. **Narration longer than animation (need to extend video)**:
   - Add static frames at end (freeze last frame) to match narration duration
   - Apply 0.3s fade-out on final frame for smooth ending

3. **Speed adjustment formula**:
   ```
   speedFactor = estimatedDuration / actualDuration
   if (speedFactor > 0.9 && speedFactor < 1.1):
     use setpts filter with speedFactor
   else:
     use static frame extension/trimming
   ```

This approach prevents jarring mid-zoom cuts while maintaining visual quality.

## Data Models

### Firestore Schema

#### Job Collection

```typescript
interface Job {
  jobId: string // Document ID
  userId: string // Firebase UID of the user who created this job
  status: 'pending' | 'processing' | 'done' | 'error'
  language: 'ja' | 'en'
  
  // Asset URLs
  uploadedImageUrl?: string
  illustrationUrls?: string[]
  animationClipUrls?: string[]
  narrationAudioUrls?: string[] // Array of URLs for all audio segments across all pages
  finalVideoUrl?: string
  
  // Generation results
  analysis?: AnalysisResult
  story?: Story
  estimatedDurations?: number[] // Per-page estimated durations from Story_Generator
  actualDurations?: number[] // Per-page actual durations from Narration_Generator
  characterVoiceMap?: CharacterVoiceMap // Character-to-voice mapping for consistent voices
  
  // Progress tracking
  currentStage?: 'analyzing' | 'generating' | 'animating' | 'narrating' | 'composing'
  progressPercentage?: number
  queuePosition?: number // Position in Cloud Tasks queue (only when status is 'pending')
  
  // Error handling
  error?: string
  
  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
  ttl: Timestamp // 23 hours from creation (1 hour before Cloud Storage deletion)
}

interface CharacterVoiceMap {
  [characterName: string]: VoiceConfig // e.g., {"protagonist": {...}, "narrator": {...}}
}

interface VoiceConfig {
  voiceName: string // e.g., 'ja-JP-Wavenet-B'
  pitch: number // -20.0 to 20.0
  speakingRate: number // 0.25 to 4.0
}
```

**Indexes:**
- `jobId` (primary key)
- `userId` (for user's job queries)
- `ttl` (for cleanup)

**Implementation Note:** Firestore TTL is set to 23 hours (1 hour shorter than Cloud Storage lifecycle policy) to prevent "metadata exists but video deleted" inconsistent states. The `estimatedDurations` field stores duration estimates from Story_Generator for parallel processing. The `actualDurations` field stores actual narration durations from Narration_Generator for final video synchronization. The `queuePosition` field is calculated when status is 'pending' and there are 3 or more active jobs in the Cloud Tasks queue. The 'illustrating' stage is removed from `currentStage` enum as illustration generation is now part of the 'generating' stage (interleaved output).

### Local Storage Schema

#### Library Storage

```typescript
interface LibraryBook {
  id: string // Unique identifier (timestamp)
  title: string // User-editable title
  videoUri: string // Local file URI on device
  thumbnailUri: string // Local thumbnail file URI
  createdAt: string // ISO 8601
}

// Storage: Metadata in AsyncStorage
// Key: 'library_books'
// Value: JSON.stringify(LibraryBook[])
// Video files: Stored in app's document directory using React Native FileSystem
```

**Note:** Videos are downloaded and stored as files in the app's document directory. Metadata (title, URIs, timestamps) is stored in AsyncStorage. This approach supports large video files (50MB+) and persists data beyond the 24-hour server deletion window.

### Cloud Storage Structure

```
gs://pashabook-assets/
  bgm/
    bright.mp3
    adventure.mp3
    sad.mp3
    calm.mp3
  jobs/
    {jobId}/
      uploaded/
        original.jpg
      illustrations/
        page-1.jpg
        page-2.jpg
        ...
      animations/
        page-1.mp4
        page-2.mp4
        ...
      narration/
        page-1-narrator.mp3
        page-1-protagonist.mp3
        page-2-narrator.mp3
        page-2-protagonist.mp3
        ...
      final/
        video.mp4
```

**Lifecycle Policy:**
- Delete all objects after 24 hours

**Implementation Note:** Cloud Storage lifecycle policy is set to 24 hours. Firestore TTL is set to 23 hours (1 hour shorter) to ensure Job records are deleted before or simultaneously with their associated Cloud Storage objects, preventing "metadata exists but video deleted" inconsistent states.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid Image Format Acceptance

*For any* JPEG or PNG image file that meets size and dimension requirements, the upload endpoint should accept the file and return a valid job ID.

**Validates: Requirements 1.1, 1.2, 1.5, 1.6, 1.7**

### Property 2: Job ID Uniqueness

*For any* two valid image uploads, the system should return distinct job IDs.

**Validates: Requirements 1.7**

### Property 3: Highlight Page Count Constraint

*For any* generated story, the number of designated highlight pages (selected using identified climax indicators) should be between 1 and 2 inclusive.

**Validates: Requirements 4.9**

### Property 4: Story Duration Estimation

*For any* generated story page, the estimated duration should be calculated using language-specific formulas:
- Japanese: (character count / 250 characters-per-minute)
- English: (word count / 180 words-per-minute)

**Validates: Requirements 4.18-4.19**

### Property 5: Analysis Persistence

*For any* completed image analysis, querying the job record should return the same analysis results.

**Validates: Requirements 3.7**

### Property 6: Story Page Count Constraint

*For any* generated story, the number of pages should be between 5 and 6 inclusive.

**Validates: Requirements 4.3**

### Property 7: Character Description Incorporation

*For any* generated story, all character names from the analysis should appear in at least one page's narration text or image prompt.

**Validates: Requirements 4.5**

### Property 8: Style Description Incorporation

*For any* generated story, the style description from the analysis should appear in all image prompts.

**Validates: Requirements 4.6**

### Property 9: Story Title Existence

*For any* generated story, the title field should be non-empty.

**Validates: Requirements 4.8**

### Property 10: Narration Word Count Constraint

*For any* story page, the narration text should contain between 20 and 100 words inclusive.

**Validates: Requirements 4.9**

### Property 11: Image Prompt Completeness

*For any* generated story, every page should have a non-empty image prompt.

**Validates: Requirements 4.10**

### Property 12: Animation Mode Validity

*For any* story page, the animation mode should be either "standard" or "highlight".

**Validates: Requirements 4.12**

### Property 13: Language Selection for Story Content

*For any* story generation request with language parameter L, the generated story content should be detected as language L.

**Validates: Requirements 4.13, 4.14**

### Property 14: Illustration Count Matches Page Count

*For any* generated story with N pages, the illustration generator should produce exactly N illustrations.

**Validates: Requirements 5.3**

### Property 15: Style in Illustration Prompts

*For any* illustration generation, all image prompts should contain the style description from the analysis.

**Validates: Requirements 5.4**

### Property 16: Characters in Illustration Prompts

*For any* illustration generation, all image prompts should contain character descriptions from the analysis.

**Validates: Requirements 5.5**

### Property 17: Illustration Resolution

*For any* generated illustration, the image dimensions should be exactly 1280x720 pixels.

**Validates: Requirements 5.5**

### Property 18: Illustration Storage

*For any* generated illustration, the image should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 5.6**

### Property 19: Illustration URLs in Job Record

*For any* completed illustration generation, the job record should contain URLs for all generated illustrations.

**Validates: Requirements 5.7**

### Property 20: Standard Page Animation Completeness

*For any* story with N standard pages, the animation engine should produce exactly N standard page animations.

**Validates: Requirements 6.1**

### Property 21: Zoom Direction Validity

*For any* standard page animation, the zoom direction should be either "in" or "out".

**Validates: Requirements 6.3**

### Property 22: Pan Direction Validity

*For any* standard page animation, the pan direction should be one of "left", "right", or "none".

**Validates: Requirements 6.4**

### Property 23: Standard Page Clip Duration

*For any* standard page animation clip, the duration should match the estimated duration for that page (±0.1 seconds tolerance).

**Validates: Requirements 6.6**

### Property 24: Animation Clip Storage

*For any* generated animation clip, the video should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 6.7**

### Property 25: Animation URLs in Job Record

*For any* completed animation generation, the job record should contain URLs for all animation clips.

**Validates: Requirements 6.8**

### Property 26: Highlight Page Animation Completeness

*For any* story with M highlight pages, the animation engine should produce exactly M highlight page animations.

**Validates: Requirements 7.1**

### Property 27: Highlight Page Clip Duration

*For any* highlight page animation clip, the duration should match the estimated duration for that page (±0.1 seconds tolerance).

**Validates: Requirements 7.2**

### Property 28: Highlight Clip Storage

*For any* generated highlight page clip, the video should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 7.6**

### Property 29: Highlight URLs in Job Record

*For any* completed highlight page generation, the job record should contain URLs for all highlight page clips.

**Validates: Requirements 7.7**

### Property 30: Narration Generation

*For any* completed story generation, the narration generator should produce a non-empty audio file.

**Validates: Requirements 8.1**

### Property 31: Narration Storage

*For any* generated narration audio, the file should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 8.5**

### Property 32: Narration URL in Job Record

*For any* completed narration generation, the job record should contain the narration audio URL.

**Validates: Requirements 8.6**

### Property 33: Video Clip Count

*For any* video composition with N pages, the final video should contain exactly N clips.

**Validates: Requirements 9.1**

### Property 34: Audio-Video Synchronization

*For any* final video, the narration audio duration should match the video duration (±0.5 seconds tolerance).

**Validates: Requirements 9.3**

### Property 35: Final Video Resolution

*For any* final video, the dimensions should be exactly 1280x720 pixels.

**Validates: Requirements 9.4**

### Property 36: Final Video Format

*For any* final video, the file format should be MP4.

**Validates: Requirements 9.5**

### Property 37: Final Video Storage

*For any* generated final video, the file should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 9.6**

### Property 38: Job Status Update on Completion

*For any* completed video composition, the job status should be "done" and the job record should contain the final video URL.

**Validates: Requirements 9.7**

### Property 39: Job Status Transition to Processing

*For any* job that begins generation, the status should transition from "pending" to "processing".

**Validates: Requirements 10.1**

### Property 40: Job Status Transition to Done

*For any* job that completes successfully, the status should transition to "done".

**Validates: Requirements 10.2**

### Property 41: Job Status Transition to Error

*For any* job where a component fails, the status should transition to "error".

**Validates: Requirements 10.3**

### Property 42: Error Message Storage

*For any* job with status "error", the job record should contain a non-empty error message.

**Validates: Requirements 10.4**

### Property 43: Timestamp Updates

*For any* job status change, the updatedAt timestamp should be more recent than the previous updatedAt value.

**Validates: Requirements 10.5**

### Property 44: Job Query Round-Trip

*For any* created job with ID J, querying the status endpoint with ID J should return a job record with the same ID.

**Validates: Requirements 10.6**

### Property 45: Signed URL Generation

*For any* completed job, the video endpoint should return a signed URL that is accessible and valid for 24 hours.

**Validates: Requirements 11.1**

### Property 46: Title Display with Video

*For any* completed job displayed in the preview section, the UI should show the story title.

**Validates: Requirements 11.4**

### Property 47: Story Text Display with Video

*For any* completed job displayed in the preview section, the UI should show the story text for all pages.

**Validates: Requirements 11.5**

### Property 48: UI Language Selection

*For any* language selection change, all UI text should update to the selected language.

**Validates: Requirements 12.3**

### Property 49: Story Content Language

*For any* generation request with language L, the generated story content should be in language L.

**Validates: Requirements 12.4**

### Property 50: Narration Language

*For any* generation request with language L, the narration audio should be in language L.

**Validates: Requirements 12.5**

### Property 52: Library Save Functionality

*For any* completed storybook that is saved, the library should contain an entry for that storybook.

**Validates: Requirements 13.1**

### Property 53: Local Storage Persistence

*For any* saved storybook, the video file should be retrievable from the device's file system and metadata should be retrievable from AsyncStorage.

**Validates: Requirements 13.2, 13.3, 13.6, 13.7**

### Property 54: Library Display Completeness

*For any* library with N saved storybooks, the library view should display exactly N storybook cards.

**Validates: Requirements 13.4**

### Property 55: Library Delete Functionality

*For any* storybook deleted from the library, the library should no longer contain that storybook.

**Validates: Requirements 13.5**

### Property 56: Saved Storybook Fields

*For any* saved storybook, the stored data should include title, video file URI, thumbnail URI, and creation timestamp fields.

**Validates: Requirements 13.7**

### Property 57: Library Thumbnail Display

*For any* storybook in the library view, a thumbnail image should be displayed.

**Validates: Requirements 13.8**

### Property 58: Default Title Display

*For any* newly generated storybook, the preview should initially display the AI-generated title.

**Validates: Requirements 14.1**

### Property 59: Title Edit Functionality

*For any* storybook in preview, editing the title field should update the displayed title.

**Validates: Requirements 14.2**

### Property 60: Custom Title Persistence

*For any* edited title that is saved, reloading the storybook should display the custom title.

**Validates: Requirements 14.3**

### Property 61: Custom Title in Library

*For any* storybook with a custom title, the library view should display the custom title instead of the original.

**Validates: Requirements 14.4**

### Property 62: Upload Error Messages

*For any* failed image upload, the UI should display a non-empty error message.

**Validates: Requirements 17.1**

### Property 63: Generation Error Messages

*For any* failed generation, the UI should display a non-empty error message.

**Validates: Requirements 17.2**

### Property 64: Network Error Retry Option

*For any* network error, the UI should display a retry option.

**Validates: Requirements 17.3**

### Property 65: Error Logging

*For any* error that occurs, an entry should be created in Cloud Logging.

**Validates: Requirements 17.4**

### Property 66: Error Message Sanitization

*For any* error message displayed to users, the message should not contain internal implementation details (stack traces, file paths, database queries).

**Validates: Requirements 17.5**

### Property 67: Queue Position Calculation

*For any* job in "pending" status when Cloud Tasks queue has 3 or more active jobs, the status endpoint should return a queuePosition value greater than 0.

**Validates: Requirements 10.8, 10.9**

### Property 68: FCM Notification on Completion

*For any* job that transitions to "done" status, a push notification should be sent to the user's device via Firebase Cloud Messaging.

**Validates: Requirements 11.6**

### Property 69: Duration Estimation Storage

*For any* completed story generation, the Job record should contain estimatedDurations array with one value per page.

**Validates: Requirements 4.19**

### Property 70: Actual Duration Storage

*For any* completed narration generation, the Job record should contain actualDurations array with one value per page.

**Validates: Requirements 8.12-8.13**

### Property 71: Duration Adjustment in Composition

*For any* video composition where animation clip duration differs from actual narration duration, the final video should have clips adjusted to match actual narration duration (±0.1 seconds tolerance).

**Validates: Requirements 9.3**

## Error Handling

### Upload Validation Errors

**File Format Error**
- Trigger: Non-JPEG/PNG file uploaded
- Response: 400 Bad Request
- Message: "Please upload a JPEG or PNG image file"

**File Size Error**
- Trigger: File exceeds 10MB
- Response: 400 Bad Request
- Message: "Image file must be smaller than 10MB"

**Dimension Error**
- Trigger: Image smaller than 500x500 pixels
- Response: 400 Bad Request
- Message: "Image must be at least 500x500 pixels"

### Generation Errors

**AI Service Timeout**
- Trigger: Gemini/Imagen/Veo request exceeds timeout
- Action: Retry up to 3 times with exponential backoff (1s, 2s, 4s delays)
- Fallback: For Veo timeout, use FFmpeg Ken Burns effect
- Job Status: "error" if all retries fail
- Message: "Generation timed out. Please try again."

**AI Service Error**
- Trigger: Gemini/Imagen/Veo returns error response (4xx/5xx)
- Action: Retry up to 3 times with exponential backoff (1s, 2s, 4s delays)
- Fallback: For Veo error, use FFmpeg Ken Burns effect
- Job Status: "error" if all retries fail
- Message: "AI service error. Please try again."

**AI Service Rate Limit**
- Trigger: Gemini API returns 429 (Too Many Requests) or quota exceeded error
- Action: Exponential backoff with jitter (base delay: 2s, max delay: 32s)
- Retry formula: `delay = min(baseDelay * 2^attempt + random(0, 1000ms), maxDelay)`
- Max retries: 5 attempts
- Job Status: "error" if all retries fail
- Message: "Service temporarily unavailable. Please try again in a few minutes."
- **Implementation Note**: Gemini 2.5 Flash Image interleaved output has large payloads. Rate limits may be hit on token throughput rather than RPM during hackathon peak usage. Exponential backoff with jitter prevents thundering herd problem.

**Storage Error**
- Trigger: Cloud Storage upload/download fails
- Action: Retry up to 3 times with exponential backoff (1s, 2s, 4s delays)
- Job Status: "error" if all retries fail
- Message: "Storage error. Please try again."

**FFmpeg Error**
- Trigger: Video processing fails
- Action: Retry once with 2s delay
- Job Status: "error" if retry fails
- Message: "Video processing error. Please try again."

### Network Errors

**Frontend Network Error**
- Trigger: API request fails due to network
- Action: Display retry button
- Message: "Network error. Please check your connection and try again."

**Backend Network Error**
- Trigger: External service unreachable
- Action: Retry with exponential backoff
- Logging: Log to Cloud Logging with full error details

### Error Logging Strategy

All errors are logged to Cloud Logging with:
- Error type and message
- Job ID (if applicable)
- Timestamp
- Stack trace (server-side only)
- Request context

User-facing error messages are sanitized to remove:
- Stack traces
- File paths
- Database queries
- API keys or credentials
- Internal service names

## Infrastructure Configuration

### Cloud Run Configuration

**CPU Boost Settings**
- Enable CPU boost for FFmpeg-intensive operations
- Configuration: `--cpu-boost` flag in Cloud Run deployment
- Benefit: Reduces video composition time by 30-50% (from ~20s to ~10-15s)
- Cost impact: Minimal for hackathon demo (pay-per-use, only during active processing)

**Deployment Command:**
```bash
gcloud run deploy pashabook-worker \
  --image gcr.io/PROJECT_ID/pashabook-worker \
  --cpu-boost \
  --cpu 2 \
  --memory 4Gi \
  --timeout 300s \
  --region asia-northeast1
```

**Rationale:** FFmpeg video composition (merging clips, audio mixing, Ken Burns effects) is CPU-intensive. CPU boost allocates additional CPU during container startup and processing, significantly reducing composition time. This is especially important for hackathon demos where fast turnaround creates better user experience.

### Cloud Storage CORS Configuration

**CORS Policy for Mobile App Access**

Mobile apps (React Native/Expo) require CORS headers to access Cloud Storage resources (videos, images) from signed URLs. Without CORS configuration, the app will encounter "CORS policy" errors when attempting to play videos or display images.

**CORS Configuration File (`cors.json`):**
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Range"],
    "maxAgeSeconds": 3600
  }
]
```

**Deployment Command:**
```bash
gsutil cors set cors.json gs://pashabook-assets
```

**Security Note:** Using `"origin": ["*"]` is acceptable for hackathon demo with public read access. For production, restrict to specific domains:
```json
"origin": ["https://pashabook.app", "exp://192.168.*"]
```

**Common CORS Errors Prevented:**
- "Access to fetch at '...' from origin '...' has been blocked by CORS policy"
- "No 'Access-Control-Allow-Origin' header is present on the requested resource"
- Video player fails to load signed URL content

### Mobile App Share Feature (Optional)

**React Native Share API Integration**

Add social sharing capability to allow users to share generated storybooks directly from the app to LINE, SNS, or other platforms.

**Implementation:**
```typescript
import { Share } from 'react-native'

const shareStorybook = async (videoUrl: string, title: string) => {
  try {
    await Share.share({
      message: `Check out my storybook: ${title}`,
      url: videoUrl, // iOS only
      title: title
    })
  } catch (error) {
    console.error('Share error:', error)
  }
}
```

**Platform Behavior:**
- iOS: Shares video URL via native share sheet (Messages, Mail, LINE, etc.)
- Android: Shares message text with URL (some apps may not support direct video sharing)

**UX Enhancement:** Adds "Share" button next to "Download" button in PreviewSection component. This creates a compelling demo narrative: "子供の絵がこんなに簡単にシェアできる" (Children's drawings can be shared this easily).

**Implementation Priority:** Optional for MVP. Can be added post-hackathon if time permits.

### Environment Variables

**Required Environment Variables for Cloud Run:**
```bash
GCP_PROJECT_ID=pashabook-dev
GCP_REGION=asia-northeast1
VERTEX_AI_LOCATION=asia-northeast1
CLOUD_RUN_SERVICE_URL=https://pashabook-worker-xxx.run.app
BGM_STORAGE_PATH=gs://pashabook-assets/bgm/
FIREBASE_PROJECT_ID=pashabook-dev
```

**Deployment Configuration:**
- Set via Terraform or `gcloud run deploy --set-env-vars`
- Store sensitive values (API keys) in Secret Manager
- Reference secrets via `--set-secrets` flag

### Deployment Checklist

Before deploying to production:
- [ ] Cloud Run CPU boost enabled
- [ ] Cloud Storage CORS policy configured
- [ ] Environment variables set correctly
- [ ] BGM files uploaded to Cloud Storage
- [ ] Firestore indexes created
- [ ] Cloud Tasks queue configured (max 3 concurrent)
- [ ] Firebase Authentication enabled
- [ ] FCM configured for push notifications
- [ ] Lifecycle policies set (24-hour TTL)

## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Upload validation with specific invalid files
- Ken Burns effect application
- Crossfade transition timing
- Language-specific voice selection
- Veo fallback scenarios
- Mobile video playback compatibility

**Property-Based Tests**: Verify universal properties across all inputs
- Run minimum 100 iterations per property test
- Use randomized inputs to discover edge cases
- Tag each test with feature name and property number
- Focus on properties defined in Correctness Properties section

### Property-Based Testing Configuration

**Library**: fast-check (JavaScript/TypeScript)

**Test Structure**:
```javascript
import fc from 'fast-check'

// Feature: pashabook-mvp, Property 1: Valid Image Format Acceptance
test('accepts valid JPEG and PNG images', () => {
  fc.assert(
    fc.property(
      fc.oneof(validJpegArbitrary(), validPngArbitrary()),
      async (imageFile) => {
        const response = await uploadImage(imageFile)
        expect(response.jobId).toBeDefined()
        expect(response.status).toBe('pending')
      }
    ),
    { numRuns: 100 }
  )
})
```

**Generators (Arbitraries)**:
- Valid image files (JPEG/PNG, various sizes)
- Job records with different states
- Story content with varying page counts
- Animation parameters
- Language selections

### Unit Testing Focus Areas

**Upload Validation**
- Test specific invalid formats (GIF, BMP, WEBP)
- Test exact boundary conditions (10MB, 500x500px)
- Test corrupted file handling

**AI Integration**
- Mock AI service responses
- Test retry logic with specific failure scenarios
- Test timeout handling

**Video Processing**
- Test FFmpeg command generation
- Test Ken Burns effect parameters
- Test crossfade transition timing (0.5 seconds)
- Test audio-video synchronization

**Frontend**
- Test language switching
- Test library CRUD operations
- Test title editing
- Test progress display updates

**Error Handling**
- Test all error message formats
- Test retry button functionality
- Test error message sanitization

### Integration Testing

**End-to-End Flow**
- Upload → Analysis → Story → Illustration → Animation → Narration → Composition
- Test with sample drawings
- Verify final video playback
- Verify 24-hour expiry

**API Integration**
- Test all API endpoints
- Test signed URL generation and expiry
- Test concurrent job processing

### Coverage Targets

- Overall: 60% or higher
- Critical paths (upload, generation pipeline excluding Veo integration): 80% or higher
- New code: 80% or higher

**Note:** Veo 3.1 Fast integration is excluded from critical path coverage requirements due to external API dependency. Veo functionality is tested with mocks and validated through manual integration testing.

### Testing Commands

```bash
make test              # All tests
make test-unit         # Unit tests only
make test-property     # Property-based tests only
make test-e2e          # End-to-end tests
make test -- --coverage # With coverage report
```

