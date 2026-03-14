export const config = {
  projectId: process.env.GCP_PROJECT_ID || '',
  region: process.env.GCP_REGION || 'us-central1',
  storageBucket: process.env.STORAGE_BUCKET || process.env.STORAGE_BUCKET_UPLOADS || '',
  storageBucketUploads: process.env.STORAGE_BUCKET_UPLOADS || '',
  storageBucketVideos: process.env.STORAGE_BUCKET_VIDEOS || '',
  storageBucketAudio: process.env.STORAGE_BUCKET_AUDIO || '',
  storageBucketImages: process.env.STORAGE_BUCKET_IMAGES || '',
  tasksQueue: process.env.TASKS_QUEUE || 'pashabook-processing',
  
  // BGM configuration
  bgmStoragePath: process.env.BGM_STORAGE_PATH || 'gs://pashabook-assets/bgm/',
  
  // AI Service endpoints
  vertexAI: {
    location: process.env.VERTEX_AI_LOCATION || 'us-central1',
    geminiModel: 'gemini-2.0-flash-exp',
    imagenModel: 'imagen-3.0-generate-001',
    veoModel: 'veo-3.1-fast',
  },
  
  // Cloud TTS
  tts: {
    japaneseVoice: {
      languageCode: 'ja-JP',
      name: 'ja-JP-Neural2-B',
      ssmlGender: 'FEMALE' as const,
    },
    englishVoice: {
      languageCode: 'en-US',
      name: 'en-US-Neural2-F',
      ssmlGender: 'FEMALE' as const,
    },
  },
  
  // Processing timeouts (in seconds)
  timeouts: {
    analysis: 30,
    storyGeneration: 30,
    narration: 30,
    illustration: 90,
    veo: 60,
    composition: 60,
  },
  
  // Retry configuration
  retry: {
    maxAttempts: 3,
    initialDelay: 1000, // ms
    maxDelay: 10000, // ms
    multiplier: 2,
  },
};

export function validateConfig() {
  const required = ['projectId'];
  const missing = required.filter(key => !config[key as keyof typeof config]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
  
  // Warn if no storage buckets are configured
  if (!config.storageBucket && !config.storageBucketUploads) {
    console.warn('Warning: No storage buckets configured');
  }
}
