import { Timestamp } from '@google-cloud/firestore';

export type JobStatus = 'pending' | 'processing' | 'done' | 'error';
export type ProcessingStage = 'analyzing' | 'generating' | 'illustrating' | 'animating' | 'narrating' | 'composing';
export type Language = 'ja' | 'en';
export type AnimationMode = 'standard' | 'highlight';

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  fcmToken?: string; // FCM device token for push notifications
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Job {
  jobId: string;
  userId: string;
  status: JobStatus;
  language: Language;
  
  // Asset URLs
  uploadedImageUrl?: string;
  illustrationUrls?: string[];
  animationClipUrls?: string[];
  narrationAudioUrls?: string[]; // Array of URLs, one per page
  finalVideoUrl?: string;
  
  // Generation results
  analysis?: AnalysisResult;
  story?: Story;
  estimatedDurations?: number[]; // Per-page estimated durations from Story_Generator
  actualDurations?: number[]; // Per-page actual durations from Narration_Generator
  characterVoiceMap?: CharacterVoiceMap; // Character-to-voice mapping for consistent voices
  
  // Progress tracking
  currentStage?: ProcessingStage;
  progressPercentage?: number;
  
  // Error handling
  error?: string;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ttl: Timestamp; // 24 hours from creation
}

export interface AnalysisResult {
  characters: CharacterDescription[];
  setting: string;
  style: string;
  emotionalTone: string;
  climaxIndicators: string[];
}

export interface CharacterDescription {
  name: string;
  description: string;
}

export interface Story {
  title: string;
  pages: StoryPage[];
}

export interface NarrationSegment {
  text: string;
  speaker: 'narrator' | 'protagonist' | 'supporting_character';
}

export interface StoryPage {
  pageNumber: number;
  narrationText: string; // Deprecated: kept for backward compatibility
  narrationSegments: NarrationSegment[]; // JSON structured format for character voices
  imagePrompt: string;
  animationMode: AnimationMode;
  estimatedDuration: number; // seconds, calculated from word/character count
}

export interface Illustration {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
}

export interface VideoClip {
  pageNumber: number;
  videoUrl: string;
  duration: number;
  width: number;
  height: number;
}

export interface PageNarration {
  pageNumber: number;
  audioSegments: AudioSegment[]; // Separate audio for each character
  duration: number; // Total duration in seconds (sum of all audioSegments)
  actualDuration: number; // Actual duration from TTS (same as duration, for VideoCompositor)
  language: Language;
}

export interface AudioSegment {
  audioUrl: string; // Cloud Storage URL
  speaker: 'narrator' | 'protagonist' | 'supporting_character';
  duration: number; // seconds
  startTime: number; // seconds, relative to page start
}

export interface FinalVideo {
  videoUrl: string;
  duration: number;
  width: number;
  height: number;
  format: 'mp4';
}

export interface KenBurnsParams {
  zoomDirection: 'in' | 'out';
  panDirection: 'left' | 'right' | 'none';
}

export interface CharacterVoiceMap {
  [characterName: string]: VoiceConfig; // e.g., {"protagonist": {...}, "narrator": {...}}
}

export interface VoiceConfig {
  voiceName: string; // e.g., 'ja-JP-Wavenet-B'
  pitch: number; // -20.0 to 20.0
  speakingRate: number; // 0.25 to 4.0
}
