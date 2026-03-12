# Requirements Document

## Introduction

Pashabook is an AI-powered storybook generator that transforms children's drawings into animated storybooks with narration. The system analyzes uploaded drawings, generates age-appropriate stories, creates consistent illustrations, produces animations, and combines everything into a shareable video format. This document defines the requirements for the MVP implementation targeting the Gemini Live Agent Challenge hackathon.

## Glossary

- **Pashabook_System**: The complete AI-powered storybook generation system
- **Image_Analyzer**: Gemini 2.0 Flash component that analyzes uploaded drawings
- **Story_Generator**: Gemini Flash Image component that creates story content with interleaved text and images
- **Illustration_Generator**: Imagen 3 component that creates page illustrations (legacy mode)
- **Interleaved_Output**: Mixed response containing both text and images in a single API call
- **Response_Modality**: Output format specification for Gemini API (TEXT, IMAGE, or both)
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
- **Voice_Profile**: TTS configuration parameters assigned to a character type (voice name, pitch, speaking rate)
- **Character_Dialogue**: Spoken text attributed to a specific character, extracted from narration using quotation marks or dialogue tags
- **Narrator**: Non-character voice that delivers descriptive narration between character dialogues

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

**Implementation Note:** Climax indicator extraction from drawings alone is challenging. The Image_Analyzer provides emotional cues (e.g., "intense action", "dramatic moment", "emotional peak") that Story_Generator uses as hints. The final decision on which pages are Highlight_Pages is made by Story_Generator based on both the drawing analysis and the generated story structure. This two-stage approach ensures highlight pages align with actual story climax points rather than relying solely on visual analysis.

**Style Extraction Best Practice:** When extracting Style_Description, include specific visual characteristics such as:
- Drawing medium (crayon, watercolor, marker, colored pencil, etc.)
- Color palette (bright/pastel/dark, primary colors, warm/cool tones)
- Line quality (bold/thin, rough/smooth, continuous/sketchy)
- Composition style (simple/detailed, centered/scattered, realistic/abstract)

These specific keywords significantly improve Imagen 3's ability to match the original drawing's visual style when used as fallback (Requirement 5).

### Requirement 4: Story Generation with Interleaved Output and Duration Estimation

**User Story:** As a user, I want an age-appropriate story with illustrations generated together, so that I can share it with my child

#### Acceptance Criteria

1. WHEN drawing analysis is complete, THE Story_Generator SHALL use Gemini 2.5 Flash Image model (gemini-2.5-flash-image)
2. THE Story_Generator SHALL configure Response_Modality as ["TEXT", "IMAGE"] for interleaved output
3. THE Story_Generator SHALL create a story with 5 to 6 pages in a single API call
4. THE Story_Generator SHALL use vocabulary appropriate for children aged 3 to 8 years
5. THE Story_Generator SHALL incorporate Character_Descriptions from the analysis
6. THE Story_Generator SHALL incorporate Style_Description from the analysis
7. THE Story_Generator SHALL incorporate emotional tone from the analysis
8. THE Story_Generator SHALL generate a story title
9. THE Story_Generator SHALL create narration text for each page with 20 to 100 words
10. THE Story_Generator SHALL generate one illustration per page as part of the Interleaved_Output
11. THE Story_Generator SHALL designate 1 to 2 pages as Highlight_Pages based on story climax points (highest emotional intensity or key plot moments), using climax indicators from the analysis
12. THE Story_Generator SHALL designate animation mode for each page as either "standard" or "highlight"
13. WHERE the user selected Japanese language, THE Story_Generator SHALL generate story content in Japanese
14. WHERE the user selected English language, THE Story_Generator SHALL generate story content in English
15. THE Story_Generator SHALL parse the Interleaved_Output to extract text content and image data for each page
16. THE Story_Generator SHALL store extracted illustrations in Cloud Storage
17. THE Story_Generator SHALL output narration text in JSON structured format: `[{"text": "...", "speaker": "narrator"}, {"text": "...", "speaker": "protagonist"}]`
18. THE Story_Generator SHALL estimate audio duration for each page using language-specific formulas:
    - Japanese: (character count / 250 characters-per-minute) for child-friendly pacing
    - English: (word count / 180 words-per-minute)
19. THE Story_Generator SHALL store estimated durations in the Job record for use by Animation_Engine
20. THE Story_Generator SHALL complete generation within 60 seconds

**Implementation Note:** This requirement replaces the separate story generation and illustration generation steps with a single interleaved API call using Gemini 2.5 Flash Image. The model generates both text and images together, ensuring better coherence between story content and visuals. Images are extracted from the interleaved response and stored in Cloud Storage for subsequent animation processing. JSON structured output prevents parse errors and enables robust character voice separation. 

Duration estimation uses language-specific formulas for improved accuracy:
- Japanese: character count / 250 characters-per-minute (slower pacing for children aged 3-8, allows time to view illustrations)
- English: word count / 180 words-per-minute

Duration estimation enables parallel execution of narration and animation generation, improving overall pipeline performance by 30-60 seconds.

**Model Identifier Verification:** Before implementation, verify the exact model identifier for Gemini 2.5 Flash Image in Google AI Studio or Vertex AI documentation. The model name "gemini-2.5-flash-image" in this requirement may need to be updated to match the actual API identifier (e.g., "gemini-2.0-flash-exp" or similar). Check the latest Google AI documentation for the correct model ID that supports interleaved text and image generation.

**Risk Note:** Gemini 2.5 Flash Image's image generation capability is currently experimental. Monitor fallback frequency to Imagen 3 (Requirement 5) during development and testing. If fallback rate exceeds 20%, consider making Imagen 3 the primary method and Gemini interleaved output the fallback. Note that Requirement 5.2 ensures visual consistency by regenerating ALL pages with Imagen 3 if any page fails with Gemini.

### Requirement 5: Illustration Generation (Fallback Mode)

This is an internal fallback mechanism. The primary method is Gemini Flash Image interleaved output (Requirement 4). Imagen 3 is used only when the interleaved approach fails.

#### Acceptance Criteria

1. IF Gemini Flash Image interleaved generation fails, THEN THE Illustration_Generator SHALL create illustrations using Imagen 3
2. IF Gemini Flash Image interleaved generation succeeds for some pages but fails for others, THEN THE Illustration_Generator SHALL regenerate ALL page illustrations using Imagen 3 to maintain visual consistency
3. THE Illustration_Generator SHALL create one illustration per story page
4. THE Illustration_Generator SHALL incorporate Style_Description into each illustration prompt
5. THE Illustration_Generator SHALL incorporate Character_Descriptions into each illustration prompt
6. THE Illustration_Generator SHALL generate all page illustrations in parallel
7. THE Illustration_Generator SHALL produce illustrations at 1280x720 pixel resolution
8. THE Illustration_Generator SHALL store generated illustrations in Cloud Storage
9. THE Illustration_Generator SHALL update the Job record with illustration URLs
10. THE Illustration_Generator SHALL complete all illustrations within 90 seconds

**Implementation Note:** To maintain visual consistency, if even one page fails with Gemini interleaved output, ALL pages are regenerated with Imagen 3. This prevents mixed styles within a single storybook (e.g., page 1 in Gemini style, pages 2-6 in Imagen style).

### Requirement 6: Standard Page Animation

**User Story:** As a user, I want animated pages in my storybook, so that the viewing experience is engaging

#### Acceptance Criteria

1. WHEN story generation is complete with estimated durations, THE Animation_Engine SHALL create animations for all Standard_Pages in parallel with Narration_Generator
2. THE Animation_Engine SHALL use estimated durations from Story_Generator for initial clip generation
3. THE Animation_Engine SHALL apply Ken_Burns_Effect to Standard_Page illustrations
4. THE Animation_Engine SHALL randomly select zoom direction as either zoom-in or zoom-out for each Standard_Page
5. THE Animation_Engine SHALL randomly select pan direction as left, right, or none for each Standard_Page
6. THE Animation_Engine SHALL create video clips for each Standard_Page with duration matching the estimated duration
7. THE Animation_Engine SHALL generate Standard_Page animations in parallel
8. THE Animation_Engine SHALL store animation clips in Cloud Storage
9. THE Animation_Engine SHALL update the Job record with animation clip URLs

**Implementation Note:** Estimated durations enable parallel execution of animation and narration generation. Video_Compositor performs final synchronization using actual narration durations from Requirement 8.12.

### Requirement 7: Highlight Page Animation

**User Story:** As a user, I want special animated pages at story climax points, so that the storybook has memorable moments

#### Acceptance Criteria

1. WHEN story generation is complete with estimated durations, THE Animation_Engine SHALL create animations for all Highlight_Pages using Veo 3.1 Fast in parallel with Narration_Generator
2. THE Animation_Engine SHALL use estimated durations from Story_Generator for initial clip generation
3. THE Animation_Engine SHALL execute Highlight_Page generation asynchronously
4. IF Veo 3.1 Fast generation fails, THEN THE Animation_Engine SHALL apply Ken_Burns_Effect as fallback
5. IF Veo 3.1 Fast generation exceeds 60 seconds, THEN THE Animation_Engine SHALL apply Ken_Burns_Effect as fallback
6. THE Animation_Engine SHALL store Highlight_Page clips in Cloud Storage
7. THE Animation_Engine SHALL update the Job record with Highlight_Page clip URLs
8. THE Animation_Engine SHALL display progress message "Creating special animations..." during Veo 3.1 Fast generation

**Implementation Note:** Veo 3.1 Fast is used for highlight pages to create memorable moments at story climax points. Estimated durations enable parallel execution with narration generation. Ken Burns effect serves as a reliable fallback if Veo generation fails or times out, ensuring the pipeline always completes successfully. Video_Compositor performs final synchronization using actual narration durations from Requirement 8.12.

**Hackathon Demo Consideration:** For hackathon demos with high concurrent usage, consider one of these approaches to prevent queue congestion:
1. Reduce Veo timeout from 60 seconds to 30 seconds (AC 5) to fail-fast to Ken Burns
2. Use feature flag to disable Veo entirely and use Ken Burns for all pages
3. Deploy with environment variable `VEO_ENABLED=false` to skip Veo processing

These are deployment-time configurations, not runtime logic in the codebase.

### Requirement 8: Narration Generation with Character Voices

**User Story:** As a user, I want narration audio for the story, so that I can play it for my child without reading

**Note:** Duration estimation is defined in Requirements 4.18-4.19. The following criteria specify narration generation with character-specific voices.

#### Acceptance Criteria

1. WHEN estimated durations are available, THE Narration_Generator SHALL create audio narration with character-specific voices from story text
2. THE Narration_Generator SHALL identify speaking characters from JSON structured narration segments
3. WHERE the story language is Japanese, THE Narration_Generator SHALL use distinct Japanese voice configurations for each character type
4. WHERE the story language is English, THE Narration_Generator SHALL use distinct English voice configurations for each character type
5. THE Narration_Generator SHALL use a warm and gentle voice tone for all characters
6. THE Narration_Generator SHALL generate separate audio files for each character's dialogue segments
7. THE Narration_Generator SHALL generate a narrator audio file for non-dialogue narration
8. THE Narration_Generator SHALL maintain consistent voice assignment for each character across all story pages
9. THE Narration_Generator SHALL store narration audio files in Cloud Storage (multiple files per page for character voices)
10. THE Narration_Generator SHALL update the Job record with narration audio URLs (array of URLs for all audio segments)
11. THE Narration_Generator SHALL complete all page narrations within 45 seconds total
12. THE Narration_Generator SHALL calculate actual duration per page by summing all character audio segment durations
13. THE Narration_Generator SHALL update the Job record with actual durations, replacing estimated durations

**Implementation Note:** Character-specific voice generation is a required feature for MVP. Duration estimation (defined in Requirements 4.18-4.19) enables parallel execution of narration and animation generation, improving overall pipeline performance. 

Animation_Engine uses estimated durations to start processing in parallel with Narration_Generator. Video_Compositor performs final synchronization using actual narration durations, adjusting video clip lengths if needed (e.g., adding static frames at the end). 

**Audio Pacing:** To create natural rhythm similar to human read-aloud, the Video_Compositor inserts 0.3-second silence padding between narrator segments and character dialogue segments. This prevents audio segments from feeling rushed or overlapping. The 50ms crossfade (Requirement 9.5) is applied within character dialogue transitions only, not between narrator and character segments.

**Character Voice Consistency (AC 8.8):** To maintain consistent voice assignment across all pages, the system implements a character-to-voice mapping mechanism:

1. **Mapping Creation:** On first encounter of each character (during page 1 narration generation), the system assigns a TTS voice ID and stores the mapping in the Job record's `characterVoiceMap` field
2. **Mapping Structure:** `{"protagonist": "ja-JP-Wavenet-B", "supporting_character_1": "ja-JP-Wavenet-C", "narrator": "ja-JP-Wavenet-A"}`
3. **Mapping Persistence:** The mapping is stored in Firestore and retrieved for each subsequent page's narration generation
4. **Character Identification:** Character names from Image_Analyzer (Requirement 3.1) are used as keys in the mapping dictionary
5. **Lookup Process:** Before generating audio for any character segment, Narration_Generator checks the `characterVoiceMap` for an existing voice assignment. If found, use that voice ID. If not found (new character), assign a new voice ID and update the mapping in Firestore.

Example flow:
- Page 1: "protagonist" appears → assign ja-JP-Wavenet-B → store in Job.characterVoiceMap
- Page 3: "protagonist" appears → lookup Job.characterVoiceMap → retrieve ja-JP-Wavenet-B → use same voice
- Page 5: "protagonist" appears → lookup Job.characterVoiceMap → retrieve ja-JP-Wavenet-B → use same voice

This ensures "くまのプーさん" (Winnie the Pooh) uses ja-JP-Wavenet-B consistently across all pages, maintaining character voice identity throughout the storybook.

JSON structured output format from Story_Generator enables robust character voice separation. Each character type (protagonist, supporting characters, narrator) receives a distinct Google Cloud TTS voice configuration. The actual duration per page (calculated in AC 8.12) is used by Video_Compositor for final synchronization.

### Requirement 9: Video Composition with Duration Adjustment

**User Story:** As a user, I want a complete video file, so that I can easily share and play the storybook

#### Acceptance Criteria

1. WHEN all animations and narration are complete, THE Video_Compositor SHALL combine all page clips into a single video
2. THE Video_Compositor SHALL synchronize each video clip with actual narration duration from Narration_Generator
3. WHERE animation clip duration differs from actual narration duration, THE Video_Compositor SHALL adjust clip duration by adding static frames at the end or trimming excess frames
4. THE Video_Compositor SHALL insert 0.3-second silence padding between narrator segments and character dialogue segments for natural pacing
5. THE Video_Compositor SHALL apply 50 millisecond crossfade transitions between character voice segments (within character dialogue only, not between narrator and character)
6. THE Video_Compositor SHALL apply 0.5 second crossfade transitions between pages
7. THE Video_Compositor SHALL synchronize narration audio with video timeline
8. THE Video_Compositor SHALL produce output video at 1280x720 pixel resolution
9. THE Video_Compositor SHALL produce output video in MP4 format
10. THE Video_Compositor SHALL store the final video in Cloud Storage
11. THE Video_Compositor SHALL update the Job record with final video URL and status "done"
12. THE Video_Compositor SHALL complete composition within 60 seconds

**Implementation Note:** Duration adjustment compensates for differences between estimated durations (from Requirements 4.18-4.19, used by Animation_Engine in Requirements 6 and 7) and actual narration durations (from Requirement 8.12). This enables parallel processing while maintaining perfect audio-video synchronization in the final output. The 0.3-second silence padding between narrator and character segments creates natural pacing similar to human read-aloud, preventing audio from feeling rushed. The 50ms crossfade is applied only within character dialogue transitions to smooth voice changes.

### Requirement 10: Progress Tracking with Queue Position

**User Story:** As a user, I want to see generation progress and my position in queue, so that I know the system is working and when to expect results

#### Acceptance Criteria

1. THE Pashabook_System SHALL update Job status to "processing" when generation begins
2. THE Pashabook_System SHALL update Job status to "done" when video composition completes
3. THE Pashabook_System SHALL update Job status to "error" when any component fails
4. WHEN Job status is "error", THE Pashabook_System SHALL store an error message in the Job record
5. THE Pashabook_System SHALL update Job timestamps on each status change
6. THE Pashabook_System SHALL allow clients to query Job status by Job identifier
7. THE Pashabook_System SHALL display user-friendly progress messages during generation:
   - "Analyzing your drawing..." (Image_Analyzer phase)
   - "Creating your story..." (Story_Generator phase - Gemini 2.5 Flash Image interleaved output)
   - "Generating illustrations..." (Illustration_Generator phase - only shown if fallback to Imagen 3)
   - "Adding narration and animations..." (Parallel execution of Narration_Generator and Animation_Engine - Requirements 6, 7, and 8)
   - "Finalizing your storybook..." (Video_Compositor phase - audio mixing and BGM)
8. WHEN a Job is in "pending" status and Cloud Tasks queue has 3 or more active jobs, THE Pashabook_System SHALL calculate and return queue position
9. THE Pashabook_System SHALL display queue position message "You are #N in queue" when queuePosition > 0
10. THE Pashabook_System SHALL update queue position on each status query
11. WHEN Job status is "done", THE Pashabook_System SHALL display a reminder message "Videos are automatically deleted after 24 hours. Save to your library to keep them." in the preview screen

**Implementation Note:** Progress messages manage user expectations and reduce perceived wait time during the generation process. Queue position visibility improves user experience during peak usage (e.g., hackathon demos with multiple concurrent users). Parallel execution message ("Adding narration and animations...") reflects the optimized pipeline architecture where Narration_Generator (Requirement 8) and Animation_Engine (Requirements 6 and 7) execute concurrently using estimated durations from Requirements 4.18-4.19. The 24-hour deletion reminder ensures users understand the temporary nature of server-stored videos and encourages saving to local library (Requirement 13).

### Requirement 11: Video Preview, Download, and Completion Notification

**User Story:** As a user, I want to preview and download the storybook video and be notified when it's ready, so that I can share it with my child even if I close the app

#### Acceptance Criteria

1. WHEN Job status is "done", THE Pashabook_System SHALL provide a signed URL for video preview valid for 24 hours (matching data retention policy)
2. WHEN Job status is "done", THE Pashabook_System SHALL provide a download link for the video file
3. THE Pashabook_System SHALL allow video playback in the mobile app
4. THE Pashabook_System SHALL display the story title with the video
5. THE Pashabook_System SHALL display the story text alongside the video
6. WHEN Job status changes to "done", THE Pashabook_System SHALL send a push notification via Firebase Cloud Messaging (FCM) to the user's device
7. THE push notification SHALL display title "Your storybook is ready!" and body "Tap to view your animated storybook"
8. WHEN user taps the push notification, THE mobile app SHALL open and navigate to the preview screen for that Job
9. THE Pashabook_System SHALL send push notifications only to the user who created the Job

**Security Note:** Job records include `userId` field. API endpoints verify that authenticated users can only access their own jobs. Job IDs are UUIDs for additional security. Signed URLs expire in 24 hours, matching the data retention policy.

**Implementation Note:** FCM push notifications enable users to close the app during the 3-minute generation process and return when notified. This addresses iOS/Android background processing limitations where polling may be suspended. The notification includes the jobId in the data payload for deep linking to the preview screen.

**FCM Token Management (Mobile App Implementation):**
- Mobile app registers for push notifications on app launch using Firebase SDK
- FCM token stored in Firestore `/users/{userId}` collection (fcmToken field in UserProfile)
- Mobile app listens for token refresh events from Firebase SDK and updates Firestore
- Cloud Run worker retrieves fcmToken from UserProfile when sending notification
- Invalid/expired tokens handled gracefully (FCM returns error, Cloud Run logs warning)
- Users without fcmToken (notifications disabled) skip notification step without error

Note: Token refresh handling is implemented in the mobile app layer, not in backend requirements.

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
7. THE Pashabook_System SHALL store thumbnail files in FileSystem and store thumbnail URIs in AsyncStorage (not binary data)
8. THE Pashabook_System SHALL store the title, video file URI, thumbnail URI, and creation timestamp in AsyncStorage
9. THE Pashabook_System SHALL display storybook thumbnails in the Library view
10. THE Pashabook_System SHALL play saved storybooks from local storage without requiring server access

**Implementation Note:** React Native FileSystem is used to store large video files (50MB+) and thumbnail images in the app's document directory. Only metadata (title, URIs, timestamps) is stored in AsyncStorage to avoid exceeding the ~6MB AsyncStorage capacity limit. This approach supports large files and persists data beyond the 24-hour server deletion window.

### Requirement 14: Title Management

**User Story:** As a user, I want to customize the storybook title, so that I can personalize it

#### Acceptance Criteria

1. THE Pashabook_System SHALL display the AI-generated title as the default
2. THE Pashabook_System SHALL allow the user to edit the storybook title
3. WHEN the user edits the title, THE Pashabook_System SHALL save the custom title
4. THE Pashabook_System SHALL display the custom title in the Library view

### Requirement 15: Data Retention with Synchronized TTL

**User Story:** As a system administrator, I want automatic data cleanup with synchronized timing, so that storage costs remain manageable and users don't encounter inconsistent states

#### Acceptance Criteria

1. THE Pashabook_System SHALL delete uploaded images from Cloud Storage after 24 hours
2. THE Pashabook_System SHALL delete generated illustrations from Cloud Storage after 24 hours
3. THE Pashabook_System SHALL delete animation clips from Cloud Storage after 24 hours
4. THE Pashabook_System SHALL delete final videos from Cloud Storage after 24 hours
5. THE Pashabook_System SHALL configure Job records in Firestore with TTL field set to 23 hours from creation time
6. THE Pashabook_System SHALL expire signed URLs after 24 hours (matching Cloud Storage retention policy)

**Implementation Note:** Firestore TTL field is set to 23 hours (1 hour shorter than Cloud Storage lifecycle policy) to minimize the window where metadata exists but video is deleted. However, Firestore TTL deletion is not immediate - GCP processes TTL deletions in batches, typically within 24-72 hours after the TTL timestamp. This means actual deletion may occur 47-95 hours after job creation.

**Acceptable for MVP:** The delayed Firestore deletion is acceptable for hackathon/demo purposes because:
1. Users are encouraged to save videos to local library (Requirement 13) via the 24-hour deletion reminder (Requirement 10.11)
2. Signed URLs expire at 24 hours, preventing access to deleted Cloud Storage objects even if Firestore records remain
3. The inconsistent state (Firestore exists, Storage deleted) results in a 404 error when attempting to access the video, which is handled gracefully by the error handling system (Requirement 17)

**Production Consideration:** For production deployment, consider implementing a Cloud Scheduler job that queries for expired jobs (createdAt + 24 hours < now) and deletes them immediately, bypassing Firestore's TTL batch processing delay.

### Requirement 16: Performance Targets

**User Story:** As a user, I want fast storybook generation, so that I don't have to wait long

#### Acceptance Criteria

1. THE Pashabook_System SHALL complete the entire generation pipeline within 180 seconds
2. THE Pashabook_System SHALL respond to upload requests within 2 seconds
3. THE Pashabook_System SHALL respond to status queries within 1 second
4. THE Pashabook_System SHALL support 3 concurrent Job executions (limited by Veo 3.1 Fast API rate limits)
5. THE Story_Generator SHALL complete interleaved generation (text and images) within 60 seconds

**Implementation Note:** Gemini 2.5 Flash Image (model identifier: gemini-2.5-flash-image) is selected for its cost-effectiveness ($0.10 IN / $0.40 OUT per million tokens vs. Gemini 3.1 Flash-Lite's $0.25 IN / $1.50 OUT) and availability in Google AI Studio's free tier (60 requests/minute). Interleaved generation combines story and illustration generation into a single API call, potentially reducing total pipeline time compared to separate API calls.

**Concurrency Limitation Note:** The 3 concurrent job limit is imposed by Veo 3.1 Fast API rate limits. During hackathon demos with multiple concurrent users:
- Users 1-3: Immediate processing
- User 4+: Queue wait with position display (Requirement 10.8-10.10)
- Estimated wait time: ~3 minutes per queued position

This limitation is acceptable for MVP/hackathon scope. For production, consider: (1) increasing Veo quota, (2) implementing priority queuing, or (3) using Ken Burns effect for all pages to remove Veo dependency.

### Requirement 17: Error Handling

**User Story:** As a user, I want clear error messages, so that I understand what went wrong

#### Acceptance Criteria

1. WHEN image upload fails, THE Pashabook_System SHALL display a descriptive error message
2. WHEN generation fails, THE Pashabook_System SHALL display a descriptive error message
3. WHEN network errors occur, THE Pashabook_System SHALL display a retry option
4. THE Pashabook_System SHALL log all errors to Cloud Logging
5. THE Pashabook_System SHALL not expose internal error details to users

### Requirement 18: Background Music Support

**User Story:** As a user, I want background music in my storybook, so that the viewing experience is more immersive

#### Acceptance Criteria

1. WHEN video composition begins, THE Video_Compositor SHALL select background music based on emotional tone from Image_Analyzer
2. THE Video_Compositor SHALL select from 3 to 4 pre-prepared free BGM tracks (bright, adventure, sad, calm)
3. THE Video_Compositor SHALL loop the selected BGM track to match total video length
4. THE Video_Compositor SHALL mix BGM at low volume (20% to 30% of narration volume)
5. THE Video_Compositor SHALL apply fade-in effect to BGM at video start (1 second duration)
6. THE Video_Compositor SHALL apply fade-out effect to BGM at video end (1 second duration)
7. THE Video_Compositor SHALL ensure BGM does not overpower narration audio

**Implementation Note:** Simple, low-risk feature with high impact for demo quality. BGM tracks should be royalty-free or Creative Commons licensed. Emotional tone mapping: bright/happy → bright BGM, adventure/exciting → adventure BGM, sad/melancholic → sad BGM, calm/peaceful → calm BGM. 

BGM files are stored in Cloud Storage bucket with path configured via environment variable:
- Environment variable: `BGM_STORAGE_PATH` (default: `gs://pashabook-assets/bgm/`)
- Filenames: `bright.mp3`, `adventure.mp3`, `sad.mp3`, `calm.mp3`
- Video_Compositor downloads the selected BGM file during composition

This configuration approach allows different BGM buckets per environment (dev/staging/prod) without code changes.

**Future Enhancement (Optional):** Consider using Lyria 3 (Google's music generation model) to generate custom 30-second BGM loops tailored to each story's emotional tone and narrative. This would create unique, story-specific background music instead of using preset tracks, further showcasing AI capabilities. This is not required for MVP but could be a compelling demo feature if time permits.
