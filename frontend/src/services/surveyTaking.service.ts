// Service for survey taking functionality

import type {
  AvailableSurvey,
  SessionResponse,
  SubmitSurveyRequest,
  SubmitSurveyResponse,
} from "@/types/survey-taking";
import { surveyConfig, participantsConfig } from "@/lib/api-config";

const SURVEY_API_URL = surveyConfig.baseUrl;
const PARTICIPANT_API_URL = participantsConfig.baseUrl;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export const surveyTakingService = {
  async getAvailableSurveys(params?: {
    page?: number;
    perPage?: number;
    category?: string;
    minReward?: number;
    search?: string;
  }): Promise<PaginatedResponse<AvailableSurvey>> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.perPage) queryParams.append("perPage", params.perPage.toString());
    if (params?.category) queryParams.append("category", params.category);
    if (params?.minReward) queryParams.append("minReward", params.minReward.toString());
    if (params?.search) queryParams.append("search", params.search);

    const response = await fetch(
      `${SURVEY_API_URL}${surveyConfig.paths.available}?${queryParams.toString()}`,
      {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch available surveys");
    }

    const data = await response.json();
    return data.data;
  },

  async startOrResumeSession(surveyId: number): Promise<SessionResponse> {
    const response = await fetch(
      `${PARTICIPANT_API_URL}${participantsConfig.paths.session(surveyId.toString())}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to start session" }));
      throw new Error(error.message || "Failed to start survey session");
    }

    return await response.json();
  },

  // Mark the quiz as actually started (anchors the timer). Idempotent server-side.
  async startSession(sessionId: number): Promise<void> {
    const sessionToken = typeof window !== 'undefined'
      ? sessionStorage.getItem(`session_token_${sessionId}`)
      : null;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sessionToken) {
      headers["X-Session-Token"] = sessionToken;
    }

    try {
      await fetch(
        `${PARTICIPANT_API_URL}${participantsConfig.paths.start(sessionId)}`,
        { method: "POST", credentials: "include", headers }
      );
    } catch (error) {
      // Non-fatal: timer falls back to session created_at if this fails
      console.error("Failed to mark session started:", error);
    }
  },

  async saveDraft(
    sessionId: number,
    draftData: {
      lastQuestionId?: number;
      draftAnswers: Record<string, any>;
    }
  ): Promise<void> {
    // Get session token for anonymous access
    const sessionToken = typeof window !== 'undefined'
      ? sessionStorage.getItem(`session_token_${sessionId}`)
      : null;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sessionToken) {
      headers["X-Session-Token"] = sessionToken;
    }

    const response = await fetch(
      `${PARTICIPANT_API_URL}${participantsConfig.paths.draft(sessionId)}`,
      {
        method: "PUT",
        credentials: "include",
        headers,
        body: JSON.stringify(draftData),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to save draft");
    }
  },

  async submitSurvey(
    sessionId: number,
    submitData: SubmitSurveyRequest
  ): Promise<SubmitSurveyResponse> {
    // Get session token for anonymous access
    const storageKey = `session_token_${sessionId}`;
    const sessionToken = typeof window !== 'undefined'
      ? sessionStorage.getItem(storageKey)
      : null;

    // Debug: Log all session tokens in storage
    if (typeof window !== 'undefined') {
      console.log('[DEBUG] submitSurvey - Looking for token with key:', storageKey);
      console.log('[DEBUG] submitSurvey - Token found:', sessionToken ? 'yes' : 'no');
      const allKeys = Object.keys(sessionStorage).filter(k => k.startsWith('session_token_'));
      console.log('[DEBUG] submitSurvey - All session token keys in storage:', allKeys);
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sessionToken) {
      headers["X-Session-Token"] = sessionToken;
    }

    const response = await fetch(
      `${PARTICIPANT_API_URL}${participantsConfig.paths.submit(sessionId)}`,
      {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(submitData),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to submit" }));
      throw new Error(error.message || "Failed to submit survey");
    }

    const data = await response.json();
    return data.data || data;
  },

  // Start session via public share link (for anonymous users)
  async startSessionViaShareLink(token: string, email?: string, password?: string, participantInfo?: Record<string, string>, tokenType?: string): Promise<SessionResponse> {
    const body: Record<string, any> = {};
    if (email) body.email = email;
    if (password) body.password = password;
    if (participantInfo && Object.keys(participantInfo).length > 0) {
      body.participant_info = participantInfo;
    }

    // Build URL with token type if it's an invitation
    let url = `${PARTICIPANT_API_URL}/api/participant/surveys/public/start?token=${encodeURIComponent(token)}`;
    if (tokenType === 'invitation') {
      url += '&type=invitation';
    }
    console.log('[DEBUG] startSessionViaShareLink calling:', url, 'with body:', body);

    const response = await fetch(
      url,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      }
    );

    console.log('[DEBUG] startSessionViaShareLink response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Access denied" }));
      console.error('[DEBUG] startSessionViaShareLink error:', error);
      throw new Error(error.message || "Failed to start session via share link");
    }

    const data = await response.json();

    // Debug: Log the session data to see if token is present
    console.log('[DEBUG] startSessionViaShareLink response data:', {
      sessionId: data.session?.id,
      hasToken: !!data.session?.session_token,
      tokenPreview: data.session?.session_token ? data.session.session_token.substring(0, 8) + '...' : 'NONE'
    });

    // Store session token for subsequent requests (prevents IDOR attacks)
    if (data.session?.session_token && typeof window !== 'undefined') {
      const storageKey = `session_token_${data.session.id}`;
      sessionStorage.setItem(storageKey, data.session.session_token);
      console.log('[DEBUG] Stored session token with key:', storageKey);
    } else {
      console.warn('[DEBUG] No session_token in response! Session ID:', data.session?.id);
    }

    return data;
  },

  // Upload an image as part of a survey answer
  async uploadImage(sessionId: number, file: File): Promise<{ fileUrl: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const headers: Record<string, string> = {};
    // Include session token for anonymous access
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem(`session_token_${sessionId}`);
      if (token) {
        headers["X-Session-Token"] = token;
      }
    }

    const response = await fetch(
      `${PARTICIPANT_API_URL}/api/participant/sessions/${sessionId}/upload`,
      {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Failed to upload image");
    }

    return response.json();
  },
};
