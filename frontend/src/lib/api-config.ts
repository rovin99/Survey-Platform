// Centralized API Configuration
// Simple, direct service URLs - no proxies needed

// Service URLs (override via environment variables in production)
export const API_CONFIG = {
  auth: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:5171',
  survey: process.env.NEXT_PUBLIC_SURVEY_SERVICE_URL || 'http://localhost:5172',
  participants: process.env.NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL || 'http://localhost:5173',
};

// Auth endpoints
export const authConfig = {
  baseUrl: API_CONFIG.auth,
  paths: {
    register: '/api/auth/register',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    verify: '/api/auth/verify',
    refreshToken: '/api/auth/refresh-token',
    profile: '/api/auth/profile',
    magicLink: '/api/auth/request-magic-link',
    conductorRegister: '/api/Conductor/register',
    participantRegister: '/api/Participant/register',
    participantProfile: '/api/Participant/profile',
    conductorDelete: '/api/Conductor/current',
    bulkOnboard: '/api/Participant/bulk-onboard',
    students: '/api/Participant/students',
    changePassword: '/api/auth/change-password',
  }
};

// Survey endpoints
export const surveyConfig = {
  baseUrl: API_CONFIG.survey,
  paths: {
    surveys: '/api/surveys',
    surveyById: (id: string) => `/api/surveys/${id}`,
    progress: (id: string) => `/api/surveys/${id}/progress`,
    answers: '/api/answers/bulk',
    available: '/api/v1/surveys/available',
    assigned: '/api/v1/surveys/assigned/my',
    drafts: '/api/v1/drafts',
    mediaUpload: '/api/v1/media/upload',
  }
};

// Cloudflare Turnstile CAPTCHA
// Get keys from: https://dash.cloudflare.com → Turnstile → Add Site
// For testing: use Cloudflare's test keys (always passes)
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // Test key (always passes)

// Participants endpoints
export const participantsConfig = {
  baseUrl: API_CONFIG.participants,
  paths: {
    session: (surveyId: string) => `/api/participant/surveys/${surveyId}/session`,
    draft: (sessionId: number) => `/api/participant/sessions/${sessionId}/draft`,
    submit: (sessionId: number) => `/api/participant/sessions/${sessionId}/submit`,
    start: (sessionId: number) => `/api/participant/sessions/${sessionId}/start`,
  }
};
