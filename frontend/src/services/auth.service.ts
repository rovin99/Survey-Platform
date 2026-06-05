// src/services/auth.service.ts
import { authConfig } from '@/lib/api-config';

interface ApiResponse<T> {
  message: string;
  data: T;
  error: {
    message: string;
    code: string;
    details: unknown;
  } | null;
  statusCode: number;
  success: boolean;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  roleName?: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface ConductorRegistrationRequest {
  name: string;
  conductorType: number;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}

interface ParticipantRegistrationRequest {
  name: string;
  phoneNumber?: string;
  skills?: Array<{
    skillName: string;
    proficiencyLevel: number;
  }>;
}

// Custom field entry for participant profiles
export interface CustomField {
  name: string;
  value: string;
}

// Participant profile data returned from the API
export interface ParticipantProfile {
  participantId: number;
  userId: number;
  name?: string;
  email?: string;
  rollNo?: string;
  phoneNumber?: string;
  experienceLevel?: number;
  rating?: number;
  isActive?: boolean;
  customFields?: CustomField[];
}

interface AuthResponse {
  token: string;
  csrfToken?: string;
  CsrfToken?: string;
}

interface LoginResponse {
  user: UserResponse;
  csrfToken?: string;
  CsrfToken?: string;
}

interface UserResponse {
  userId: number;
  username: string;
  email?: string;  // Optional - not stored in localStorage cache for privacy
  roles: string[];
  csrfToken?: string;
}

const API_URL = authConfig.baseUrl;

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public details: unknown,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

class AuthService {
  getAccessToken(): string | null {
    // Token is in HTTP-only cookie, not accessible via JS
    return null;
  }

  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await fetch(`${API_URL}${authConfig.paths.register}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result: ApiResponse<AuthResponse> = await response.json();

    if (!result.success) {
      throw new AuthError(
        result.error?.message || 'Registration failed',
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.details,
        result.statusCode
      );
    }

    return result;
  }

  async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await fetch(`${API_URL}${authConfig.paths.login}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result: ApiResponse<LoginResponse> = await response.json();

    if (!result.success) {
      throw new AuthError(
        result.error?.message || 'Login failed',
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.details,
        result.statusCode
      );
    }

    // Cache minimal user data locally for UI fallback (no PII)
    // Full user data comes from server verification
    if (result.data.user && typeof window !== 'undefined') {
      localStorage.setItem('user_data', JSON.stringify({
        userId: result.data.user.userId,
        username: result.data.user.username,
        roles: result.data.user.roles || []
      }));
    }

    return result;
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}${authConfig.paths.verify}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        try {
          await this.refreshToken();
          return true;
        } catch {
          this.logout();
          return false;
        }
      }

      const result: ApiResponse<null> = await response.json();
      return result.success;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  getCurrentUser(): UserResponse | null {
    if (typeof window === 'undefined') return null;

    const userData = localStorage.getItem('user_data');
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_URL}${authConfig.paths.logout}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user_data');
      }
    }
  }

  async refreshToken(): Promise<ApiResponse<string>> {
    const response = await fetch(`${API_URL}${authConfig.paths.refreshToken}`, {
      method: 'POST',
      credentials: 'include',
    });

    const result: ApiResponse<string> = await response.json();

    if (!result.success) {
      throw new AuthError(
        result.error?.message || 'Token refresh failed',
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.details,
        result.statusCode
      );
    }

    return result;
  }

  // NOTE: forgotPassword, resetPassword, verifyEmail, changePassword removed - no backend implementation

  async updateProfile(data: Partial<UserResponse>): Promise<ApiResponse<UserResponse>> {
    const response = await fetch(`${API_URL}${authConfig.paths.profile}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result: ApiResponse<UserResponse> = await response.json();

    if (!result.success) {
      throw new AuthError(
        result.error?.message || 'Update profile failed',
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.details,
        result.statusCode
      );
    }

    // Cache minimal user data (no PII)
    if (result.data && typeof window !== 'undefined') {
      localStorage.setItem('user_data', JSON.stringify({
        userId: result.data.userId,
        username: result.data.username,
        roles: result.data.roles || []
      }));
    }

    return result;
  }

  async registerConductor(data: ConductorRegistrationRequest): Promise<ApiResponse<null>> {
    const response = await fetch(`${API_URL}${authConfig.paths.conductorRegister}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result: ApiResponse<null> = await response.json();

    if (!result.success) {
      throw new AuthError(
        result.error?.message || 'Conductor registration failed',
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.details,
        result.statusCode
      );
    }

    return result;
  }

  async registerParticipant(data: ParticipantRegistrationRequest): Promise<ApiResponse<null>> {
    const response = await fetch(`${API_URL}${authConfig.paths.participantRegister}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result: ApiResponse<null> = await response.json();

    if (!result.success) {
      throw new AuthError(
        result.error?.message || 'Participant registration failed',
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.details,
        result.statusCode
      );
    }

    return result;
  }

  async deleteConductorRegistration(): Promise<ApiResponse<null>> {
    const response = await fetch(`${API_URL}${authConfig.paths.conductorDelete}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    const result: ApiResponse<null> = await response.json();

    if (!result.success) {
      throw new AuthError(
        result.error?.message || 'Delete conductor registration failed',
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.details,
        result.statusCode
      );
    }

    return result;
  }

  async requestMagicLink(email: string, returnUrl?: string): Promise<ApiResponse<string>> {
    const body: { email: string; returnUrl?: string } = { email };
    if (returnUrl) body.returnUrl = returnUrl;

    const response = await fetch(`${API_URL}${authConfig.paths.magicLink}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const result: ApiResponse<string> = await response.json();

    if (!result.success) {
      throw new AuthError(
        result.error?.message || 'Magic link request failed',
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.details,
        result.statusCode
      );
    }

    return result;
  }

  /**
   * Fetch the current user's participant profile
   * Returns profile data that can be used to auto-fill survey forms
   */
  async getParticipantProfile(): Promise<ParticipantProfile | null> {
    try {
      const response = await fetch(`${API_URL}${authConfig.paths.participantProfile}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        // Profile not found or not a participant - not an error
        return null;
      }

      const result: ApiResponse<ParticipantProfile> = await response.json();

      if (!result.success || !result.data) {
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('Failed to fetch participant profile:', error);
      return null;
    }
  }

  /**
   * Update the current user's participant profile
   * @param data Profile fields to update (name, rollNo, phoneNumber, customFields)
   */
  async updateParticipantProfile(data: {
    name?: string;
    rollNo?: string;
    phoneNumber?: string;
    customFields?: CustomField[];
  }): Promise<ParticipantProfile | null> {
    try {
      const response = await fetch(`${API_URL}${authConfig.paths.participantProfile}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      const result: ApiResponse<ParticipantProfile> = await response.json();

      if (!result.success) {
        throw new AuthError(
          result.error?.message || 'Profile update failed',
          result.error?.code || 'UNKNOWN_ERROR',
          result.error?.details,
          result.statusCode
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      console.error('Failed to update participant profile:', error);
      return null;
    }
  }
}

export const authService = new AuthService();
