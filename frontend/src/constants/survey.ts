// Storage keys
export const STORAGE_KEYS = {
  CURRENT_DRAFT: 'currentSurveyDraft',
  BACKUP_DRAFT: 'currentSurveyDraft-backup'
} as const;

// API endpoints
export const API_ENDPOINTS = {
  BASE_URL: 'http://localhost:3001',
  DRAFTS: '/api/v1/drafts',
  MEDIA_UPLOAD: '/api/v1/media/upload',
  CONDUCTOR_CURRENT: 'http://localhost:5171/api/Conductor/current'
} as const;

// Timing constants
export const TIMING = {
  DEBOUNCE_DELAY: 5000, // 5 seconds
  BACKUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  RETRY_DELAYS: [2000, 4000], // Exponential backoff
  SYNC_CHECK_INTERVAL: 100, // ms
  SYNC_INITIAL_DELAY: 500, // ms
  IDLE_CALLBACK_TIMEOUT: 1000 // ms
} as const;

// Size limits
export const LIMITS = {
  STORAGE_SIZE_WARNING: 4 * 1024 * 1024, // 4MB
  MAX_RETRIES: 2
} as const;

// Progress values
export const PROGRESS_VALUES = {
  BASIC: 33,
  QUESTIONS: 66,
  BRANCHING: 100
} as const;

// Default values
export const DEFAULTS = {
  QUESTION_TYPE: 'multiple-choice' as const,
  SURVEY_STATUS: 'DRAFT',
  INITIAL_CONDUCTOR_ID: 0,
  INITIAL_QUESTION_ID: 1
} as const;

// File types
export const FILE_TYPES = {
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT'
} as const;

// Question types
export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple-choice',
  SINGLE_CHOICE: 'single-choice',
  TEXT: 'text',
  RATING: 'rating'
} as const;

// Media status
export const MEDIA_STATUS = {
  UPLOADING: 'UPLOADING',
  READY: 'READY',
  ERROR: 'ERROR'
} as const; 