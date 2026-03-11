# Implementation Plan: Pashabook MVP

## Overview

This implementation plan breaks down the Pashabook MVP into discrete coding tasks. The system is a React Native mobile app with Google Cloud Platform backend that transforms children's drawings into animated storybooks using AI services (Gemini 2.0 Flash, Imagen 3, Veo 3.1 Fast, Cloud TTS).

Key technical stack:
- Frontend: React Native (Expo), TypeScript
- Backend: Node.js 20, Cloud Functions, Cloud Run
- AI: Gemini 2.0 Flash, Imagen 3, Veo 3.1 Fast, Cloud TTS
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

  - [ ]* 2.2 Write unit tests for authentication
    - Test email format validation
    - Test password length validation (min 6 characters)
    - Test invalid credentials error handling
    - Test session persistence in AsyncStorage
    - _Requirements: 1.2, 1.3, 1.9_

- [x] 3. Backend API endpoints (Cloud Functions)
  - [x] 3.1 Implement POST /api/upload endpoint
    - Accept multipart/form-data with image and language
    - Verify Firebase ID token in Authorization header
    - Validate file format (JPEG/PNG only)
    - Validate file size (< 10MB)
    - Validate image dimensions (>= 500x500px)
    - Upload image to Cloud Storage
    - Create Job record in Firestore with userId
    - Enqueue processing task to Cloud Tasks
    - Return jobId and status
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.2 Write property test for upload validation
    - **Property 1: Valid Image Format Acceptance**
    - **Validates: Requirements 2.1, 2.2, 2.5, 2.6, 2.7**

  - [ ]* 3.3 Write unit tests for upload endpoint
    - Test rejection of invalid formats (GIF, BMP, WEBP)
    - Test rejection of oversized files (> 10MB)
    - Test rejection of undersized images (< 500x500px)
    - Test error messages for each validation failure
    - _Requirements: 2.3, 2.4_

  - [x] 3.4 Implement GET /api/status/:jobId endpoint
    - Verify Firebase ID token
    - Check job userId matches authenticated user
    - Query Job record from Firestore
    - Return job status, progress, result, and error fields
    - _Requirements: 10.6_

  - [ ]* 3.5 Write property test for job query
    - **Property 43: Job Query Round-Trip**
    - **Validates: Requirements 10.6**

  - [x] 3.6 Implement GET /api/video/:jobId endpoint
    - Verify Firebase ID token
    - Check job userId matches authenticated user
    - Verify job status is "done"
    - Generate signed URLs for video and download (24-hour expiry)
    - Return videoUrl, downloadUrl, and expiresAt
    - _Requirements: 11.1, 11.2_

  - [ ]* 3.7 Write property test for signed URL generation
    - **Property 44: Signed URL Generation**
    - **Validates: Requirements 11.1**

  - [ ]* 3.8 Write unit tests for video endpoint
    - Test 401 error for missing token
    - Test 403 error for wrong user
    - Test 404 error for non-existent job
    - Test 404 error for incomplete job
    - _Requirements: 11.1, 11.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Image analysis service (Cloud Run Worker)
  - [x] 5.1 Implement ImageAnalyzer with Gemini 2.0 Flash
    - Create analyze() function accepting imageUrl and language
    - Extract character names and descriptions
    - Extract setting and background information
    - Extract art style characteristics
    - Extract emotional tone
    - Identify climax indicators (key emotional elements) for Story_Generator to use when selecting Highlight_Pages
    - Complete analysis within 30 seconds
    - Store results in Job record
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 5.3 Write property test for analysis persistence
    - **Property 4: Analysis Persistence**
    - **Validates: Requirements 3.7**

  - [ ]* 5.4 Write unit tests for image analyzer
    - Test timeout handling (> 30 seconds)
    - Test retry logic with exponential backoff
    - Test error response handling
    - _Requirements: 3.6_

- [x] 6. Story generation service (Cloud Run Worker)
  - [x] 6.1 Implement StoryGenerator with Gemini 2.0 Flash
    - Create generate() function accepting analysis and language
    - Generate story with 5-6 pages
    - Use age-appropriate vocabulary (3-8 years)
    - Incorporate character descriptions from analysis
    - Incorporate style description from analysis
    - Incorporate emotional tone from analysis
    - Generate story title
    - Create narration text per page (20-100 words)
    - Create image generation prompt per page
    - Select 1-2 pages as Highlight_Pages using climax indicators from analysis
    - Designate animation mode per page (standard/highlight)
    - Support Japanese and English languages
    - Complete generation within 30 seconds
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [ ]* 6.2 Write property tests for story generation
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

  - [ ]* 6.3 Write unit tests for story generator
    - Test timeout handling (> 30 seconds)
    - Test retry logic
    - Test language-specific content generation
    - _Requirements: 4.12_

- [x] 7. Narration generation service (Cloud Run Worker)
  - [x] 7.1 Implement NarrationGenerator with Cloud TTS
    - Create generatePerPage() function for individual pages
    - Create generateAll() function for parallel processing
    - Use Japanese voice for Japanese stories
    - Use English voice for English stories
    - Use warm and gentle voice tone
    - Store audio files in Cloud Storage
    - Return audio URL and duration per page
    - Complete all narration within 30 seconds
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 7.2 Write property tests for narration
    - **Property 29: Narration Generation**
    - **Property 30: Narration Storage**
    - **Property 31: Narration URL in Job Record**
    - **Property 50: Narration Language**
    - **Validates: Requirements 8.1, 8.5, 8.6, 12.5**

  - [ ]* 7.3 Write unit tests for narration generator
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

  - [ ]* 8.2 Write property tests for illustration generation
    - **Property 13: Illustration Count Matches Page Count**
    - **Property 14: Style in Illustration Prompts**
    - **Property 15: Characters in Illustration Prompts**
    - **Property 16: Illustration Resolution**
    - **Property 17: Illustration Storage**
    - **Property 18: Illustration URLs in Job Record**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.6, 5.7**

  - [ ]* 8.3 Write unit tests for illustration generator
    - Test parallel generation execution
    - Test timeout handling (> 90 seconds)
    - Test retry logic
    - _Requirements: 5.4, 5.8_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Animation engine - Standard pages (Cloud Run Worker)
  - [x] 10.1 Implement standard page animation with FFmpeg Ken Burns effect
    - Create animateStandardPage() function
    - Accept illustration and narration duration
    - Randomly select zoom direction (in/out)
    - Randomly select pan direction (left/right/none)
    - Generate video clip matching narration duration
    - Store clips in Cloud Storage
    - Update Job record with clip URLs
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8_

  - [ ]* 10.2 Write property tests for standard page animation
    - **Property 19: Standard Page Animation Completeness**
    - **Property 20: Zoom Direction Validity**
    - **Property 21: Pan Direction Validity**
    - **Property 22: Standard Page Clip Duration**
    - **Property 23: Animation Clip Storage**
    - **Property 24: Animation URLs in Job Record**
    - **Validates: Requirements 6.1, 6.3, 6.4, 6.5, 6.7, 6.8**

  - [ ]* 10.3 Write unit tests for Ken Burns effect
    - Test FFmpeg command generation
    - Test zoom-in effect parameters
    - Test zoom-out effect parameters
    - Test pan direction parameters
    - Test duration synchronization with audio
    - _Requirements: 6.2, 6.5_

- [x] 11. Animation engine - Highlight pages (Cloud Run Worker)
  - [x] 11.1 Implement highlight page animation with Veo 3.1 Fast
    - Create animateHighlightPage() function
    - Accept illustration, prompt, and narration duration
    - Generate video clip with Veo 3.1 Fast
    - Match clip duration to narration duration
    - Implement 60-second timeout with FFmpeg fallback
    - Implement error handling with FFmpeg fallback
    - Store clips in Cloud Storage
    - Update Job record with clip URLs
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 11.2 Write property tests for highlight page animation
    - **Property 25: Highlight Page Animation Completeness**
    - **Property 26: Highlight Page Clip Duration**
    - **Property 27: Highlight Clip Storage**
    - **Property 28: Highlight URLs in Job Record**
    - **Validates: Requirements 7.1, 7.2, 7.6, 7.7**

  - [ ]* 11.3 Write unit tests for Veo integration
    - Test timeout fallback to FFmpeg (> 60 seconds)
    - Test error fallback to FFmpeg
    - Test duration synchronization
    - _Requirements: 7.4, 7.5_

- [x] 12. Video composition service (Cloud Run Worker)
  - [x] 12.1 Implement VideoCompositor with FFmpeg
    - Create compose() function accepting clips and narrations
    - Combine all page clips in sequence
    - Apply 0.5 second crossfade transitions between pages
    - Synchronize narration audio with video timeline
    - Produce output at 1280x720 resolution
    - Produce output in MP4 format
    - Store final video in Cloud Storage
    - Update Job record with video URL and status "done"
    - Complete composition within 60 seconds
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ]* 12.2 Write property tests for video composition
    - **Property 32: Video Clip Count**
    - **Property 33: Audio-Video Synchronization**
    - **Property 34: Final Video Resolution**
    - **Property 35: Final Video Format**
    - **Property 36: Final Video Storage**
    - **Property 37: Job Status Update on Completion**
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7**

  - [ ]* 12.3 Write unit tests for video compositor
    - Test crossfade transition timing (0.5 seconds)
    - Test audio-video synchronization accuracy
    - Test FFmpeg command generation
    - _Requirements: 9.2, 9.3_

- [x] 13. Processing pipeline orchestration (Cloud Run Worker)
  - [x] 13.1 Implement main processing worker
    - Create Cloud Run service handling Cloud Tasks queue
    - Orchestrate pipeline: Analysis → Story → Parallel(Narration + Illustration) → Animation → Composition
    - Update Job status at each stage (pending → processing → done/error)
    - Update progress percentage (0-100)
    - Implement retry logic with exponential backoff
    - Handle errors and update Job with error messages
    - Log all errors to Cloud Logging
    - Sanitize error messages for users
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 17.4, 17.5_

  - [ ]* 13.2 Write property tests for job status management
    - **Property 38: Job Status Transition to Processing**
    - **Property 39: Job Status Transition to Done**
    - **Property 40: Job Status Transition to Error**
    - **Property 41: Error Message Storage**
    - **Property 42: Timestamp Updates**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

  - [ ]* 13.3 Write unit tests for pipeline orchestration
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

  - [ ]* 15.2 Write unit tests for app state management
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

  - [ ]* 16.2 Write property test for upload UI
    - **Property 2: Job ID Uniqueness**
    - **Validates: Requirements 2.7**

  - [ ]* 16.3 Write unit tests for upload section
    - Test image picker integration
    - Test loading state display
    - Test error message display
    - _Requirements: 17.1_

- [x] 17. Frontend - Processing section
  - [x] 17.1 Implement ProcessingSection component
    - Poll GET /api/status/:jobId every 2 seconds
    - Display current stage (analyzing/generating/illustrating/animating/narrating/composing)
    - Display progress percentage (0-100)
    - Transition to preview stage when status is "done"
    - Display error message when status is "error"
    - Display retry button for network errors
    - _Requirements: 10.6, 17.2, 17.3_

  - [ ]* 17.2 Write unit tests for processing section
    - Test polling mechanism
    - Test progress display updates
    - Test error handling
    - Test retry button functionality
    - _Requirements: 17.2, 17.3_

- [x] 18. Frontend - Preview section
  - [x] 18.1 Implement PreviewSection component
    - Call GET /api/video/:jobId to get signed URL
    - Display video player with playback controls
    - Display story title (editable)
    - Display story text for all pages
    - Implement save to library button
    - Implement download button
    - Handle title editing and persistence
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 14.1, 14.2_

  - [ ]* 18.2 Write property tests for preview section
    - **Property 45: Download Link Availability**
    - **Property 46: Title Display with Video**
    - **Property 47: Story Text Display with Video**
    - **Property 57: Default Title Display**
    - **Property 58: Title Edit Functionality**
    - **Validates: Requirements 11.2, 11.4, 11.5, 14.1, 14.2**

  - [ ]* 18.3 Write unit tests for preview section
    - Test video playback
    - Test title editing
    - Test save functionality
    - Test download functionality
    - _Requirements: 11.3_

- [x] 19. Frontend - Library management
  - [x] 19.1 Implement local library storage with AsyncStorage and FileSystem
    - Create library data structure in AsyncStorage
    - Download video file to device FileSystem when saving
    - Generate and store thumbnail from video
    - Store metadata (title, videoUri, thumbnailUri, createdAt)
    - Implement library CRUD operations (save, list, delete)
    - _Requirements: 13.1, 13.2, 13.6, 13.7_

  - [ ]* 19.2 Write property tests for library storage
    - **Property 51: Library Save Functionality**
    - **Property 52: Library Local Storage Persistence**
    - **Property 54: Library Delete Functionality**
    - **Property 55: Saved Storybook Fields**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.6, 13.7**

  - [ ]* 19.3 Write unit tests for library storage
    - Test AsyncStorage operations
    - Test FileSystem operations
    - Test thumbnail generation
    - _Requirements: 13.2, 13.6_

- [x] 20. Frontend - Library section
  - [x] 20.1 Implement LibrarySection component
    - Display all saved storybooks in grid layout
    - Show thumbnail, title, and creation date per book
    - Implement view button to play saved video
    - Implement delete button with confirmation
    - Handle empty library state
    - Display custom titles when available
    - _Requirements: 13.3, 13.7, 13.4, 14.4_

  - [ ]* 20.2 Write property tests for library UI
    - **Property 53: Library Display Completeness**
    - **Property 56: Library Thumbnail Display**
    - **Property 59: Custom Title Persistence**
    - **Property 60: Custom Title in Library**
    - **Validates: Requirements 13.3, 13.7, 14.3, 14.4**

  - [ ]* 20.3 Write unit tests for library section
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

  - [ ]* 22.2 Write property tests for language support
    - **Property 48: UI Language Selection**
    - **Property 49: Story Content Language**
    - **Validates: Requirements 12.3, 12.4**

  - [ ]* 22.3 Write unit tests for i18n
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

  - [ ]* 23.2 Write property tests for error handling
    - **Property 61: Upload Error Messages**
    - **Property 62: Generation Error Messages**
    - **Property 63: Network Error Retry Option**
    - **Property 64: Error Logging**
    - **Property 65: Error Message Sanitization**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

  - [ ]* 23.3 Write unit tests for error handling
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

  - [ ]* 24.2 Write unit tests for cleanup
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

  - [ ]* 25.2 Write unit tests for performance
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

  - [ ]* 26.2 Write end-to-end integration tests
    - Test complete upload-to-preview flow
    - Test library save and retrieval
    - Test error scenarios
    - Test concurrent job processing
    - _Requirements: All requirements_

- [x] 27. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

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
