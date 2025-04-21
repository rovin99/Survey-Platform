import axios from 'axios';
import { Survey, Question, ApiResponse } from './surveyService';

const API_BASE_URL = process.env.NEXT_PUBLIC_PARTICIPANT_API_URL || 'http://localhost:8081'; // ParticipantsManagementService port

console.log('Participant API URL:', API_BASE_URL);

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
    try {
      console.log(`Making API request to: ${API_BASE_URL}/api/participant/surveys/${surveyId}/session`);
      const response = await axios.post<StartResumeResponse>(
        `${API_BASE_URL}/api/participant/surveys/${surveyId}/session`
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
        `${API_BASE_URL}/api/participant/surveys/${surveyId}/session`
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
        `${API_BASE_URL}/api/participant/sessions/${sessionId}/draft`,
        {
          lastQuestionId,
          draftAnswers,
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
      console.log('Making submit survey request:', {
        url: `${API_BASE_URL}/api/participant/sessions/${sessionId}/submit`,
        data: { answers }
      });

      // First verify the question IDs exist
      const session = await this.getSession(sessionId.toString());
      const validQuestionIds = session.survey.questions.map(q => q.id);
      
      // Check if all answer question IDs are valid
      const invalidQuestionIds = answers
        .map(a => a.questionId)
        .filter(id => !validQuestionIds.includes(id));

      if (invalidQuestionIds.length > 0) {
        console.error('Invalid question IDs:', {
          invalidIds: invalidQuestionIds,
          validIds: validQuestionIds
        });
        throw new Error(`Invalid question IDs: ${invalidQuestionIds.join(', ')}`);
      }

      await axios.post(
        `${API_BASE_URL}/api/participant/sessions/${sessionId}/submit`,
        {
          answers,
        }
      );
    } catch (error) {
      console.error('Error submitting survey:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
        console.error('Status:', error.response?.status);
      }
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
        `${API_BASE_URL}/api/participant/sessions/${sessionId}/draft`
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
  }
};