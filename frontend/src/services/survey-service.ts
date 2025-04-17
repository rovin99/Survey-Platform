import { SurveySummary, DetailedResults } from '@/types/survey-response';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const surveyService = {
  async getSurveySummary(surveyId: number): Promise<SurveySummary> {
    try {
      const response = await axios.get(`${API_URL}/api/surveys/${surveyId}/summary`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching survey summary:', error);
      throw error;
    }
  },

  async getDetailedResults(surveyId: number): Promise<DetailedResults> {
    try {
      const response = await axios.get(`${API_URL}/api/surveys/${surveyId}/detailed-results`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching detailed results:', error);
      throw error;
    }
  }
};
