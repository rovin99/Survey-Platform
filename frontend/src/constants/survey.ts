// Storage keys
export const STORAGE_KEYS = {
  CURRENT_DRAFT: 'currentSurveyDraft',
  BACKUP_DRAFT: 'currentSurveyDraft-backup'
} as const;

// API endpoints
// DEPRECATED: Use centralized API config from @/lib/api-config instead
// Import: import { surveyConfig, authConfig } from '@/lib/api-config'
//
// Example replacements:
// - API_ENDPOINTS.BASE_URL -> surveyConfig.baseUrl
// - API_ENDPOINTS.DRAFTS -> surveyConfig.paths.drafts
// - API_ENDPOINTS.MEDIA_UPLOAD -> surveyConfig.paths.mediaUpload
// - API_ENDPOINTS.CONDUCTOR_CURRENT -> authConfig.baseUrl + authConfig.paths.conductorDelete
//
// These constants are kept only for reference and will be removed in future versions

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