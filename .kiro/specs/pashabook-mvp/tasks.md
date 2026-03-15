# Implementation Plan: Pashabook MVP

## Overview

This implementation plan breaks down the Pashabook MVP into discrete coding tasks. The system is a React Native mobile app with Google Cloud Platform backend that transforms children's drawings into animated storybooks using AI services (Gemini 2.5 Flash Image, Imagen 3, Veo 3.1 Fast, Cloud TTS).

Key technical stack:
- Frontend: React Native (Expo), TypeScript
- Backend: Node.js 20, Cloud Functions, Cloud Run
- AI: Gemini 2.5 Flash Image (analysis, story + illustrations via interleaved output), Imagen 3 (fallback), Veo 3.1 Fast (highlight animations), Cloud TTS (narration with character-specific voices)
- Storage: Firestore, Cloud Storage, AsyncStorage
- Video: FFmpeg

## Tasks

- [x] 1. Project setup and infrastructure foundation
  - Initialize React Native (Expo) project with TypeScript
  - Set up Google Cloud Project with required APIs enabled
  - Configure Firebase Authentication (Email/Password)
  - Create Firestore database with security rules
  - Set up Cloud Storage buckets with lifecycle policies (24-hour TTL)
  - Initialize Cloud Functions and Cloud Run services
  - Create `.tool-versions` file with Node.js LTS
  - Set up Makefile with test, install, and clean commands
  - _Requirements: All requirements depend on this foundation_

- [x] 2. Authentication system
  - [x] 2.1 Implement Firebase Authentication integration
    - Create user registration function with email/password validation
    - Create user login function with session management
    - Create logout function with AsyncStorage cleanup
    - Store user profile in Firestore `/users/{userId}` collection
    - Implement AsyncStorage session token management
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_
  
  - [x] 2.1.1 Add FCM token management to authentication
    - [ ] Register for push notifications on app launch
    - [ ] Store FCM token in UserProfile.fcmToken field
    - [ ] Listen for token refresh events and update Firestore
    - [ ] Handle permission denied gracefully
    - _Requirements: 11.6, 11.7, 11.8, 11.9_
    - _Properties: 68_

  - [~] 2.2 Write unit tests for authentication
    - Test email format validation
    - Test password length validation (min 6 characters)
    - Test invalid credentials error handling
    - Test session persistence in AsyncStorage
    - _Requirements: 1.2, 1.3, 1.9_

- [x] 3. Backend API endpoints (Cloud Functions)
  - [x] 3.1 Implement POST /api/upload endpoint (backend/src/routes/upload.ts)
    - [x] Accept multipart/form-data with image and language
    - [x] Verify Firebase ID token in Authorization header
    - [x] Validate file format (JPEG/PNG only)
    - [x] Validate file size (< 10MB)
    - [x] Validate image dimensions (>= 500x500px)
    - [x] Upload image to Cloud Storage
    - [x] Create Job record in Firestore with userId
    - [x] Enqueue processing task to Cloud Tasks
    - [x] Return jobId and status
    - [x] Initialize estimatedDurations and actualDurations arrays in Job record
    - [x] Initialize characterVoiceMap field in Job record
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [~] 3.2 Write property test for upload validation
    - **Property 1: Valid Image Format Acceptance**
    - **Validates: Requirements 2.1, 2.2, 2.5, 2.6, 2.7**

  - [~] 3.3 Write unit tests for upload endpoint
    - Test rejection of invalid formats (GIF, BMP, WEBP)
    - Test rejection of oversized files (> 10MB)
    - Test rejection of undersized images (< 500x500px)
    - Test error messages for each validation failure
    - _Requirements: 2.3, 2.4_

  - [x] 3.4 Implement GET /api/status/:jobId endpoint (backend/src/routes/status.ts)
    - [x] Verify Firebase ID token
    - [x] Check job userId matches authenticated user
    - [x] Query Job record from Firestore
    - [x] Return job status, progress, result, and error fields
    - [x] Calculate and return queuePosition when status is "pending"
    - [x] Query Cloud Tasks queue to count active jobs
    - [x] Return queuePosition only when queue has 3+ active jobs
    - _Requirements: 10.6, 10.8, 10.9_
    - _Properties: 67_

  - [~] 3.5 Write property test for job query
    - **Property 43: Job Query Round-Trip**
    - **Validates: Requirements 10.6**

  - [x] 3.6 Implement GET /api/video/:jobId endpoint
    - Verify Firebase ID token
    - Check job userId matches authenticated user
    - Verify job status is "done"
    - Generate signed URLs for video and download (24-hour expiry)
    - Return videoUrl, downloadUrl, and expiresAt
    - _Requirements: 11.1, 11.2_

  - [~] 3.7 Write property test for signed URL generation
    - **Property 44: Signed URL Generation**
    - **Validates: Requirements 11.1**

  - [~] 3.8 Write unit tests for video endpoint
    - Test 401 error for missing token
    - Test 403 error for wrong user
    - Test 404 error for non-existent job
    - Test 404 error for incomplete job
    - _Requirements: 11.1, 11.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Image analysis service (Cloud Run Worker)
  - [x] 5.1 Implement ImageAnalyzer with Gemini 2.5 Flash Image
    - Create analyze() function accepting imageUrl and language
    - Extract character names and descriptions
    - Extract setting and background information
    - Extract art style characteristics
    - Extract emotional tone
    - Identify climax indicators (key emotional elements) for Story_Generator to use when selecting Highlight_Pages
    - Complete analysis within 30 seconds
    - Store results in Job record
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [~] 5.3 Write property test for analysis persistence
    - **Property 4: Analysis Persistence**
    - **Validates: Requirements 3.7**

  - [~] 5.4 Write unit tests for image analyzer
    - Test timeout handling (> 30 seconds)
    - Test retry logic with exponential backoff
    - Test error response handling
    - _Requirements: 3.6_

- [x] 6. Story generation service (Cloud Run Worker)
  - [x] 6.1 Implement StoryGenerator with Gemini 2.5 Flash Image interleaved output
    - [x] Create generate() function accepting analysis and language
    - [x] Generate story with 5-6 pages (currently 3 pages for testing due to quota limits)
    - [x] Use JSON structured output format to prevent parse errors
    - [x] Use age-appropriate vocabulary (3-8 years)
    - [x] Incorporate character descriptions from analysis
    - [x] Incorporate style description from analysis
    - [x] Incorporate emotional tone from analysis
    - [x] Generate story title
    - [x] Create narration text per page (20-100 words)
    - [x] Select 1-2 pages as Highlight_Pages using climax indicators (currently 1 page for 3-page testing)
    - [x] Designate animation mode per page (standard/highlight)
    - [x] Support Japanese and English languages
    - [x] Complete generation within 30 seconds
    - **Note: Currently using Gemini 2.0 Flash without interleaved output. Illustrations generated separately via IllustrationGenerator (Task 8). Gemini 2.5 Flash Image interleaved output is experimental and can be implemented in Task 34 (optional)**
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.15, 4.16, 4.17_
  
  - [x] 6.1.1 Add duration estimation to StoryGenerator
    - [ ] Calculate estimated duration per page using language-specific formulas
    - [ ] Japanese: character count / 250 characters-per-minute
    - [ ] English: word count / 180 words-per-minute
    - [ ] Store estimatedDurations array in Job record
    - [ ] Pass estimated durations to AnimationEngine and NarrationGenerator
    - _Requirements: 4.18, 4.19_
    - _Properties: 4, 69_

  - [~] 6.2 Write property tests for story generation
    - **Property 3: Highlight Page Count Constraint**
    - **Property 5: Story Page Count Constraint**
    - **Property 6: Character Description Incorporation**
    - **Property 7: Style Description Incorporation**
    - **Property 8: Story Title Existence**
    - **Property 9: Narration Word Count Constraint**
    - **Property 10: Image Prompt Completeness**
    - **Property 11: Animation Mode Validity**
    - **Property 12: Language Selection for Story Content**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12**

  - [~] 6.3 Write unit tests for story generator
    - Test timeout handling (> 30 seconds)
    - Test retry logic
    - Test language-specific content generation
    - _Requirements: 4.12_

- [x] 7. Narration generation service (Cloud Run Worker)
  - [x] 7.1 Implement NarrationGenerator with Cloud TTS
    - [x] Create generatePerPage() function for individual pages
    - [x] Create generateAll() function for parallel processing
    - [x] Use Japanese voice for Japanese stories
    - [x] Use English voice for English stories
    - [x] Use warm and gentle voice tone
    - [x] Store audio files in Cloud Storage
    - [x] Return audio URL and duration per page
    - [x] Complete all narration within 45 seconds
    - [x] Implement character-specific voice generation
    - [x] Parse JSON structured narration segments (NarrationSegment[])
    - [x] Generate separate audio files per character
    - [x] Implement character-to-voice mapping (characterVoiceMap)
    - [x] Store mapping in Job record for consistency across pages
    - [x] Calculate actual duration per page (sum of all segments)
    - [x] Update Job record with actualDurations array
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13_
    - _Properties: 70_

  - [~] 7.2 Write property tests for narration
    - **Property 30: Narration Generation**
    - **Property 31: Narration Storage**
    - **Property 32: Narration URL in Job Record**
    - **Property 51: Narration Language**
    - **Validates: Requirements 8.1, 8.5, 8.6, 12.5**

  - [~] 7.3 Write unit tests for narration generator
    - Test Japanese voice selection
    - Test English voice selection
    - Test audio duration calculation
    - Test Cloud Storage upload
    - _Requirements: 8.2, 8.3_

- [x] 8. Illustration generation service (Cloud Run Worker)
  - [x] 8.1 Implement IllustrationGenerator with Imagen 3
    - Create generateAll() function for parallel generation
    - Incorporate style description into prompts
    - Incorporate character descriptions into prompts
    - Generate illustrations at 1280x720 resolution
    - Store images in Cloud Storage
    - Update Job record with illustration URLs
    - Complete all illustrations within 90 seconds
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [~] 8.2 Write property tests for illustration generation
    - **Property 13: Illustration Count Matches Page Count**
    - **Property 14: Style in Illustration Prompts**
    - **Property 15: Characters in Illustration Prompts**
    - **Property 16: Illustration Resolution**
    - **Property 17: Illustration Storage**
    - **Property 18: Illustration URLs in Job Record**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.6, 5.7**

  - [~] 8.3 Write unit tests for illustration generator
    - Test parallel generation execution
    - Test timeout handling (> 90 seconds)
    - Test retry logic
    - _Requirements: 5.4, 5.8_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Animation engine - Standard pages (Cloud Run Worker)
  - [x] 10.1 Implement standard page animation with FFmpeg Ken Burns effect
    - [x] Create animateStandardPage() function
    - [x] Accept illustration and duration
    - [x] Randomly select zoom direction (in/out)
    - [x] Randomly select pan direction (left/right/none)
    - [x] Generate video clip matching duration
    - [x] Store clips in Cloud Storage
    - [x] Update Job record with clip URLs
    - [x] Accept estimated duration from StoryGenerator (Task 6.1.1)
    - [x] Enable parallel execution with NarrationGenerator
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [~] 10.2 Write property tests for standard page animation
    - **Property 19: Standard Page Animation Completeness**
    - **Property 20: Zoom Direction Validity**
    - **Property 21: Pan Direction Validity**
    - **Property 22: Standard Page Clip Duration**
    - **Property 23: Animation Clip Storage**
    - **Property 24: Animation URLs in Job Record**
    - **Validates: Requirements 6.1, 6.3, 6.4, 6.5, 6.7, 6.8**

  - [~] 10.3 Write unit tests for Ken Burns effect
    - Test FFmpeg command generation
    - Test zoom-in effect parameters
    - Test zoom-out effect parameters
    - Test pan direction parameters
    - Test duration synchronization with audio
    - _Requirements: 6.2, 6.5_

- [x] 11. Animation engine - Highlight pages (Cloud Run Worker)
  - [x] 11.1 Implement highlight page animation with Veo 3.1 Fast
    - [x] Create animateHighlightPage() function
    - [x] Accept illustration, prompt, and duration
    - [x] Generate video clip with Veo 3.1 Fast
    - [x] Match clip duration to duration parameter
    - [x] Implement 60-second timeout with FFmpeg fallback
    - [x] Implement error handling with FFmpeg fallback
    - [x] Store clips in Cloud Storage
    - [x] Update Job record with clip URLs
    - [x] Accept estimated duration from StoryGenerator (Task 6.1.1)
    - [x] Enable parallel execution with NarrationGenerator
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [~] 11.2 Write property tests for highlight page animation
    - **Property 25: Highlight Page Animation Completeness**
    - **Property 26: Highlight Page Clip Duration**
    - **Property 27: Highlight Clip Storage**
    - **Property 28: Highlight URLs in Job Record**
    - **Validates: Requirements 7.1, 7.2, 7.6, 7.7**

  - [~] 11.3 Write unit tests for Veo integration
    - Test timeout fallback to FFmpeg (> 60 seconds)
    - Test error fallback to FFmpeg
    - Test duration synchronization
    - _Requirements: 7.4, 7.5_

- [x] 12. Video composition service (Cloud Run Worker)
  - [x] 12.1 Implement VideoCompositor with FFmpeg
    - [x] Create compose() function accepting clips and narrations
    - [x] Combine all page clips in sequence
    - [x] Apply 0.5 second crossfade transitions between pages
    - [x] Synchronize narration audio with video timeline
    - [x] Produce output at 1280x720 resolution
    - [x] Produce output in MP4 format
    - [x] Store final video in Cloud Storage
    - [x] Update Job record with video URL and status "done"
    - [x] Complete composition within 60 seconds
    - [x] Implement duration adjustment logic (sync animation clips with actual narration durations)
    - [x] Add 0.3-second silence padding between narrator and character segments
    - [x] Apply 50ms crossfade between character voice segments
    - [x] Mix multiple character audio tracks per page
    - [x] Add BGM selection based on emotional tone
    - [x] Mix BGM at 20-30% volume with 1s fade-in/out
    - [x] Send FCM push notification on completion
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12_
    - _Properties: 71_

  - [~] 12.2 Write property tests for video composition
    - **Property 32: Video Clip Count**
    - **Property 33: Audio-Video Synchronization**
    - **Property 34: Final Video Resolution**
    - **Property 35: Final Video Format**
    - **Property 36: Final Video Storage**
    - **Property 37: Job Status Update on Completion**
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7**

  - [~] 12.3 Write unit tests for video compositor
    - Test crossfade transition timing (0.5 seconds)
    - Test audio-video synchronization accuracy
    - Test FFmpeg command generation
    - _Requirements: 9.2, 9.3_

- [x] 13. Processing pipeline orchestration (Cloud Run Worker)
  - [x] 13.1 Implement main processing worker
    - [x] Create Cloud Run service handling Cloud Tasks queue
    - [x] Update Job status at each stage (pending → processing → done/error)
    - [x] Update progress percentage (0-100)
    - [x] Implement retry logic with exponential backoff
    - [x] Handle errors and update Job with error messages
    - [x] Log all errors to Cloud Logging
    - [x] Sanitize error messages for users
    - [x] Refactor pipeline to: Analysis → Story (with duration estimation) → Parallel(Narration + Animation) → Composition
    - [x] Add exponential backoff with jitter for rate limit errors (429)
    - [x] Max 5 retries for rate limit errors
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 17.4, 17.5_

  - [~] 13.2 Write property tests for job status management
    - **Property 38: Job Status Transition to Processing**
    - **Property 39: Job Status Transition to Done**
    - **Property 40: Job Status Transition to Error**
    - **Property 41: Error Message Storage**
    - **Property 42: Timestamp Updates**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

  - [~] 13.3 Write unit tests for pipeline orchestration
    - Test parallel execution of narration and illustration
    - Test error propagation
    - Test retry logic
    - Test progress percentage updates
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Frontend - Core app structure
  - [x] 15.1 Create main App component with routing
    - Implement stage management (upload/processing/preview/library)
    - Implement language selection (ja/en)
    - Create navigation between stages
    - Set up AsyncStorage for session persistence
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 15.2 Write unit tests for app state management
    - Test stage transitions
    - Test language switching
    - Test AsyncStorage persistence
    - _Requirements: 12.3_

- [x] 16. Frontend - Upload section
  - [x] 16.1 Implement UploadSection component
    - Create image picker integration (Expo ImagePicker)
    - Implement upload button with loading state
    - Display language selection UI
    - Call POST /api/upload with image and language
    - Handle upload response and transition to processing stage
    - Display error messages for validation failures
    - _Requirements: 2.1, 2.2, 2.7, 17.1_

  - [x] 16.2 Write property test for upload UI
    - **Property 2: Job ID Uniqueness**
    - **Validates: Requirements 2.7**

  - [x] 16.3 Write unit tests for upload section
    - Test image picker integration
    - Test loading state display
    - Test error message display
    - _Requirements: 17.1_

- [x] 17. Frontend - Processing section
  - [x] 17.1 Implement ProcessingSection component (mobile/app/progress/[id].tsx)
    - [x] Poll GET /api/status/:jobId every 2 seconds
    - [x] Display current stage (analyzing/generating/illustrating/animating/narrating/composing)
    - [x] Display progress percentage (0-100)
    - [x] Transition to preview stage when status is "done"
    - [x] Display error message when status is "error"
    - [x] Display retry button for network errors
    - [x] Implement polling safeguards (no state in dependencies, interval cleanup, terminal state checks)
    - [x] Display queue position when queuePosition > 0
    - [x] Display message "You are #N in queue" (or Japanese equivalent)
    - [x] Hide queue position when queuePosition === 0 or undefined
    - **Note: Polling follows react-polling-patterns.md standards to prevent infinite loops**
    - _Requirements: 10.6, 10.7, 10.8, 10.9, 10.10, 17.2, 17.3_
    - _Properties: 67_

  - [x] 17.2 Write unit tests for processing section
    - Test polling mechanism
    - Test progress display updates
    - Test error handling
    - Test retry button functionality
    - _Requirements: 17.2, 17.3_

- [x] 18. Frontend - Preview section
  - [x] 18.1 Implement PreviewSection component (mobile/app/detail/[id].tsx)
    - [x] Call GET /api/video/:jobId to get signed URL
    - [x] Display video player with playback controls
    - [x] Display story title (editable)
    - [x] Display story text for all pages
    - [x] Implement save to library button
    - [x] Implement download button (using expo-sharing)
    - [x] Handle title editing and persistence
    - [x] Display 24-hour deletion reminder message
    - [x] Message: "Videos are automatically deleted after 24 hours. Save to your library to keep them."
    - [x] Show reminder in preview screen when status is "done"
    - **Note: Share functionality already implemented using expo-sharing**
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 11.8, 11.9, 14.1, 14.2_

  - [x] 18.2 Write property tests for preview section
    - **Property 45: Signed URL Generation**
    - **Property 46: Title Display with Video**
    - **Property 47: Story Text Display with Video**
    - **Property 58: Default Title Display**
    - **Property 59: Title Edit Functionality**
    - **Validates: Requirements 11.1, 11.4, 11.5, 14.1, 14.2**

  - [x] 18.3 Write unit tests for preview section
    - Test video playback
    - Test title editing
    - Test save functionality
    - Test download functionality
    - _Requirements: 11.3_

- [x] 19. Frontend - Library management
  - [x] 19.1 Implement local library storage with AsyncStorage and FileSystem (mobile/lib/storage.ts)
    - [x] Create library data structure in AsyncStorage
    - [x] Download video file to device FileSystem when saving
    - [x] Store metadata (title, videoUri, thumbnailUri, createdAt)
    - [x] Implement library CRUD operations (save, list, delete)
    - [x] Implement thumbnail generation from video
    - [x] Use expo-video-thumbnails to extract frame at 1 second
    - [x] Save thumbnail to FileSystem thumbnails directory
    - **Note: Thumbnail generation fully implemented with error handling**
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 13.7_

  - [x] 19.2 Write property tests for library storage
    - **Property 52: Library Save Functionality**
    - **Property 53: Local Storage Persistence**
    - **Property 55: Library Delete Functionality**
    - **Property 56: Saved Storybook Fields**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.6, 13.7**

  - [x] 19.3 Write unit tests for library storage
    - Test AsyncStorage operations
    - Test FileSystem operations
    - Test thumbnail generation
    - _Requirements: 13.2, 13.6_

- [x] 20. Frontend - Library section
  - [x] 20.1 Implement LibrarySection component (mobile/app/(tabs)/index.tsx)
    - [x] Display all saved storybooks in grid layout
    - [x] Show title and creation date per book
    - [x] Implement view button to play saved video (mobile/app/library/[id].tsx)
    - [x] Implement delete button with confirmation
    - [x] Handle empty library state
    - [x] Display custom titles when available
    - [x] Display actual thumbnails (generated from video at 1 second mark)
    - **Note: Thumbnail generation implemented in Task 19.1**
    - _Requirements: 13.3, 13.4, 13.5, 13.7, 13.8, 14.3, 14.4_

  - [~] 20.2 Write property tests for library UI
    - **Property 54: Library Display Completeness**
    - **Property 57: Library Thumbnail Display**
    - **Property 60: Custom Title Persistence**
    - **Property 61: Custom Title in Library**
    - **Validates: Requirements 13.3, 13.7, 14.3, 14.4**

  - [~] 20.3 Write unit tests for library section
    - Test grid layout rendering
    - Test view functionality
    - Test delete confirmation
    - Test empty state display
    - _Requirements: 13.3, 13.4_

- [x] 21. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Internationalization (i18n)
  - [x] 22.1 Implement language support
    - Create translation files for Japanese and English
    - Implement language switching in UI
    - Update all UI text to use translations
    - Persist language selection in AsyncStorage
    - _Requirements: 12.1, 12.2, 12.3_

  - [~] 22.2 Write property tests for language support
    - **Property 49: UI Language Selection**
    - **Property 50: Story Content Language**
    - **Validates: Requirements 12.3, 12.4**

  - [~] 22.3 Write unit tests for i18n
    - Test translation loading
    - Test language switching
    - Test persistence
    - _Requirements: 12.3_

- [x] 23. Error handling and logging
  - [x] 23.1 Implement comprehensive error handling
    - Add error boundaries in React Native app
    - Implement Cloud Logging integration in backend
    - Sanitize error messages for users
    - Add retry logic for network errors
    - Display user-friendly error messages
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [~] 23.2 Write property tests for error handling
    - **Property 62: Upload Error Messages**
    - **Property 63: Generation Error Messages**
    - **Property 64: Network Error Retry Option**
    - **Property 65: Error Logging**
    - **Property 66: Error Message Sanitization**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

  - [~] 23.3 Write unit tests for error handling
    - Test error boundary behavior
    - Test error message sanitization
    - Test retry logic
    - _Requirements: 17.5_

- [x] 24. Data retention and cleanup
  - [x] 24.1 Implement automated cleanup
    - Configure Cloud Storage lifecycle policies (24-hour TTL)
    - Create Firestore TTL field for Job records
    - Set up Cloud Scheduler for periodic cleanup
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [~] 24.2 Write unit tests for cleanup
    - Test lifecycle policy configuration
    - Test TTL field calculation
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 25. Performance optimization
  - [x] 25.1 Optimize generation pipeline
    - Implement parallel execution for narration and illustration
    - Configure Cloud Tasks queue with max 3 concurrent jobs
    - Optimize FFmpeg commands for speed
    - Add performance monitoring
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [~] 25.2 Write unit tests for performance
    - Test parallel execution
    - Test queue concurrency limits
    - _Requirements: 16.4_

- [x] 26. Integration and final wiring
  - [x] 26.1 Wire all components together
    - Connect frontend to backend APIs
    - Configure Firebase Authentication in mobile app
    - Set up Cloud Tasks queue integration
    - Configure environment variables for all services
    - Test end-to-end flow
    - _Requirements: All requirements_

  - [~] 26.2 Write end-to-end integration tests
    - Test complete upload-to-preview flow
    - Test library save and retrieval
    - Test error scenarios
    - Test concurrent job processing
    - _Requirements: All requirements_

- [x] 27. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## New Tasks (Added 2026-03-12)

### Task 28: Infrastructure Configuration

- [x] 28. Infrastructure configuration and deployment optimization
  - [x] 28.1 Configure Cloud Run CPU boost
    - [ ] Add `--cpu-boost` flag to Cloud Run deployment in Terraform
    - [ ] Update infra/modules/gcp/pashabook/main.tf
    - [ ] Add annotation: `"run.googleapis.com/cpu-boost": "true"`
    - [ ] Verify CPU boost is enabled after deployment
    - [ ] Test video composition performance improvement (target: 30-50% faster)
    - _Design: Infrastructure Configuration section_
  
  - [x] 28.2 Configure Cloud Storage CORS policy
    - [x] CORS already configured in Terraform main.tf
    - [x] Assets bucket: origin ["*"], methods ["GET", "HEAD", "PUT", "POST"]
    - [x] Videos bucket: origin ["*"], methods ["GET", "HEAD"]
    - **Status: COMPLETE - CORS configuration is already implemented**
    - _Design: Infrastructure Configuration section_
  
  - [x] 28.3 Upload BGM files to Cloud Storage
    - [ ] Prepare 4 royalty-free BGM tracks (bright.mp3, adventure.mp3, sad.mp3, calm.mp3)
    - [ ] Upload to gs://pashabook-dev-pashabook-assets/bgm/
    - [ ] Verify files are accessible
    - [ ] Set BGM_STORAGE_PATH environment variable in Cloud Run
    - _Requirements: 18.1, 18.2_
  
  - [~] 28.4 Configure environment variables
    - [ ] Add BGM_STORAGE_PATH to Cloud Run (default: gs://pashabook-assets/bgm/)
    - [ ] Verify all required environment variables are set
    - [ ] Update Terraform outputs with Cloud Run service URL
    - _Design: Infrastructure Configuration section_

### Task 29: FCM Push Notification Implementation

- [~] 29. Push notification system (Backend + Mobile)
  - [x] 29.1 Implement FCM notification in VideoCompositor
    - [ ] Add FCM Admin SDK initialization in backend
    - [ ] Retrieve user's fcmToken from Firestore UserProfile
    - [ ] Send notification when video composition completes
    - [ ] Include jobId in notification data payload for deep linking
    - [ ] Handle invalid/expired tokens gracefully (log warning, continue)
    - [ ] Skip notification if user has no fcmToken (notifications disabled)
    - _Requirements: 11.6, 11.7, 11.8, 11.9_
    - _Properties: 68_
  
  - [x] 29.2 Implement FCM token management in mobile app
    - [ ] Register for push notifications on app launch
    - [ ] Request notification permissions from user
    - [ ] Store FCM token in Firestore /users/{userId} collection
    - [ ] Listen for token refresh events and update Firestore
    - [ ] Handle permission denied gracefully (skip token storage)
    - _Requirements: 11.6, 11.7, 11.8, 11.9_
  
  - [~] 29.3 Implement notification handling in mobile app
    - [ ] Listen for FCM notifications when app is in foreground
    - [ ] Listen for FCM notifications when app is in background
    - [ ] Parse notification data payload to extract jobId
    - [ ] Navigate to preview screen when notification is tapped
    - [ ] Display notification title and body
    - _Requirements: 11.7, 11.8_
  
  - [~] 29.4 Write unit tests for FCM integration
    - Test notification sending with valid token
    - Test notification sending with invalid token
    - Test notification sending with missing token
    - Test notification payload structure
    - Test deep linking navigation
    - _Requirements: 11.6, 11.7, 11.8, 11.9_

### Task 30: Queue Position Display

- [~] 30. Queue position tracking and display
  - [x] 30.1 Implement queue position calculation in status endpoint
    - [ ] Query Cloud Tasks queue to count active jobs
    - [ ] Calculate position based on job creation time
    - [ ] Return queuePosition only when queue has 3+ active jobs
    - [ ] Return queuePosition: 0 or undefined when job is processing
    - _Requirements: 10.8, 10.9_
    - _Properties: 67_
  
  - [x] 30.2 Display queue position in ProcessingSection
    - [ ] Show "You are #N in queue" when queuePosition > 0
    - [ ] Show estimated wait time (~3 minutes per position)
    - [ ] Hide queue position when queuePosition === 0 or undefined
    - [ ] Update queue position on each status poll
    - _Requirements: 10.9, 10.10_
  
  - [~] 30.3 Write unit tests for queue position
    - Test queue position calculation with various queue sizes
    - Test queue position display in UI
    - Test queue position updates during polling
    - _Requirements: 10.8, 10.9, 10.10_

### Task 31: Character Voice Implementation

- [-] 31. Character-specific voice generation
  - [x] 31.1 Update StoryGenerator to output JSON structured narration
    - [ ] Modify prompt to request NarrationSegment[] format
    - [ ] Format: [{"text": "...", "speaker": "narrator"}, {"text": "...", "speaker": "protagonist"}]
    - [ ] Validate JSON structure in parseStoryResponse()
    - [ ] Store narrationSegments per page in Story model
    - _Requirements: 4.17, 8.2_
  
  - [x] 31.2 Implement character voice mapping in NarrationGenerator
    - [ ] Create character-to-voice mapping on first encounter
    - [ ] Store mapping in Job.characterVoiceMap field
    - [ ] Lookup existing voice assignment for subsequent pages
    - [ ] Assign distinct TTS voices per character type (narrator, protagonist, supporting)
    - [ ] Update Firestore with characterVoiceMap after page 1
    - _Requirements: 8.8_
  
  - [x] 31.3 Generate separate audio files per character
    - [ ] Parse NarrationSegment[] for each page
    - [ ] Generate audio file per segment using character's assigned voice
    - [ ] Store multiple audio files per page in Cloud Storage
    - [ ] Return array of AudioSegment with URLs, durations, and speakers
    - [ ] Calculate total duration per page (sum of all segments)
    - _Requirements: 8.2, 8.6, 8.7, 8.12_
    - _Properties: 70_
  
  - [x] 31.4 Update VideoCompositor to mix character audio tracks
    - [ ] Accept array of AudioSegment per page
    - [ ] Mix multiple audio tracks per page
    - [ ] Insert 0.3-second silence padding between narrator and character segments
    - [ ] Apply 50ms crossfade between character voice segments (within dialogue only)
    - [ ] Synchronize mixed audio with video timeline
    - _Requirements: 9.4, 9.5_
  
  - [x] 31.5 Update Job model to include character voice fields
    - [ ] Add characterVoiceMap field to Job interface (backend/src/types/models.ts)
    - [ ] Add NarrationSegment interface with text and speaker fields
    - [ ] Add AudioSegment interface with audioUrl, speaker, duration, startTime
    - [ ] Update StoryPage to include narrationSegments field
    - [ ] Update PageNarration to include audioSegments array
    - [ ] Update Firestore schema documentation in design.md
    - _Design: Data Models section_
  
  - [~] 31.6 Write unit tests for character voice generation
    - Test character voice mapping creation
    - Test voice consistency across pages
    - Test multiple audio segment generation
    - Test audio mixing with silence padding
    - Test crossfade transitions
    - _Requirements: 8.2, 8.6, 8.7, 8.8, 9.4, 9.5_

### Task 32: BGM Integration

- [~] 32. Background music integration
  - [x] 32.1 Implement BGM selection in VideoCompositor
    - [ ] Map emotional tone to BGM track (bright/adventure/sad/calm)
    - [ ] Download selected BGM from Cloud Storage using BGM_STORAGE_PATH env var
    - [ ] Loop BGM to match total video length
    - [ ] Mix BGM at 20-30% of narration volume
    - [ ] Apply 1-second fade-in at video start
    - [ ] Apply 1-second fade-out at video end
    - [ ] Ensure BGM doesn't overpower narration
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_
  
  - [~] 32.2 Write unit tests for BGM integration
    - Test emotional tone to BGM mapping
    - Test BGM looping logic
    - Test volume mixing (20-30% of narration)
    - Test fade-in/fade-out effects
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

### Task 33: Duration Estimation and Adjustment

- [~] 33. Duration estimation and adjustment system
  - [x] 33.1 Implement duration estimation in StoryGenerator (Task 6.1.1)
    - [ ] Calculate estimated duration per page using language-specific formulas
    - [ ] Japanese: character count / 250 characters-per-minute
    - [ ] English: word count / 180 words-per-minute
    - [ ] Store estimatedDurations array in Job record
    - [ ] Return estimated durations with Story object
    - _Requirements: 4.18, 4.19_
    - _Properties: 4, 69_
  
  - [x] 33.2 Update AnimationEngine to use estimated durations
    - [ ] Accept estimatedDuration parameter in animateStandardPage()
    - [ ] Accept estimatedDuration parameter in animateHighlightPage()
    - [ ] Generate clips with estimated duration (not actual narration duration)
    - [ ] Enable parallel execution with NarrationGenerator
    - _Requirements: 6.2, 6.6, 7.2_
  
  - [x] 33.3 Update NarrationGenerator to store actual durations
    - [ ] Calculate actual duration per page (sum of all audio segments)
    - [ ] Update Job record with actualDurations array
    - [ ] Return actual durations with PageNarration objects
    - _Requirements: 8.12, 8.13_
    - _Properties: 70_
  
  - [x] 33.4 Implement duration adjustment in VideoCompositor
    - [ ] Compare animation clip duration with actual narration duration
    - [ ] If narration shorter: Use setpts filter for ±10% speed adjustment
    - [ ] If speed adjustment exceeds ±10%: Trim and add 0.5s freeze frame
    - [ ] If narration longer: Add static frames at end (freeze last frame)
    - [ ] Apply 0.3s fade-out on final frame for smooth ending
    - [ ] Log warning if duration difference exceeds 3 seconds
    - _Requirements: 9.3_
    - _Properties: 71_
  
  - [x] 33.5 Refactor ProcessingWorker pipeline for parallel execution
    - [ ] Update pipeline order: Analysis → Story (with estimation) → Parallel(Narration + Animation) → Composition
    - [ ] Pass estimatedDurations to AnimationEngine
    - [ ] Execute NarrationGenerator and AnimationEngine in parallel using Promise.all()
    - [ ] **CRITICAL: Wait for BOTH promises to resolve before starting VideoCompositor**
    - [ ] **CRITICAL: Ensure actualDurations from TTS are available before composition**
    - [ ] Pass actualDurations to VideoCompositor for adjustment
    - [ ] Handle partial failures (if one promise rejects, cancel the other)
    - _Requirements: 6.2, 6.6, 7.2, 8.12, 9.3_
    - _Note: Promise.all ensures both narration (actual duration) and animation (estimated duration) complete before composition starts_
  
  - [~] 33.6 Write unit tests for duration estimation and adjustment
    - Test Japanese duration estimation formula
    - Test English duration estimation formula
    - Test speed adjustment logic (±10% threshold)
    - Test static frame extension
    - Test freeze frame trimming
    - _Requirements: 4.18, 4.19, 9.3_

### Task 34: Gemini 2.5 Flash Image Interleaved Output

- [~] 34. Upgrade to Gemini 2.5 Flash Image with interleaved output
  - [~] 34.1 Implement interleaved output in StoryGenerator
    - [ ] Verify model identifier (gemini-2.5-flash-image or similar)
    - [ ] Set Response_Modality to ["TEXT", "IMAGE"]
    - [ ] Parse interleaved response to extract text and images
    - [ ] Store extracted illustrations in Cloud Storage
    - [ ] Update Job record with illustration URLs
    - [ ] Implement fallback to Imagen 3 on failure
    - _Requirements: 4.1, 4.2, 4.10, 4.15, 4.16, 4.20_
  
  - [~] 34.2 Implement Imagen 3 fallback logic
    - [ ] Detect interleaved generation failures (API error, timeout, zero images, partial failure, validation failure)
    - [ ] Regenerate ALL page illustrations with Imagen 3 for visual consistency
    - [ ] Use image prompts from story generation
    - [ ] Update Job record to indicate fallback was used
    - [ ] Log fallback frequency for monitoring (target: < 20% fallback rate)
    - _Requirements: 5.1, 5.2_
    - _Note: Gemini 2.5 Flash Image is experimental - monitor fallback rate during development_
  
  - [~] 34.3 Update ProcessingWorker to handle interleaved output
    - [ ] Remove separate illustration generation stage when interleaved succeeds
    - [ ] Display "Generating illustrations..." only when fallback to Imagen 3
    - [ ] Update progress messages to reflect interleaved generation
    - _Requirements: 10.7_
  
  - [~] 34.4 Write unit tests for interleaved output
    - Test interleaved response parsing
    - Test image extraction and storage
    - Test fallback trigger conditions
    - Test Imagen 3 regeneration of all pages
    - _Requirements: 4.1, 4.2, 4.10, 4.15, 4.16, 5.1, 5.2_
  
  - [~] 34.5 Verify fallback behavior with intentional failures
    - [ ] Intentionally corrupt Gemini response to trigger fallback
    - [ ] Simulate timeout to trigger fallback
    - [ ] Verify Imagen 3 generates all pages consistently
    - [ ] Verify Ken Burns fallback for Veo timeout
    - [ ] Test with various image styles and content
    - _Design: Error Handling section_
    - _Note: Critical for hackathon demo - AI services may fail under load_

### Task 35: UI Enhancements

- [~] 35. UI improvements and user experience
  - [x] 35.1 Implement Share API functionality
    - [x] Add Share button in detail/[id].tsx (already implemented)
    - [x] Add Share button in library/[id].tsx (already implemented)
    - [x] Use expo-sharing for cross-platform sharing
    - [x] Share video file with title
    - **Status: COMPLETE - Share functionality already implemented**
    - _Design: Infrastructure Configuration section (Mobile App Share Feature)_
  
  - [x] 35.2 Add 24-hour deletion reminder
    - [x] Display reminder in preview screen (mobile/app/detail/[id].tsx)
    - [x] Message: "Videos are automatically deleted after 24 hours. Save to your library to keep them."
    - [x] Show when status is "done"
    - [x] Use info card style with icon
    - **Status: COMPLETE - Reminder card implemented with icon and styled message**
    - _Requirements: 10.11_

### Task 36: Cloud Run Cold Start Mitigation

- [~] 36. Cloud Run warm-up strategy for hackathon demo
  - [~] 36.1 Configure minimum instances in Terraform
    - [ ] Set min_instance_count to 1 in infra/modules/gcp/pashabook/main.tf
    - [ ] Apply Terraform changes before hackathon demo
    - [ ] Verify instance stays warm (check Cloud Run metrics)
    - _Design: Infrastructure Configuration section_
    - _Note: Prevents 3-5 second cold start delay during demo_
  
  - [~] 36.2 Create warm-up script for pre-demo preparation
    - [ ] Create infra/scripts/warmup.sh script
    - [ ] Send dummy job request to Cloud Run
    - [ ] Wait for job completion to ensure FFmpeg is loaded
    - [ ] Run 5 minutes before hackathon demo/judging
    - _Design: Infrastructure Configuration section_
    - _Note: Ensures first real demo job has no cold start delay_
  
  - [~] 36.3 Document warm-up procedure in deployment guide
    - [ ] Add "Pre-Demo Checklist" section to deployment-workflow.md
    - [ ] Include warm-up script execution steps
    - [ ] Include verification steps (check Cloud Run logs)
    - _Note: Critical for smooth hackathon demo experience_

### Task 37: Gemini Interleaved Output Prototype

- [~] 37. Early prototype for Gemini 2.5 Flash Image interleaved output
  - [~] 37.1 Create standalone prototype script
    - [ ] Create backend/scripts/test-interleaved.ts
    - [ ] Test Gemini 2.5 Flash Image API with Response_Modality ["TEXT", "IMAGE"]
    - [ ] Parse multipart response to extract text and images
    - [ ] Verify image format and dimensions
    - [ ] Test with various prompts and styles
    - _Design: StoryGenerator section_
    - _Note: Validate interleaved output works before full integration_
  
  - [~] 37.2 Document parsing logic and edge cases
    - [ ] Document multipart boundary parsing
    - [ ] Document image extraction from base64 or binary
    - [ ] Document error cases (missing images, malformed response)
    - [ ] Add code comments with examples
    - _Note: Interleaved parsing is complex - early validation prevents integration delays_

---

## Implementation Priority for MVP Completion

Based on design requirements and current implementation status:

1. **Task 33 (Duration estimation)** - Enables parallel execution, improves performance by 30-60 seconds
2. **Task 31 (Character voices)** - Core feature for engaging narration, high demo impact
3. **Task 32 (BGM)** - High impact for demo quality, low implementation risk
4. **Task 29 (FCM)** - Improves UX for 3-minute wait time, allows users to close app
5. **Task 30 (Queue position)** - Improves UX during concurrent usage at hackathon
6. **Task 28 (Infrastructure)** - Performance optimization (CPU boost), BGM file upload
7. **Task 35.2 (24h reminder)** - Simple UI enhancement, prevents user confusion
8. **Task 34 (Interleaved output)** - Experimental feature, has fallback to Imagen 3

## Current Implementation Status Summary

**Completed Core Features:**
- ✅ Authentication system (Firebase Auth, session management)
- ✅ Image upload with validation (format, size, dimensions)
- ✅ API endpoints (upload, status, video) with authentication
- ✅ Image analysis (Gemini 2.0 Flash)
- ✅ Story generation (Gemini 2.0 Flash, JSON output, 3 pages for testing)
- ✅ Illustration generation (Imagen 3)
- ✅ Narration generation (Cloud TTS, single voice per page)
- ✅ Animation engine (FFmpeg Ken Burns, Veo 3.1 Fast with fallback)
- ✅ Video composition (FFmpeg, crossfade transitions, audio sync)
- ✅ Processing pipeline orchestration (Cloud Run Worker, Cloud Tasks)
- ✅ Mobile app UI (create, progress, detail, library screens)
- ✅ Local library storage (AsyncStorage + FileSystem)
- ✅ Share functionality (expo-sharing)
- ✅ CORS configuration (Terraform)
- ✅ Git hooks (pre-commit, pre-push)
- ✅ Rate limiting (express-rate-limit)
- ✅ Polling safeguards (no infinite loops)

**Partially Implemented:**
- 🟡 StoryGenerator: Uses Gemini 2.0 Flash, needs upgrade to 2.5 Flash Image with interleaved output
- 🟡 NarrationGenerator: Single voice per page, needs character-specific voices
- 🟡 VideoCompositor: Basic audio sync, needs duration adjustment + character audio mixing + BGM
- 🟡 AnimationEngine: Uses actual duration, needs estimated duration for parallel execution
- 🟡 ProcessingWorker: Sequential pipeline, needs parallel narration+animation execution
- 🟡 Library: Placeholder thumbnails, needs actual thumbnail generation
- 🟡 Status endpoint: No queue position calculation
- 🟡 ProcessingSection: No queue position display
- 🟡 PreviewSection: No 24-hour deletion reminder

**Not Implemented:**
- ❌ Gemini 2.5 Flash Image interleaved output (Task 34)
- ❌ Character voice generation with mapping (Task 31)
- ❌ Duration estimation and adjustment (Task 33)
- ❌ BGM integration (Task 32)
- ❌ FCM push notifications (Task 29)
- ❌ Queue position tracking and display (Task 30)
- ❌ Cloud Run CPU boost configuration (Task 28.1)
- ❌ BGM file upload (Task 28.3)
- ❌ 24-hour deletion reminder (Task 35.2)
- ❌ Thumbnail generation (Task 19.1)
- ❌ Most unit and property tests (Tasks marked with *)

**Test Coverage:**
- 9 test files exist in backend/src
- Most tests are marked as optional (*) in tasks.md
- No property-based tests implemented yet
- Pre-commit and pre-push hooks are configured

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (min 100 iterations)
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation uses TypeScript for type safety across frontend and backend
- Parallel execution of narration and illustration generation improves performance
- Veo 3.1 Fast has fallback to FFmpeg for reliability
- 24-hour data retention keeps storage costs manageable for hackathon demo
