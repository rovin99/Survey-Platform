import axios from 'axios';
import { Survey, Question, ApiResponse } from './surveyService';
import { participantsConfig } from '@/lib/api-config';

const API_BASE_URL = participantsConfig.baseUrl;

// Types
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
  draftAnswersContent: Record<string, any> | string;
  lastSaved: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinalAnswerInput {
  questionId: number;
  responseData: any;
}

export interface StartResumeResponse {
  session: SurveySession;
  draft: ParticipantSurveyDraft | null;
  survey: Survey;
}

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

// Legacy response type (keeping for backwards compatibility)
export interface SurveyResultsResponseLegacy {
  surveyId: number;
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  sessions: SessionWithAnswers[];
}

// Enhanced answer detail with question context and scoring
export interface AnswerDetail {
  questionId: number;
  questionText: string;
  questionType: string;
  userAnswer: any;
  correctAnswer?: any;
  isCorrect?: boolean;
  pointsEarned?: number;
  pointsPossible?: number;
  justification?: string;
}

// Enhanced participant result with email and scores
export interface ParticipantResult {
  sessionId: number;
  participantId: number;
  email: string;
  totalAttempts: number;   // Total number of attempts by this participant
  currentAttempt: number;  // Which attempt is being shown (latest)
  participantInfo?: Record<string, any>; // Custom participant fields (name, roll_no, etc.)
  status: string;
  startedAt: string;
  completedAt?: string;
  timeTakenSeconds?: number;
  // Quiz-specific fields
  // Browser/Device info
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  deviceType?: string;
  ipAddress?: string;
  // Anti-cheating
  tabSwitchCount?: number;
  // Quiz-specific fields
  score?: number;
  totalPoints?: number;
  percentage?: number;
  passed?: boolean;
  bestScore?: number;       // Best score across all attempts
  bestPercentage?: number;  // Best percentage across all attempts
  answers: AnswerDetail[];
}

// Enhanced survey results response
export interface SurveyResultsResponse {
  surveyId: number;
  surveyTitle: string;
  isQuiz: boolean;
  maxAttempts?: number;
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  averageScore?: number;
  passRate?: number;
  participants: ParticipantResult[];
}

axios.defaults.withCredentials = true;

// Get CSRF token from cookie for axios requests
function getCSRFToken(): string | null {
  if (typeof window === 'undefined') return null;
  const name = 'csrf-token=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');
  for (let i = 0; i < cookieArray.length; i++) {
    const cookie = cookieArray[i].trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length);
    }
  }
  return null;
}

// Add CSRF token to all non-GET requests
axios.interceptors.request.use((config) => {
  if (config.method && config.method.toUpperCase() !== 'GET') {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

export const participantService = {
  async startOrResume(surveyId: string): Promise<StartResumeResponse> {
    const response = await axios.post<StartResumeResponse>(
      `${API_BASE_URL}${participantsConfig.paths.session(surveyId)}`,
      {}
    );
    return response.data;
  },

  async getSession(surveyId: string): Promise<StartResumeResponse> {
    const response = await axios.get<StartResumeResponse>(
      `${API_BASE_URL}${participantsConfig.paths.session(surveyId)}`
    );
    return response.data;
  },

  async saveDraft(sessionId: number, lastQuestionId: number | null, draftAnswers: Record<string, any>): Promise<void> {
    await axios.put(
      `${API_BASE_URL}${participantsConfig.paths.draft(sessionId)}`,
      { lastQuestionId, draftAnswers }
    );
  },

  async submitSurvey(sessionId: number, answers: FinalAnswerInput[]): Promise<void> {
    await axios.post(
      `${API_BASE_URL}${participantsConfig.paths.submit(sessionId)}`,
      { answers }
    );
  },

  async getDraft(sessionId: number): Promise<ParticipantSurveyDraft | null> {
    try {
      const response = await axios.get<ParticipantSurveyDraft>(
        `${API_BASE_URL}${participantsConfig.paths.draft(sessionId)}`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getSurveyResults(surveyId: number): Promise<SurveyResultsResponse> {
    const response = await axios.get<{ success: boolean; data: SurveyResultsResponse }>(
      `${API_BASE_URL}/api/participant/surveys/${surveyId}/results`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getSessionResponses(sessionId: number): Promise<AnswerResponse[]> {
    const response = await axios.get<{ success: boolean; data: AnswerResponse[] }>(
      `${API_BASE_URL}/api/participant/sessions/${sessionId}/responses`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async resetParticipant(surveyId: number, email: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.delete<{ success: boolean; message: string }>(
      `${API_BASE_URL}/api/participant/surveys/${surveyId}/reset-participant?email=${encodeURIComponent(email)}`,
      { withCredentials: true }
    );
    return response.data;
  },

  async saveQuestionEvaluation(sessionId: number, evaluation: {
    question_id: number;
    marks_given: number;
    max_marks: number;
    feedback?: string;
  }): Promise<{ success: boolean }> {
    const response = await axios.post(
      `${API_BASE_URL}/api/participant/sessions/${sessionId}/evaluation/question`,
      evaluation,
      { withCredentials: true }
    );
    return response.data;
  },

  async submitEvaluation(sessionId: number, evaluations: {
    question_id: number;
    marks_given: number;
    max_marks: number;
    feedback?: string;
  }[], notifyByEmail: boolean = false): Promise<{ success: boolean; data?: any }> {
    const response = await axios.post(
      `${API_BASE_URL}/api/participant/sessions/${sessionId}/manual-evaluate`,
      { evaluations, notify_by_email: notifyByEmail },
      { withCredentials: true }
    );
    return response.data;
  },

  async getEvaluationResults(sessionId: number): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/api/participant/sessions/${sessionId}/evaluation-results`,
      { withCredentials: true }
    );
    return response.data.data || response.data;
  }
};
