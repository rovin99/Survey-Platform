import axios from 'axios';
import { authConfig, participantsConfig } from '@/lib/api-config';

// Use AuthService proxy for authenticated requests
const AUTH_BASE_URL = authConfig.baseUrl;
const PARTICIPANTS_BASE_URL = participantsConfig.baseUrl;

// Types
export interface SharingSettings {
  id: number;
  surveyId: number;
  accessType: 'PUBLIC' | 'ORGANIZATION';
  shareToken: string;
  shareUrl: string;
  isActive: boolean;
  allowedDomains: string[];
  createdAt: string;
}

export interface EnableSharingRequest {
  accessType: 'PUBLIC' | 'ORGANIZATION';
  allowedDomains?: string[];
}

export interface UpdateSharingRequest {
  accessType: 'PUBLIC' | 'ORGANIZATION';
  allowedDomains?: string[];
  isActive: boolean;
}

export interface AccessLog {
  id: number;
  surveyId: number;
  participantId?: number;
  userEmail: string;
  accessGranted: boolean;
  denialReason?: string;
  ipAddress?: string;
  userAgent?: string;
  accessedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ValidationResponse {
  surveyId: number;
  title: string;
}

export const surveySharingService = {
  /**
   * Enable sharing for a survey
   */
  async enableSharing(
    surveyId: number,
    request: EnableSharingRequest
  ): Promise<SharingSettings> {
    const response = await axios.post<ApiResponse<SharingSettings>>(
      `${AUTH_BASE_URL}/api/SurveyProxy/surveys/${surveyId}/sharing/enable`,
      request,
      {
        withCredentials: true,
      }
    );
    return response.data.data;
  },

  /**
   * Update sharing settings
   */
  async updateSharing(
    surveyId: number,
    request: UpdateSharingRequest
  ): Promise<SharingSettings> {
    const response = await axios.put<ApiResponse<SharingSettings>>(
      `${AUTH_BASE_URL}/api/SurveyProxy/surveys/${surveyId}/sharing`,
      request,
      {
        withCredentials: true,
      }
    );
    return response.data.data;
  },

  /**
   * Disable sharing for a survey
   */
  async disableSharing(surveyId: number): Promise<void> {
    await axios.delete(
      `${AUTH_BASE_URL}/api/SurveyProxy/surveys/${surveyId}/sharing`,
      {
        withCredentials: true,
      }
    );
  },

  /**
   * Get sharing info for a survey
   */
  async getSharingInfo(surveyId: number): Promise<SharingSettings | null> {
    try {
      const response = await axios.get<ApiResponse<SharingSettings>>(
        `${AUTH_BASE_URL}/api/SurveyProxy/surveys/${surveyId}/sharing`,
        {
          withCredentials: true,
        }
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Validate access to a survey via share token (anonymous - no auth required)
   */
  async validateAccess(shareToken: string): Promise<ValidationResponse> {
    const response = await axios.post<ApiResponse<ValidationResponse>>(
      `${AUTH_BASE_URL}/api/SurveyProxy/surveys/public/validate-access?token=${shareToken}`,
      {},
      {
        withCredentials: false, // Anonymous access - no credentials needed
      }
    );
    return response.data.data;
  },

  /**
   * Get access logs for a survey
   */
  async getAccessLogs(
    surveyId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<AccessLog[]> {
    const response = await axios.get<ApiResponse<AccessLog[]>>(
      `${AUTH_BASE_URL}/api/SurveyProxy/surveys/${surveyId}/sharing/logs?limit=${limit}&offset=${offset}`,
      {
        withCredentials: true,
      }
    );
    return response.data.data;
  },

  /**
   * Start a session via share link (anonymous - no auth required)
   */
  async startSessionViaShareLink(shareToken: string): Promise<any> {
    const response = await axios.post(
      `${PARTICIPANTS_BASE_URL}/api/participant/surveys/public/start?token=${shareToken}`,
      {},
      {
        withCredentials: false, // Anonymous access - no credentials needed
      }
    );
    return response.data;
  },
};
