import axios from 'axios';
import { Survey, Question, ApiResponse } from './surveyService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081'; // ParticipantsManagementService port

// Types specific to the participant service
export interface SurveySession {
  id: number;
  surveyId: number;
  participantId: number;
  lastQuestionId: number | null;
  sessionStatus: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantSurveyDraft {
  id: number;
  sessionId: number;
  lastAnsweredQuestionId: number | null;
  draftAnswersContent: Record<string, any> | string; // Either parsed or JSON string
  lastSaved: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinalAnswerInput {
  questionId: number;
  responseData: any; // Can be string, number, array, etc.
}

export interface StartResumeResponse {
  session: SurveySession;
  draft: ParticipantSurveyDraft | null;
  survey: Survey; // Assuming the API also returns survey data
}

// Configure axios defaults for auth (if needed)
axios.defaults.withCredentials = true; // Enable cookies for session auth if needed

export const participantService = {
  /**
   * Start or resume a survey session
   * This will either find an existing IN_PROGRESS session or create a new one
   */
  async startOrResume(surveyId: string): Promise<StartResumeResponse> {
    const response = await axios.post<ApiResponse<StartResumeResponse>>(
      `${API_BASE_URL}/api/participant/surveys/${surveyId}/session`
    );
    return response.data.data;
  },

  /**
   * Save draft answers for a session
   */
  async saveDraft(
    sessionId: number, 
    lastQuestionId: number | null, 
    draftAnswers: Record<string, any>
  ): Promise<void> {
    await axios.put(
      `${API_BASE_URL}/api/participant/sessions/${sessionId}/draft`,
      {
        lastQuestionId,
        draftAnswers,
      }
    );
  },

  /**
   * Submit final answers for a session
   */
  async submitSurvey(sessionId: number, answers: FinalAnswerInput[]): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/api/participant/sessions/${sessionId}/submit`,
      {
        answers,
      }
    );
  },

  /**
   * Get the current session data
   */
  async getSession(surveyId: string, accessToken: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${surveyId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching session:', error);
      throw error; // Re-throw to be handled by the caller
    }
  },

  /**
   * Get the current draft
   */
  async getDraft(sessionId: number): Promise<ParticipantSurveyDraft | null> {
    const response = await axios.get<ApiResponse<ParticipantSurveyDraft>>(
      `${API_BASE_URL}/api/participant/sessions/${sessionId}/draft`
    );
    return response.data.data;
  },
};