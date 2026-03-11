import { Timestamp } from '@google-cloud/firestore';

export type JobStatus = 'pending' | 'processing' | 'done' | 'error';
export type ProcessingStage = 'analyzing' | 'generating' | 'illustrating' | 'animating' | 'narrating' | 'composing';
export type Language = 'ja' | 'en';
export type AnimationMode = 'standard' | 'highlight';

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
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

export interface StoryPage {
  pageNumber: number;
  narrationText: string;
  imagePrompt: string;
  animationMode: AnimationMode;
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
  audioUrl: string;
  duration: number;
  language: Language;
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
