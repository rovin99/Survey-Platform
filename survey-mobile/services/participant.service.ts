import api from './api';

export const participantService = {
  async startOrResumeSession(surveyId: number) {
    const response = await api.post(`/api/participant/surveys/${surveyId}/session`);
    return response.data;
  },

  async saveDraft(sessionId: number, lastQuestionId: number | null, draftAnswers: any) {
    const response = await api.put(`/api/participant/sessions/${sessionId}/draft`, {
      lastQuestionId,
      draftAnswers,
    });
    return response.data;
  },

  async submitSurvey(sessionId: number, data: {
    answers: { questionId: number; responseData: any }[];
    completedAt: string;
    tabSwitchCount?: number;
  }) {
    const response = await api.post(`/api/participant/sessions/${sessionId}/submit`, data);
    return response.data;
  },

  async evaluateQuiz(sessionId: number) {
    const response = await api.post(`/api/participant/sessions/${sessionId}/evaluate`);
    return response.data.data || response.data;
  },

  async getMyHistory() {
    const response = await api.get('/api/participant/my-history');
    return response.data.data || response.data;
  },

  async getProfile() {
    const response = await api.get('/api/Participant/profile');
    return response.data.data || response.data;
  },

  async updateProfile(data: { name?: string; rollNo?: string; phoneNumber?: string; customFields?: any[] }) {
    const response = await api.put('/api/Participant/profile', data);
    return response.data;
  },

  async uploadImage(sessionId: number, uri: string, filename: string, type: string) {
    const formData = new FormData();
    formData.append('file', { uri, name: filename, type } as any);

    const response = await api.post(`/api/participant/sessions/${sessionId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async getSurveyResults(surveyId: number) {
    const response = await api.get(`/api/participant/surveys/${surveyId}/results`);
    return response.data.data || response.data;
  },
};
