# Design Document: Pashabook MVP

## Overview

Pashabook is an AI-powered storybook generation system that transforms children's drawings into animated video storybooks with narration. The system leverages Google Cloud's AI services (Gemini 2.0 Flash, Imagen 3, Veo 3.1 Fast, Cloud TTS) to analyze drawings, generate age-appropriate stories, create consistent illustrations, produce animations, and compose final videos.

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
│  │  1. Image Analysis (Gemini)    │    │
│  │     - Identifies climax        │    │
│  │       indicators               │    │
│  │  2. Story Generation (Gemini)  │    │
│  │     - Selects 1-2 highlight    │    │
│  │       pages using climax       │    │
│  │       indicators               │    │
│  │                                │    │
│  │  3. PARALLEL EXECUTION:        │    │
│  │     ├─ Narration (Cloud TTS)   │    │
│  │     │  per-page, determines    │    │
│  │     │  clip durations          │    │
│  │     └─ Illustration (Imagen 3) │    │
│  │        all pages in parallel   │    │
│  │                                │    │
│  │  4. Animation (FFmpeg/Veo)     │    │
│  │     - Uses narration durations │    │
│  │  5. Video Composition (FFmpeg) │    │
│  │     - Syncs clips with audio   │    │
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
- **AI Services**: Gemini 2.0 Flash, Imagen 3, Veo 3.1 Fast, Cloud TTS
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
Displays generation progress with status updates.

```javascript
interface ProcessingSectionProps {
  jobId: string
  language: 'ja' | 'en'
}
```

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
    stage: 'analyzing' | 'generating' | 'illustrating' | 'animating' | 'narrating' | 'composing'
    percentage: number (0-100)
  }
  result?: {
    title: string
    videoUrl: string
    storyText: string[]
  }
  error?: string
  updatedAt: string (ISO 8601)
}
```

**Note on Parallel Stages:** During parallel execution of narration and illustration generation, the system reports the stage of whichever process started first. The stage transitions to 'animating' only after both narration and illustration are complete.

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
Generates story content using Gemini 2.0 Flash.

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
  narrationText: string // 20-100 words
  imagePrompt: string
  animationMode: 'standard' | 'highlight'
}
```

#### IllustrationGenerator
Creates page illustrations using Imagen 3.

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

#### AnimationEngine
Creates video animations using FFmpeg or Veo 3.1 Fast.

```typescript
interface AnimationEngine {
  animateStandardPage(illustration: Illustration, narrationDuration: number): Promise<VideoClip>
  animateHighlightPage(illustration: Illustration, prompt: string, narrationDuration: number): Promise<VideoClip>
}

interface VideoClip {
  pageNumber: number
  videoUrl: string // Cloud Storage URL
  duration: number // seconds, matches narration duration
  width: 1280
  height: 720
}

interface KenBurnsParams {
  zoomDirection: 'in' | 'out'
  panDirection: 'left' | 'right' | 'none'
}
```

#### NarrationGenerator
Creates audio narration using Cloud TTS.

```typescript
interface NarrationGenerator {
  generatePerPage(pageText: string, language: string): Promise<PageNarration>
  generateAll(pages: StoryPage[], language: string): Promise<PageNarration[]>
}

interface PageNarration {
  pageNumber: number
  audioUrl: string // Cloud Storage URL
  duration: number // seconds
  language: 'ja' | 'en'
}
```

**Note:** Narration is generated per-page to determine individual clip durations before animation generation. The `generateAll` method processes pages in parallel for efficiency.

#### VideoCompositor
Combines clips and audio using FFmpeg.

```typescript
interface VideoCompositor {
  compose(clips: VideoClip[], pageNarrations: PageNarration[]): Promise<FinalVideo>
}

interface FinalVideo {
  videoUrl: string // Cloud Storage URL
  duration: number // seconds
  width: 1280
  height: 720
  format: 'mp4'
}
```

**Note:** The compositor synchronizes each video clip with its corresponding page narration audio.

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
  narrationAudioUrl?: string
  finalVideoUrl?: string
  
  // Generation results
  analysis?: AnalysisResult
  story?: Story
  
  // Progress tracking
  currentStage?: 'analyzing' | 'generating' | 'illustrating' | 'animating' | 'narrating' | 'composing'
  progressPercentage?: number
  
  // Error handling
  error?: string
  
  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
  ttl: Timestamp // 24 hours from creation
}
```

**Indexes:**
- `jobId` (primary key)
- `userId` (for user's job queries)
- `ttl` (for cleanup)

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
        audio.mp3
      final/
        video.mp4
```

**Lifecycle Policy:**
- Delete all objects after 24 hours

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

### Property 4: Analysis Persistence

*For any* completed image analysis, querying the job record should return the same analysis results.

**Validates: Requirements 3.7**

### Property 5: Story Page Count Constraint

*For any* generated story, the number of pages should be between 5 and 6 inclusive.

**Validates: Requirements 4.1**

### Property 6: Character Description Incorporation

*For any* generated story, all character names from the analysis should appear in at least one page's narration text or image prompt.

**Validates: Requirements 4.3**

### Property 7: Style Description Incorporation

*For any* generated story, the style description from the analysis should appear in all image prompts.

**Validates: Requirements 4.4**

### Property 8: Story Title Existence

*For any* generated story, the title field should be non-empty.

**Validates: Requirements 4.6**

### Property 9: Narration Word Count Constraint

*For any* story page, the narration text should contain between 20 and 100 words inclusive.

**Validates: Requirements 4.7**

### Property 10: Image Prompt Completeness

*For any* generated story, every page should have a non-empty image prompt.

**Validates: Requirements 4.8**

### Property 11: Animation Mode Validity

*For any* story page, the animation mode should be either "standard" or "highlight".

**Validates: Requirements 4.9**

### Property 12: Language Selection for Story Content

*For any* story generation request with language parameter L, the generated story content should be detected as language L.

**Validates: Requirements 4.10, 4.11**

### Property 13: Illustration Count Matches Page Count

*For any* generated story with N pages, the illustration generator should produce exactly N illustrations.

**Validates: Requirements 5.1**

### Property 14: Style in Illustration Prompts

*For any* illustration generation, all image prompts should contain the style description from the analysis.

**Validates: Requirements 5.2**

### Property 15: Characters in Illustration Prompts

*For any* illustration generation, all image prompts should contain character descriptions from the analysis.

**Validates: Requirements 5.3**

### Property 16: Illustration Resolution

*For any* generated illustration, the image dimensions should be exactly 1280x720 pixels.

**Validates: Requirements 5.5**

### Property 17: Illustration Storage

*For any* generated illustration, the image should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 5.6**

### Property 18: Illustration URLs in Job Record

*For any* completed illustration generation, the job record should contain URLs for all generated illustrations.

**Validates: Requirements 5.7**

### Property 19: Standard Page Animation Completeness

*For any* story with N standard pages, the animation engine should produce exactly N standard page animations.

**Validates: Requirements 6.1**

### Property 20: Zoom Direction Validity

*For any* standard page animation, the zoom direction should be either "in" or "out".

**Validates: Requirements 6.3**

### Property 21: Pan Direction Validity

*For any* standard page animation, the pan direction should be one of "left", "right", or "none".

**Validates: Requirements 6.4**

### Property 22: Standard Page Clip Duration

*For any* standard page animation clip, the duration should match the narration audio duration for that page (±0.1 seconds tolerance).

**Validates: Requirements 6.5**

### Property 23: Animation Clip Storage

*For any* generated animation clip, the video should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 6.7**

### Property 24: Animation URLs in Job Record

*For any* completed animation generation, the job record should contain URLs for all animation clips.

**Validates: Requirements 6.8**

### Property 25: Highlight Page Animation Completeness

*For any* story with M highlight pages, the animation engine should produce exactly M highlight page animations.

**Validates: Requirements 7.1**

### Property 26: Highlight Page Clip Duration

*For any* highlight page animation clip, the duration should match the narration audio duration for that page (±0.1 seconds tolerance).

**Validates: Requirements 7.2**

### Property 27: Highlight Clip Storage

*For any* generated highlight page clip, the video should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 7.6**

### Property 28: Highlight URLs in Job Record

*For any* completed highlight page generation, the job record should contain URLs for all highlight page clips.

**Validates: Requirements 7.7**

### Property 29: Narration Generation

*For any* completed story generation, the narration generator should produce a non-empty audio file.

**Validates: Requirements 8.1**

### Property 30: Narration Storage

*For any* generated narration audio, the file should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 8.5**

### Property 31: Narration URL in Job Record

*For any* completed narration generation, the job record should contain the narration audio URL.

**Validates: Requirements 8.6**

### Property 32: Video Clip Count

*For any* video composition with N pages, the final video should contain exactly N clips.

**Validates: Requirements 9.1**

### Property 33: Audio-Video Synchronization

*For any* final video, the narration audio duration should match the video duration (±0.5 seconds tolerance).

**Validates: Requirements 9.3**

### Property 34: Final Video Resolution

*For any* final video, the dimensions should be exactly 1280x720 pixels.

**Validates: Requirements 9.4**

### Property 35: Final Video Format

*For any* final video, the file format should be MP4.

**Validates: Requirements 9.5**

### Property 36: Final Video Storage

*For any* generated final video, the file should be accessible via the stored Cloud Storage URL.

**Validates: Requirements 9.6**

### Property 37: Job Status Update on Completion

*For any* completed video composition, the job status should be "done" and the job record should contain the final video URL.

**Validates: Requirements 9.7**

### Property 38: Job Status Transition to Processing

*For any* job that begins generation, the status should transition from "pending" to "processing".

**Validates: Requirements 10.1**

### Property 39: Job Status Transition to Done

*For any* job that completes successfully, the status should transition to "done".

**Validates: Requirements 10.2**

### Property 40: Job Status Transition to Error

*For any* job where a component fails, the status should transition to "error".

**Validates: Requirements 10.3**

### Property 41: Error Message Storage

*For any* job with status "error", the job record should contain a non-empty error message.

**Validates: Requirements 10.4**

### Property 42: Timestamp Updates

*For any* job status change, the updatedAt timestamp should be more recent than the previous updatedAt value.

**Validates: Requirements 10.5**

### Property 43: Job Query Round-Trip

*For any* created job with ID J, querying the status endpoint with ID J should return a job record with the same ID.

**Validates: Requirements 10.6**

### Property 44: Signed URL Generation

*For any* completed job, the video endpoint should return a signed URL that is accessible and valid for 24 hours.

**Validates: Requirements 11.1**

### Property 45: Download Link Availability

*For any* completed job, the video endpoint should return a non-empty download URL.

**Validates: Requirements 11.2**

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

### Property 51: Library Save Functionality

*For any* completed storybook that is saved, the library should contain an entry for that storybook.

**Validates: Requirements 13.1**

### Property 52: Local Storage Persistence

*For any* saved storybook, the video file should be retrievable from the device's file system and metadata should be retrievable from AsyncStorage.

**Validates: Requirements 13.2, 13.3, 13.6, 13.7**

### Property 53: Library Display Completeness

*For any* library with N saved storybooks, the library view should display exactly N storybook cards.

**Validates: Requirements 13.4**

### Property 54: Library Delete Functionality

*For any* storybook deleted from the library, the library should no longer contain that storybook.

**Validates: Requirements 13.5**

### Property 55: Saved Storybook Fields

*For any* saved storybook, the stored data should include title, video file URI, thumbnail URI, and creation timestamp fields.

**Validates: Requirements 13.7**

### Property 56: Library Thumbnail Display

*For any* storybook in the library view, a thumbnail image should be displayed.

**Validates: Requirements 13.8**

### Property 57: Default Title Display

*For any* newly generated storybook, the preview should initially display the AI-generated title.

**Validates: Requirements 14.1**

### Property 58: Title Edit Functionality

*For any* storybook in preview, editing the title field should update the displayed title.

**Validates: Requirements 14.2**

### Property 59: Custom Title Persistence

*For any* edited title that is saved, reloading the storybook should display the custom title.

**Validates: Requirements 14.3**

### Property 60: Custom Title in Library

*For any* storybook with a custom title, the library view should display the custom title instead of the original.

**Validates: Requirements 14.4**

### Property 61: Upload Error Messages

*For any* failed image upload, the UI should display a non-empty error message.

**Validates: Requirements 17.1**

### Property 62: Generation Error Messages

*For any* failed generation, the UI should display a non-empty error message.

**Validates: Requirements 17.2**

### Property 63: Network Error Retry Option

*For any* network error, the UI should display a retry option.

**Validates: Requirements 17.3**

### Property 64: Error Logging

*For any* error that occurs, an entry should be created in Cloud Logging.

**Validates: Requirements 17.4**

### Property 65: Error Message Sanitization

*For any* error message displayed to users, the message should not contain internal implementation details (stack traces, file paths, database queries).

**Validates: Requirements 17.5**

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
- Action: Retry up to 3 times with exponential backoff
- Fallback: For Veo timeout, use FFmpeg Ken Burns effect
- Job Status: "error" if all retries fail
- Message: "Generation timed out. Please try again."

**AI Service Error**
- Trigger: Gemini/Imagen/Veo returns error response
- Action: Retry up to 3 times
- Fallback: For Veo error, use FFmpeg Ken Burns effect
- Job Status: "error" if all retries fail
- Message: "AI service error. Please try again."

**Storage Error**
- Trigger: Cloud Storage upload/download fails
- Action: Retry up to 3 times
- Job Status: "error" if all retries fail
- Message: "Storage error. Please try again."

**FFmpeg Error**
- Trigger: Video processing fails
- Action: Retry once
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

