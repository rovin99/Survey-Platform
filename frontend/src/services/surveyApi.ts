import { LIMITS } from '@/constants/survey';
import { API_CONFIG } from '@/lib/api-config';
import type { SurveyDraft, ServerResponse } from '@/types/survey';

const surveyConfig = API_CONFIG.endpoints.survey;
const authConfig = API_CONFIG.endpoints.auth;

export class SurveyApiService {
  private baseUrl: string;
  private hostHeader: string | undefined;

  constructor(baseUrl: string = surveyConfig.baseUrl, hostHeader?: string) {
    this.baseUrl = baseUrl;
    this.hostHeader = hostHeader || surveyConfig.host;
  }

  /**
   * Check if a draft exists on the server
   */
  async checkDraftExists(draftId: number): Promise<boolean> {
    try {
      const headers: HeadersInit = {
        ...(this.hostHeader && { 'Host': this.hostHeader }),
      };

      // First try with HEAD request (lightweight)
      let response = await fetch(`${this.baseUrl}${surveyConfig.paths.drafts}/${draftId}`, {
        method: 'HEAD',
        headers,
      });

      // If HEAD method is not supported, fall back to GET
      if (response.status === 405) {
        response = await fetch(`${this.baseUrl}${surveyConfig.paths.drafts}/${draftId}`, {
          method: 'GET',
          headers,
        });
      }

      return response.ok;
    } catch (error) {
      console.error('Error checking if draft exists:', error);
      return false;
    }
  }

  /**
   * Save draft to server (POST for new, PUT for existing)
   */
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

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.hostHeader && { 'Host': this.hostHeader }),
    };

    const response = await fetch(endpoint, {
      method,
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to save draft: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Save draft with retry logic
   */
  async saveDraftWithRetry(draft: SurveyDraft, transformedContent: any): Promise<ServerResponse> {
    try {
      return await this.saveDraft(draft, transformedContent);
    } catch (error) {
      console.error('Initial save failed, attempting retries:', error);
      
      // Retry logic with exponential backoff
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

  /**
   * Publish a draft
   */
  async publishDraft(draftId: number): Promise<ServerResponse> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.hostHeader && { 'Host': this.hostHeader }),
    };

    const response = await fetch(`${this.baseUrl}${surveyConfig.paths.drafts}/${draftId}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        normalizeQuestionIds: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to publish survey: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Upload media file
   */
  async uploadMedia(file: File, draftId?: number): Promise<{ mediaId: number; fileUrl: string; fileType: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (draftId) {
      formData.append('draftId', draftId.toString());
    }

    const headers: HeadersInit = {
      ...(this.hostHeader && { 'Host': this.hostHeader }),
    };

    const response = await fetch(`${this.baseUrl}${surveyConfig.paths.mediaUpload}`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  }

  /**
   * Get current conductor information
   */
  async getCurrentConductor(): Promise<{ conductorId: number }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(authConfig.host && { 'Host': authConfig.host }),
    };

    const response = await fetch(`${authConfig.baseUrl}${authConfig.paths.conductorRegister}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load conductor information');
    }

    return response.json();
  }
}

// Singleton instance
export const surveyApi = new SurveyApiService(); 