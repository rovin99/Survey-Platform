import axios from 'axios';
import { SurveyResults } from '../types/survey-response';

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
  async getAvailableSurveys(): Promise<Survey[]> {
    try {
      // Since there's no endpoint to list all surveys, we'll fetch the known survey with ID 4
      // This is the "Student Demographics Survey" from the seed script
      console.log(`Fetching survey with ID 4 from: ${API_BASE_URL}/api/surveys/4`);
      const response = await axios.get<ApiResponse<Survey>>(`${API_BASE_URL}/api/surveys/4`);
      console.log('Survey API response:', response);
      
      // If the API returns empty data but success status, use our hardcoded survey data
      if (!response.data?.data || Object.keys(response.data.data).length === 0) {
        console.log('API returned empty data, using hardcoded survey data');
        return [{
          id: 4,
          conductor_id: 1,
          title: "Student Demographics Survey",
          description: "A survey to understand student demographics at IITGN",
          is_self_recruitment: true,
          status: "PUBLISHED",
          questions: [
            {
              id: 5,
              survey_id: 4,
              question_text: "What is your gender?",
              question_type: "MULTIPLE_CHOICE",
              correct_answers: "Male,Female,Other",
              branching_logic: "",
              mandatory: true,
              created_at: "",
              updated_at: ""
            },
            {
              id: 6,
              survey_id: 4,
              question_text: "What is your age group?",
              question_type: "MULTIPLE_CHOICE",
              correct_answers: "18-20,21-23,24-26,27+",
              branching_logic: "",
              mandatory: true,
              created_at: "",
              updated_at: ""
            },
            {
              id: 7,
              survey_id: 4,
              question_text: "Which state are you from?",
              question_type: "MULTIPLE_CHOICE",
              correct_answers: "Gujarat,Maharashtra,Delhi,Tamil Nadu,Karnataka",
              branching_logic: "",
              mandatory: true,
              created_at: "",
              updated_at: ""
            }
          ],
          created_at: "",
          updated_at: ""
        }];
      }
      
      // Return as an array with the single survey
      return [response.data.data];
    } catch (error) {
      console.error('Error in getAvailableSurveys:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
        console.error('Status:', error.response?.status);
        console.error('Request URL:', error.config?.url);
      }
      throw error;
    }
  },

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

  async getSurveyResults(surveyId: string): Promise<SurveyResults> {
    const response = await axios.get<ApiResponse<SurveyResults>>(`${API_BASE_URL}/api/surveys/${surveyId}/results`);
    return response.data.data;
  },
}; 