import axios from 'axios';
import { Survey, Question, ApiResponse } from './surveyService';
import { participantsConfig } from '@/lib/api-config';

const API_BASE_URL = participantsConfig.baseUrl;
const PARTICIPANTS_HOST = participantsConfig.host;

console.log('Participant API URL:', API_BASE_URL);
console.log('Participant API Host:', PARTICIPANTS_HOST);

// Configure axios to include Host header
axios.defaults.headers.common['Host'] = PARTICIPANTS_HOST;

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

// Analytics types
export interface AnswerResponse {
  questionId: number;
  responseData: any;
  createdAt: string;
}

export interface SessionWithAnswers {
  sessionId: number;
  participantId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  answers: AnswerResponse[];
}

export interface SurveyResultsResponse {
  surveyId: number;
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  sessions: SessionWithAnswers[];
}

// Configure axios defaults for auth (if needed)
axios.defaults.withCredentials = true; // Enable cookies for session auth if needed

export const participantService = {
  /**
   * Start or resume a survey session
   * This will either find an existing IN_PROGRESS session or create a new one
   */
  async startOrResume(surveyId: string): Promise<StartResumeResponse> {
    try {
      const url = `${API_BASE_URL}${participantsConfig.paths.session(surveyId)}`;
      console.log(`Making API request to: ${url}`);
      console.log(`With Host header: ${PARTICIPANTS_HOST}`);
      const response = await axios.post<StartResumeResponse>(
        url,
        {},
        { 
          headers: { 
            'Host': PARTICIPANTS_HOST
          } 
        }
      );
      
      console.log('API Response:', response);
      
      // The API directly returns the session data without a 'data' wrapper
      if (!response.data) {
        console.error('Invalid API response:', response);
        throw new Error('Invalid API response structure');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error starting or resuming survey:', error);
      throw error;
    }
  },

  /**
   * Get an existing session without creating a new one
   */
  async getSession(surveyId: string): Promise<StartResumeResponse> {
    try {
      const response = await axios.get<StartResumeResponse>(
        `${API_BASE_URL}${participantsConfig.paths.session(surveyId)}`,
        { 
          headers: { 
            'Host': PARTICIPANTS_HOST
          } 
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  },

  /**
   * Save draft answers for a session
   */
  async saveDraft(
    sessionId: number, 
    lastQuestionId: number | null, 
    draftAnswers: Record<string, any>
  ): Promise<void> {
    try {
      await axios.put(
        `${API_BASE_URL}${participantsConfig.paths.draft(sessionId)}`,
        { lastQuestionId, draftAnswers },
        { 
          headers: { 
            'Host': PARTICIPANTS_HOST
          } 
        }
      );
    } catch (error) {
      console.error('Error saving draft:', error);
      throw error;
    }
  },

  /**
   * Submit final answers for a session
   */
  async submitSurvey(sessionId: number, answers: FinalAnswerInput[]): Promise<void> {
    try {
      await axios.post(
        `${API_BASE_URL}${participantsConfig.paths.submit(sessionId)}`,
        { answers },
        { 
          headers: { 
            'Host': PARTICIPANTS_HOST
          } 
        }
      );
    } catch (error) {
      console.error('Error submitting survey:', error);
      throw error;
    }
  },

  /**
   * Get the current draft
   */
  async getDraft(sessionId: number): Promise<ParticipantSurveyDraft | null> {
    try {
      // Note: This endpoint might need to be implemented in the backend
      const response = await axios.get<ParticipantSurveyDraft>(
        `${API_BASE_URL}${participantsConfig.paths.draft(sessionId)}`,
        {
          headers: {
            'Host': PARTICIPANTS_HOST
          }
        }
      );
      return response.data;
    } catch (error) {
      // If 404, return null (no draft exists yet)
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching draft:', error);
      throw error;
    }
  },

  /**
   * Get survey results/analytics for conductors
   */
  async getSurveyResults(surveyId: number): Promise<SurveyResultsResponse> {
    try {
      const response = await axios.get<{ success: boolean; data: SurveyResultsResponse }>(
        `${API_BASE_URL}/api/participant/surveys/${surveyId}/results`,
        {
          headers: {
            'Host': PARTICIPANTS_HOST
          },
          withCredentials: true
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching survey results:', error);
      throw error;
    }
  },

  /**
   * Get responses for a specific session
   */
  async getSessionResponses(sessionId: number): Promise<AnswerResponse[]> {
    try {
      const response = await axios.get<{ success: boolean; data: AnswerResponse[] }>(
        `${API_BASE_URL}/api/participant/sessions/${sessionId}/responses`,
        {
          headers: {
            'Host': PARTICIPANTS_HOST
          },
          withCredentials: true
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching session responses:', error);
      throw error;
    }
  }
};