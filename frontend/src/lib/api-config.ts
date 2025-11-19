// Centralized API Configuration
// This file manages all API endpoints and routing for the microservices

export const API_CONFIG = {
  // Base URLs from environment variables
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
  authServiceUrl: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:8080',
  surveyServiceUrl: process.env.NEXT_PUBLIC_SURVEY_SERVICE_URL || 'http://localhost:8080',
  participantsServiceUrl: process.env.NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL || 'http://localhost:8080',
  
  // Kourier routing hosts for Host header (from environment)
  hosts: {
    auth: process.env.NEXT_PUBLIC_AUTH_HOST || 'auth-service.default.127.0.0.1.nip.io',
    survey: process.env.NEXT_PUBLIC_SURVEY_HOST || 'survey-management-service.default.127.0.0.1.nip.io',
    participants: process.env.NEXT_PUBLIC_PARTICIPANTS_HOST || 'participants-management-service.default.127.0.0.1.nip.io',
  },
  
  // Service endpoints
  endpoints: {
    auth: {
      baseUrl: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:8080',
      host: process.env.NEXT_PUBLIC_AUTH_HOST || 'auth-service.default.127.0.0.1.nip.io',
      paths: {
        register: '/api/auth/register',
        login: '/api/auth/login',
        logout: '/api/auth/logout',
        verify: '/api/auth/verify',
        refreshToken: '/api/auth/refresh-token',
        forgotPassword: '/api/auth/forgot-password',
        resetPassword: '/api/auth/reset-password',
        changePassword: '/api/auth/change-password',
        profile: '/api/auth/profile',
        verifyEmail: '/api/auth/verify-email',
        magicLink: '/api/auth/request-magic-link',
        conductorRegister: '/api/Conductor/register',
        participantRegister: '/api/Participant/register',
        conductorDelete: '/api/Conductor/current',
      }
    },
    survey: {
      baseUrl: process.env.NEXT_PUBLIC_SURVEY_SERVICE_URL || 'http://localhost:8080',
      host: process.env.NEXT_PUBLIC_SURVEY_HOST || 'survey-management-service.default.127.0.0.1.nip.io',
      paths: {
        surveys: '/api/surveys',
        surveyById: (id: string) => `/api/surveys/${id}`,
        progress: (id: string) => `/api/surveys/${id}/progress`,
        answers: '/api/answers/bulk',
        available: '/api/v1/surveys/available',
        drafts: '/api/v1/drafts',
        mediaUpload: '/api/v1/media/upload',
      }
    },
    participants: {
      baseUrl: process.env.NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL || 'http://localhost:8080',
      host: process.env.NEXT_PUBLIC_PARTICIPANTS_HOST || 'participants-management-service.default.127.0.0.1.nip.io',
      paths: {
        session: (surveyId: string) => `/api/participant/surveys/${surveyId}/session`,
        draft: (sessionId: number) => `/api/participant/sessions/${sessionId}/draft`,
        submit: (sessionId: number) => `/api/participant/sessions/${sessionId}/submit`,
      }
    }
  }
};

// Helper function to make API requests with proper headers
export async function makeApiRequest<T>(
  url: string,
  options: RequestInit & { serviceHost: string }
): Promise<T> {
  const { serviceHost, headers = {}, ...restOptions } = options;
  
  // Add required headers for Kourier routing
  const requestHeaders = {
    'Host': serviceHost,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  console.log(`API Request: ${restOptions.method || 'GET'} ${url}`);
  console.log(`Host Header: ${serviceHost}`);

  const response = await fetch(url, {
    ...restOptions,
    headers: requestHeaders,
    credentials: 'include', // Important for cookies
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Export individual service configs for convenience
export const authConfig = API_CONFIG.endpoints.auth;
export const surveyConfig = API_CONFIG.endpoints.survey;
export const participantsConfig = API_CONFIG.endpoints.participants;

