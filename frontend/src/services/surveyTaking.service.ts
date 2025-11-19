// Service for survey taking functionality

import type {
  AvailableSurvey,
  SessionResponse,
  SubmitSurveyRequest,
  SubmitSurveyResponse,
} from "@/types/survey-taking";
import { surveyConfig, participantsConfig } from "@/lib/api-config";

const SURVEY_API_URL = surveyConfig.baseUrl;
const SURVEY_HOST = surveyConfig.host;
const PARTICIPANT_API_URL = participantsConfig.baseUrl;
const PARTICIPANTS_HOST = participantsConfig.host;

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
      `${SURVEY_API_URL}${surveyConfig.paths.available}?${queryParams.toString()}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          ...(surveyConfig.host && { 'Host': surveyConfig.host }),
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
      `${PARTICIPANT_API_URL}${participantsConfig.paths.session(surveyId.toString())}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          ...(participantsConfig.host && { 'Host': participantsConfig.host }),
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
      draftAnswers: Record<string, any>; // Backend expects object, not string
    }
  ): Promise<void> {
    const response = await fetch(
      `${PARTICIPANT_API_URL}${participantsConfig.paths.draft(sessionId)}`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          ...(participantsConfig.host && { 'Host': participantsConfig.host }),
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
      `${PARTICIPANT_API_URL}${participantsConfig.paths.submit(sessionId)}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          ...(participantsConfig.host && { 'Host': participantsConfig.host }),
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

