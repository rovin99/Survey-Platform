import { LIMITS } from '@/constants/survey';
import { surveyConfig, authConfig } from '@/lib/api-config';
import type { SurveyDraft, ServerResponse } from '@/types/survey';

export class SurveyApiService {
  private baseUrl: string;

  constructor(baseUrl: string = surveyConfig.baseUrl) {
    this.baseUrl = baseUrl;
  }

  private getCSRFToken(): string | null {
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

  private buildHeaders(method: string, customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...customHeaders };
    if (method !== 'GET' && method !== 'HEAD') {
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return headers;
  }

  async checkDraftExists(draftId: number): Promise<boolean> {
    try {
      let response = await fetch(`${this.baseUrl}${surveyConfig.paths.drafts}/${draftId}`, {
        method: 'HEAD',
        credentials: 'include',
      });

      if (response.status === 405) {
        response = await fetch(`${this.baseUrl}${surveyConfig.paths.drafts}/${draftId}`, {
          method: 'GET',
          credentials: 'include',
        });
      }

      return response.ok;
    } catch (error) {
      console.error('Error checking if draft exists:', error);
      return false;
    }
  }

  async saveDraft(draft: SurveyDraft, transformedContent: any): Promise<ServerResponse> {
    const draftExists = draft.draftId ? await this.checkDraftExists(draft.draftId) : false;

    const method = draftExists ? 'PUT' : 'POST';
    const endpoint = draftExists
      ? `${this.baseUrl}${surveyConfig.paths.drafts}/${draft.draftId}`
      : `${this.baseUrl}${surveyConfig.paths.drafts}`;

    const requestBody = {
      survey_id: draft.draftContent.basicInfo.conductor_id,
      draft_content: transformedContent,
      last_edited_question: draft.lastEditedQuestion ? parseInt(draft.lastEditedQuestion) : 0,
      draft_id: draft.draftId || undefined
    };

    const response = await fetch(endpoint, {
      method,
      headers: this.buildHeaders(method, { 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to save draft: ${response.status}`);
    }

    return response.json();
  }

  async saveDraftWithRetry(draft: SurveyDraft, transformedContent: any): Promise<ServerResponse> {
    try {
      return await this.saveDraft(draft, transformedContent);
    } catch (error) {
      console.error('Initial save failed, attempting retries:', error);

      for (let i = 0; i < LIMITS.MAX_RETRIES; i++) {
        const delay = 2000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
          return await this.saveDraft(draft, transformedContent);
        } catch (retryError) {
          console.error(`Retry ${i + 1} failed:`, retryError);
          if (i === LIMITS.MAX_RETRIES - 1) {
            throw retryError;
          }
        }
      }

      throw error;
    }
  }

  async publishDraft(draftId: number): Promise<ServerResponse> {
    const response = await fetch(`${this.baseUrl}${surveyConfig.paths.drafts}/${draftId}/publish`, {
      method: 'POST',
      headers: this.buildHeaders('POST', { 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ normalizeQuestionIds: true })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to publish survey: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async uploadMedia(file: File, draftId?: number): Promise<{ mediaId: number; fileUrl: string; fileType: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (draftId) {
      formData.append('draftId', draftId.toString());
    }

    const response = await fetch(`${this.baseUrl}${surveyConfig.paths.mediaUpload}`, {
      method: 'POST',
      headers: this.buildHeaders('POST'),
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  }

  // Fetch a published survey by ID (conductor-authenticated, for editing or preview)
  async getSurvey(surveyId: number): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/surveys/${surveyId}`, {
      method: 'GET',
      headers: this.buildHeaders('GET', { 'Content-Type': 'application/json' }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load survey');
    }

    const data = await response.json();
    return data.data || data;
  }

  // Fetch survey and transform to SessionResponse shape for preview mode
  async getSurveyForPreview(surveyId: number): Promise<any> {
    const survey = await this.getSurvey(surveyId);

    // Transform backend snake_case to frontend camelCase (matching SessionResponse shape)
    return {
      session: { id: 0, surveyId: survey.id, sessionStatus: 'PREVIEW', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      draft: null,
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        conductorId: survey.conductor_id,
        status: survey.status,
        isSelfRecruitment: survey.is_self_recruitment,
        questionDisplayMode: survey.question_display_mode || 'one_by_one',
        isQuiz: survey.is_quiz,
        timeLimitMinutes: survey.time_limit_minutes,
        passingScorePercentage: survey.passing_score_percentage,
        showCorrectAnswers: survey.show_correct_answers,
        shuffleQuestions: survey.shuffle_questions,
        shuffleOptions: survey.shuffle_options,
        questions: (survey.questions || []).map((q: any) => ({
          id: q.id,
          surveyId: q.survey_id,
          questionText: q.question_text,
          questionType: q.question_type,
          mandatory: q.mandatory,
          correctAnswers: q.correct_answers,
          points: q.points,
          explanation: q.explanation,
          orderIndex: q.id,
          options: (q.options || []).map((o: any) => ({
            id: o.id,
            questionId: o.question_id,
            optionText: o.option_text,
            orderIndex: o.id,
          })),
          mediaFiles: (q.media_files || []).map((m: any) => ({
            id: m.id,
            questionId: m.question_id,
            fileUrl: m.file_url,
            fileType: m.file_type,
          })),
        })),
      },
    };
  }

  async getCurrentConductor(): Promise<{ conductorId: number }> {
    const response = await fetch(`${authConfig.baseUrl}${authConfig.paths.conductorRegister}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load conductor information');
    }

    return response.json();
  }
}

export const surveyApi = new SurveyApiService();
