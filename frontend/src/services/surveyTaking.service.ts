// Service for survey taking functionality

import type {
  AvailableSurvey,
  SessionResponse,
  SubmitSurveyRequest,
  SubmitSurveyResponse,
} from "@/types/survey-taking";

const SURVEY_API_URL = process.env.NEXT_PUBLIC_SURVEY_API_URL || "http://localhost:3001";
const PARTICIPANT_API_URL = process.env.NEXT_PUBLIC_PARTICIPANT_API_URL || "http://localhost:8081";

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
  /**
   * Get list of available surveys for participants
   */
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
      `${SURVEY_API_URL}/api/v1/surveys/available?${queryParams.toString()}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch available surveys");
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Start or resume a survey session
   */
  async startOrResumeSession(surveyId: number): Promise<SessionResponse> {
    const response = await fetch(
      `${PARTICIPANT_API_URL}/api/participant/surveys/${surveyId}/session`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to start session" }));
      throw new Error(error.message || "Failed to start survey session");
    }

    return await response.json();
  },

  /**
   * Save draft progress
   */
  async saveDraft(
    sessionId: number,
    draftData: {
      lastQuestionId?: number;
      draftContent: string;
    }
  ): Promise<void> {
    const response = await fetch(
      `${PARTICIPANT_API_URL}/api/participant/sessions/${sessionId}/draft`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draftData),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to save draft");
    }
  },

  /**
   * Submit final survey answers
   */
  async submitSurvey(
    sessionId: number,
    submitData: SubmitSurveyRequest
  ): Promise<SubmitSurveyResponse> {
    const response = await fetch(
      `${PARTICIPANT_API_URL}/api/participant/sessions/${sessionId}/submit`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
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
};

