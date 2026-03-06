# Requirements Document

## Introduction

Pashabook is an AI-powered storybook generator that transforms children's drawings into animated storybooks with narration. The system analyzes uploaded drawings, generates age-appropriate stories, creates consistent illustrations, produces animations, and combines everything into a shareable video format. This document defines the requirements for the MVP implementation targeting the Gemini Live Agent Challenge hackathon.

## Glossary

- **Pashabook_System**: The complete AI-powered storybook generation system
- **Image_Analyzer**: Gemini 2.0 Flash component that analyzes uploaded drawings
- **Story_Generator**: Gemini 2.0 Flash component that creates story content
- **Illustration_Generator**: Imagen 3 component that creates page illustrations
- **Animation_Engine**: Component that creates video animations using FFmpeg or Veo 3.1 Fast
- **Narration_Generator**: Google Cloud TTS component that creates audio narration
- **Video_Compositor**: FFmpeg component that combines clips, audio, and transitions
- **User**: Parent or guardian uploading child's drawing
- **Drawing**: Child's artwork uploaded as JPEG or PNG image
- **Storybook**: Complete output consisting of story text, illustrations, animations, and narration
- **Standard_Page**: Story page animated with Ken Burns effect using FFmpeg
- **Highlight_Page**: Story page animated with Veo 3.1 Fast for enhanced visual impact
- **Style_Description**: Extracted visual characteristics of the original drawing
- **Character_Description**: Extracted character attributes for consistency across pages
- **Ken_Burns_Effect**: Pan and zoom animation technique applied to static images
- **Job**: Asynchronous processing task tracked in Firestore
- **Library**: Mobile app local storage collection of user's generated storybooks (AsyncStorage for metadata, FileSystem for video files)

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to create an account and sign in, so that I can save and manage my storybooks

#### Acceptance Criteria

1. THE Pashabook_System SHALL provide a registration interface accepting name, email, and password
2. WHEN a user registers, THE Pashabook_System SHALL validate email format
3. WHEN a user registers, THE Pashabook_System SHALL require password minimum length of 6 characters
4. WHEN a user registers, THE Pashabook_System SHALL create user account using Firebase Authentication
5. WHEN a user registers, THE Pashabook_System SHALL store user profile (name, email) in Cloud Firestore
6. WHEN a user registers, THE Pashabook_System SHALL create a unique user ID (Firebase UID)
7. THE Pashabook_System SHALL provide a login interface accepting email and password
8. WHEN a user logs in with valid credentials, THE Pashabook_System SHALL create an authenticated session
9. WHEN a user logs in with invalid credentials, THE Pashabook_System SHALL return an error message
10. THE Pashabook_System SHALL maintain user session state in the mobile app using AsyncStorage
11. THE Pashabook_System SHALL provide a logout function that clears the session

**Implementation Note:** For MVP, authentication uses Firebase Authentication (Email/Password provider). Passwords are managed securely by Firebase Authentication (never stored in Firestore). Only user profile data (name, email, userId) is stored in Cloud Firestore. Mobile app maintains session state locally using AsyncStorage.

### Requirement 2: Image Upload and Validation

**User Story:** As a user, I want to upload my child's drawing, so that the system can create a storybook from it

#### Acceptance Criteria

1. THE Pashabook_System SHALL accept image uploads in JPEG format
2. THE Pashabook_System SHALL accept image uploads in PNG format
3. WHEN an image exceeds 10MB, THE Pashabook_System SHALL reject the upload with a descriptive error message
4. WHEN an image is smaller than 500x500 pixels, THE Pashabook_System SHALL reject the upload with a descriptive error message
5. WHEN a valid image is uploaded, THE Pashabook_System SHALL store the image in Cloud Storage
6. WHEN a valid image is uploaded, THE Pashabook_System SHALL create a Job record in Firestore with status "pending"
7. WHEN a valid image is uploaded, THE Pashabook_System SHALL return a unique Job identifier to the user within 2 seconds

### Requirement 3: Drawing Analysis

**User Story:** As a user, I want the system to understand my child's drawing, so that the generated story matches the artwork

#### Acceptance Criteria

1. WHEN a Job is created, THE Image_Analyzer SHALL extract character names and descriptions from the Drawing
2. WHEN a Job is created, THE Image_Analyzer SHALL extract background and setting information from the Drawing
3. WHEN a Job is created, THE Image_Analyzer SHALL extract art style characteristics from the Drawing
4. WHEN a Job is created, THE Image_Analyzer SHALL extract emotional tone from the Drawing
5. WHEN a Job is created, THE Image_Analyzer SHALL identify key emotional elements and climax indicators in the Drawing for Story_Generator to use when selecting Highlight_Pages
6. THE Image_Analyzer SHALL complete analysis within 30 seconds
7. THE Image_Analyzer SHALL store analysis results in the Job record

### Requirement 4: Story Generation

**User Story:** As a user, I want an age-appropriate story generated from the drawing, so that I can share it with my child

#### Acceptance Criteria

1. WHEN drawing analysis is complete, THE Story_Generator SHALL create a story with 5 to 6 pages
2. THE Story_Generator SHALL use vocabulary appropriate for children aged 3 to 8 years
3. THE Story_Generator SHALL incorporate Character_Descriptions from the analysis
4. THE Story_Generator SHALL incorporate Style_Description from the analysis
5. THE Story_Generator SHALL incorporate emotional tone from the analysis
6. THE Story_Generator SHALL generate a story title
7. THE Story_Generator SHALL create narration text for each page with 20 to 100 words
8. THE Story_Generator SHALL create an image generation prompt for each page
9. THE Story_Generator SHALL designate 1 to 2 pages as Highlight_Pages based on story climax points (highest emotional intensity or key plot moments), using climax indicators from the analysis
10. THE Story_Generator SHALL designate animation mode for each page as either "standard" or "highlight"
11. WHERE the user selected Japanese language, THE Story_Generator SHALL generate story content in Japanese
12. WHERE the user selected English language, THE Story_Generator SHALL generate story content in English
13. THE Story_Generator SHALL complete generation within 30 seconds

### Requirement 5: Illustration Generation

**User Story:** As a user, I want illustrations that match my child's drawing style, so that the storybook feels cohesive

#### Acceptance Criteria

1. WHEN story generation is complete, THE Illustration_Generator SHALL create one illustration per story page
2. THE Illustration_Generator SHALL incorporate Style_Description into each illustration prompt
3. THE Illustration_Generator SHALL incorporate Character_Descriptions into each illustration prompt
4. THE Illustration_Generator SHALL generate all page illustrations in parallel
5. THE Illustration_Generator SHALL produce illustrations at 1280x720 pixel resolution
6. THE Illustration_Generator SHALL store generated illustrations in Cloud Storage
7. THE Illustration_Generator SHALL update the Job record with illustration URLs
8. THE Illustration_Generator SHALL complete all illustrations within 90 seconds

### Requirement 6: Standard Page Animation

**User Story:** As a user, I want animated pages in my storybook, so that the viewing experience is engaging

#### Acceptance Criteria

1. WHEN illustration generation is complete, THE Animation_Engine SHALL create animations for all Standard_Pages
2. THE Animation_Engine SHALL apply Ken_Burns_Effect to Standard_Page illustrations
3. THE Animation_Engine SHALL randomly select zoom direction as either zoom-in or zoom-out for each Standard_Page
4. THE Animation_Engine SHALL randomly select pan direction as left, right, or none for each Standard_Page
5. THE Animation_Engine SHALL create video clips for each Standard_Page with duration matching the narration audio duration for that page
6. THE Animation_Engine SHALL generate Standard_Page animations in parallel
7. THE Animation_Engine SHALL store animation clips in Cloud Storage
8. THE Animation_Engine SHALL update the Job record with animation clip URLs

### Requirement 7: Highlight Page Animation

**User Story:** As a user, I want special animated pages at story climax points, so that the storybook has memorable moments

#### Acceptance Criteria

1. WHEN illustration generation is complete, THE Animation_Engine SHALL create animations for all Highlight_Pages using Veo 3.1 Fast
2. THE Animation_Engine SHALL create video clips for each Highlight_Page with duration matching the narration audio duration for that page
3. THE Animation_Engine SHALL execute Highlight_Page generation asynchronously
4. IF Veo 3.1 Fast generation fails, THEN THE Animation_Engine SHALL apply Ken_Burns_Effect as fallback
5. IF Veo 3.1 Fast generation exceeds 60 seconds, THEN THE Animation_Engine SHALL apply Ken_Burns_Effect as fallback
6. THE Animation_Engine SHALL store Highlight_Page clips in Cloud Storage
7. THE Animation_Engine SHALL update the Job record with Highlight_Page clip URLs

### Requirement 8: Narration Generation

**User Story:** As a user, I want narration audio for the story, so that I can play it for my child without reading

#### Acceptance Criteria

1. WHEN story generation is complete, THE Narration_Generator SHALL create audio narration from story text
2. WHERE the story language is Japanese, THE Narration_Generator SHALL use a Japanese voice
3. WHERE the story language is English, THE Narration_Generator SHALL use an English voice
4. THE Narration_Generator SHALL use a warm and gentle voice tone
5. THE Narration_Generator SHALL store narration audio files in Cloud Storage (one file per page)
6. THE Narration_Generator SHALL update the Job record with narration audio URLs (array of URLs for all pages)
7. THE Narration_Generator SHALL complete all page narrations within 30 seconds total

### Requirement 9: Video Composition

**User Story:** As a user, I want a complete video file, so that I can easily share and play the storybook

#### Acceptance Criteria

1. WHEN all animations and narration are complete, THE Video_Compositor SHALL combine all page clips into a single video
2. THE Video_Compositor SHALL apply 0.5 second crossfade transitions between pages
3. THE Video_Compositor SHALL synchronize narration audio with video timeline
4. THE Video_Compositor SHALL produce output video at 1280x720 pixel resolution
5. THE Video_Compositor SHALL produce output video in MP4 format
6. THE Video_Compositor SHALL store the final video in Cloud Storage
7. THE Video_Compositor SHALL update the Job record with final video URL and status "done"
8. THE Video_Compositor SHALL complete composition within 60 seconds

### Requirement 10: Progress Tracking

**User Story:** As a user, I want to see generation progress, so that I know the system is working

#### Acceptance Criteria

1. THE Pashabook_System SHALL update Job status to "processing" when generation begins
2. THE Pashabook_System SHALL update Job status to "done" when video composition completes
3. THE Pashabook_System SHALL update Job status to "error" when any component fails
4. WHEN Job status is "error", THE Pashabook_System SHALL store an error message in the Job record
5. THE Pashabook_System SHALL update Job timestamps on each status change
6. THE Pashabook_System SHALL allow clients to query Job status by Job identifier

### Requirement 11: Video Preview and Download

**User Story:** As a user, I want to preview and download the storybook video, so that I can share it with my child

#### Acceptance Criteria

1. WHEN Job status is "done", THE Pashabook_System SHALL provide a signed URL for video preview valid for 24 hours
2. WHEN Job status is "done", THE Pashabook_System SHALL provide a download link for the video file
3. THE Pashabook_System SHALL allow video playback in the mobile app
4. THE Pashabook_System SHALL display the story title with the video
5. THE Pashabook_System SHALL display the story text alongside the video

**Security Note:** Job records include `userId` field. API endpoints verify that authenticated users can only access their own jobs. Job IDs are UUIDs for additional security.

### Requirement 12: Language Support

**User Story:** As a user, I want to select my preferred language, so that the storybook matches my child's language

#### Acceptance Criteria

1. THE Pashabook_System SHALL support Japanese language selection
2. THE Pashabook_System SHALL support English language selection
3. WHEN a language is selected, THE Pashabook_System SHALL display UI text in the selected language
4. WHEN a language is selected, THE Pashabook_System SHALL generate story content in the selected language
5. WHEN a language is selected, THE Pashabook_System SHALL generate narration in the selected language

### Requirement 13: Local Library Management

**User Story:** As a user, I want to save and manage my storybooks locally on my device, so that I can access them later

#### Acceptance Criteria

1. WHEN a storybook is complete, THE Pashabook_System SHALL allow the user to save it to the Library
2. THE Pashabook_System SHALL store Library metadata in mobile app AsyncStorage
3. THE Pashabook_System SHALL store video files in mobile app FileSystem (document directory)
4. THE Pashabook_System SHALL display all saved storybooks in the Library view
5. THE Pashabook_System SHALL allow the user to delete storybooks from the Library
6. WHEN a storybook is saved, THE Pashabook_System SHALL download the video file and store it locally on the device
7. THE Pashabook_System SHALL store the title, video file URI, thumbnail URI, and creation timestamp in AsyncStorage
8. THE Pashabook_System SHALL display storybook thumbnails in the Library view
9. THE Pashabook_System SHALL play saved storybooks from local storage without requiring server access

**Implementation Note:** React Native FileSystem is used to store large video files (50MB+) in the app's document directory. Metadata (title, URIs, timestamps) is stored in AsyncStorage. This approach supports large files and persists data beyond the 24-hour server deletion window.

### Requirement 14: Title Management

**User Story:** As a user, I want to customize the storybook title, so that I can personalize it

#### Acceptance Criteria

1. THE Pashabook_System SHALL display the AI-generated title as the default
2. THE Pashabook_System SHALL allow the user to edit the storybook title
3. WHEN the user edits the title, THE Pashabook_System SHALL save the custom title
4. THE Pashabook_System SHALL display the custom title in the Library view

### Requirement 15: Data Retention

**User Story:** As a system administrator, I want automatic data cleanup, so that storage costs remain manageable

#### Acceptance Criteria

1. THE Pashabook_System SHALL delete uploaded images from Cloud Storage after 24 hours
2. THE Pashabook_System SHALL delete generated illustrations from Cloud Storage after 24 hours
3. THE Pashabook_System SHALL delete animation clips from Cloud Storage after 24 hours
4. THE Pashabook_System SHALL delete final videos from Cloud Storage after 24 hours
5. THE Pashabook_System SHALL delete Job records from Firestore after 24 hours

### Requirement 16: Performance Targets

**User Story:** As a user, I want fast storybook generation, so that I don't have to wait long

#### Acceptance Criteria

1. THE Pashabook_System SHALL complete the entire generation pipeline within 180 seconds
2. THE Pashabook_System SHALL respond to upload requests within 2 seconds
3. THE Pashabook_System SHALL respond to status queries within 1 second
4. THE Pashabook_System SHALL support 3 concurrent Job executions (limited by Veo 3.1 Fast API rate limits)

### Requirement 17: Error Handling

**User Story:** As a user, I want clear error messages, so that I understand what went wrong

#### Acceptance Criteria

1. WHEN image upload fails, THE Pashabook_System SHALL display a descriptive error message
2. WHEN generation fails, THE Pashabook_System SHALL display a descriptive error message
3. WHEN network errors occur, THE Pashabook_System SHALL display a retry option
4. THE Pashabook_System SHALL log all errors to Cloud Logging
5. THE Pashabook_System SHALL not expose internal error details to users
