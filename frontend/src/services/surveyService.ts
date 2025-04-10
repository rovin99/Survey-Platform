import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_SURVEY_API_URL || 'http://localhost:3001';

export interface Survey {
  id: number;
  conductor_id: number;
  title: string;
  description: string;
  is_self_recruitment: boolean;
  status: string;
  questions: Question[];
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: string;
  correct_answers: string;
  branching_logic: string;
  mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface Answer {
  questionId: number;
  value: string;
}

export interface SurveyProgress {
  completed: boolean;
  currentQuestionIndex: number;
  totalQuestions: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}

export const surveyService = {
  async getSurvey(surveyId: string): Promise<Survey> {
    const response = await axios.get<ApiResponse<Survey>>(`${API_BASE_URL}/api/surveys/${surveyId}`);
    return response.data.data;
  },

  async getProgress(surveyId: string): Promise<SurveyProgress> {
    const response = await axios.get(`${API_BASE_URL}/api/surveys/${surveyId}/progress`);
    return response.data;
  },

  async submitAnswers(surveyId: string, answers: Answer[]): Promise<void> {
    await axios.post(`${API_BASE_URL}/api/answers/bulk`, {
      surveyId,
      answers,
    });
  },
}; 