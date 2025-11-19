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
	skills: Array<{
	  skillName: string;
	  proficiencyLevel: number;
	}>;
  }
  
  interface AuthResponse {
	// user: UserResponse;
	// accessToken: string;
	token: string;
  csrfToken?: string;
  CsrfToken?: string; // Support both casing conventions
  }

  interface LoginResponse {
	user: UserResponse;
	csrfToken?: string;
	CsrfToken?: string;
  }
  
  interface UserResponse {
	userId: number;
	username: string;
	email: string;
	roles: string[];
  csrfToken?: string; // For login/register responses
  }
  
  // Use centralized configuration
  const API_URL = authConfig.baseUrl;
  const AUTH_HOST = authConfig.host;
  
// Helper to create headers
const createHeaders = (additionalHeaders: Record<string, string> = {}): HeadersInit => {
  const headers: Record<string, string> = {
    ...additionalHeaders,
  };

  // Add Host header for Kourier routing
  if (AUTH_HOST) {
    headers['Host'] = AUTH_HOST;
  }

  return headers;
};
  
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
	constructor() {
	}
  
	// Remove localStorage token storage
	private setAccessToken(): void {
	  // Token is now stored in HTTP-only cookies by the backend
	  // No need to store it in localStorage
	}
  
	// Update to work with cookie-based authentication instead of localStorage
	getAccessToken(): string | null {
	  // We don't have direct access to HTTP-only cookies in JavaScript
	  // The token will be sent automatically with requests
	  return null;
	}
  
	async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
	  const response = await fetch(`${API_URL}${authConfig.paths.register}`, {
		method: 'POST',
		headers: createHeaders({
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		}),
		credentials: 'include', // Important for cookies
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
  
	  // Store token from response body (for Bearer authentication)
	  if (result.data?.token && typeof window !== 'undefined') {
		localStorage.setItem('authToken', result.data.token);
	  }
	  
	  return result;
	}
  
	
	async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
	  const response = await fetch(`${API_URL}${authConfig.paths.login}`, {
		method: 'POST',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
		credentials: 'include', // Important for cookies
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
	
	  // Store user data and token from the response
	  if (result.data.user && typeof window !== 'undefined') {
		const userData = {
		  userId: result.data.user.userId,
		  username: result.data.user.username,
		  email: result.data.user.email,
		  roles: result.data.user.roles || []
		};
		
		localStorage.setItem('user_data', JSON.stringify(userData));
		
		// Store token from response body (for Bearer authentication)
		if (result.data.user.token) {
		  localStorage.setItem('authToken', result.data.user.token);
		}
	  }

	  return result;
	}
	
	private parseJwt(token: string): Record<string, string> {
	  try {
		return JSON.parse(atob(token.split('.')[1]));
	  } catch {
		return {};
	  }
	}

	async isAuthenticated(): Promise<boolean> {
	  try {
		const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
		const response = await fetch(`${API_URL}${authConfig.paths.verify}`, {
		  method: 'GET',
		  headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
			'Accept': 'application/json',
			...(token && { 'Authorization': `Bearer ${token}` }), // Include Bearer token
		  },
		  credentials: 'include', // Important for cookies
		});
  
		if (!response.ok) {
		  // Try to refresh token
		  try {
			await this.refreshToken();
			return true;
		  } catch {
			this.logout(); // Clear invalid tokens
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
	  if (typeof window === 'undefined') {
		return null;
	  }
	  
	  const userData = localStorage.getItem('user_data');
	  if (!userData) {
		return null;
	  }
  
	  try {
		return JSON.parse(userData);
	  } catch {
		return null;
	  }
	}
  
	async logout(): Promise<void> {
	  try {
		const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
		await fetch(`${API_URL}${authConfig.paths.logout}`, {
		  method: 'POST',
		  credentials: 'include',
		  headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
			'Accept': 'application/json',
			...(token && { 'Authorization': `Bearer ${token}` }), // Include Bearer token
		  },
		});
	  } catch (error) {
		console.error('Logout error:', error);
	  } finally {
		// Clear all authentication data
		if (typeof window !== 'undefined') {
		  localStorage.removeItem('user_data');
		  localStorage.removeItem('authToken');
		}
	  }
	}
  
	async refreshToken(): Promise<ApiResponse<string>> {
	  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
	  const response = await fetch(`${API_URL}${authConfig.paths.refreshToken}`, {
		method: 'POST',
		credentials: 'include',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Accept': 'application/json',
		  ...(token && { 'Authorization': `Bearer ${token}` }), // Include Bearer token
		},
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
	
	  // Store new token if returned
	  if (result.data && typeof window !== 'undefined') {
		localStorage.setItem('authToken', result.data);
	  }
	  
	  return result;
	}
  
	async forgotPassword(email: string): Promise<ApiResponse<null>> {
	  const response = await fetch(`${API_URL}${authConfig.paths.forgotPassword}`, {
		method: 'POST',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
		credentials: 'include',
		body: JSON.stringify({ email }),
	  });
  
	  const result: ApiResponse<null> = await response.json();
  
	  if (!result.success) {
		throw new AuthError(
		  result.error?.message || 'Forgot password failed',
		  result.error?.code || 'UNKNOWN_ERROR',
		  result.error?.details,
		  result.statusCode
		);
	  }
  
	  return result;
	}
  
	async resetPassword(token: string, password: string): Promise<ApiResponse<null>> {
	  const response = await fetch(`${API_URL}${authConfig.paths.resetPassword}`, {
		method: 'POST',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
		credentials: 'include',
		body: JSON.stringify({ token, password }),
	  });
  
	  const result: ApiResponse<null> = await response.json();
  
	  if (!result.success) {
		throw new AuthError(
		  result.error?.message || 'Reset password failed',
		  result.error?.code || 'UNKNOWN_ERROR',
		  result.error?.details,
		  result.statusCode
		);
	  }
  
	  return result;
	}
  
	async verifyEmail(token: string): Promise<ApiResponse<null>> {
	  const response = await fetch(`${API_URL}${authConfig.paths.verifyEmail}`, {
		method: 'POST',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
		credentials: 'include',
		body: JSON.stringify({ token }),
	  });
  
	  const result: ApiResponse<null> = await response.json();
  
	  if (!result.success) {
		throw new AuthError(
		  result.error?.message || 'Email verification failed',
		  result.error?.code || 'UNKNOWN_ERROR',
		  result.error?.details,
		  result.statusCode
		);
	  }
  
	  return result;
	}
  
	async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<null>> {
	  const response = await fetch(`${API_URL}${authConfig.paths.changePassword}`, {
		method: 'POST',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
		credentials: 'include',
		body: JSON.stringify({ oldPassword, newPassword }),
	  });

	  const result: ApiResponse<null> = await response.json();

	  if (!result.success) {
		throw new AuthError(
		  result.error?.message || 'Change password failed',
		  result.error?.code || 'UNKNOWN_ERROR',
		  result.error?.details,
		  result.statusCode
		);
	  }

	  return result;
	}

	async updateProfile(data: Partial<UserResponse>): Promise<ApiResponse<UserResponse>> {
	  const response = await fetch(`${API_URL}${authConfig.paths.profile}`, {
		method: 'PUT',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
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

	  if (result.data) {
		if (typeof window !== 'undefined') {
		  localStorage.setItem('user_data', JSON.stringify(result.data));
		}
	  }

	  return result;
	}

	async registerConductor(data: ConductorRegistrationRequest): Promise<ApiResponse<null>> {
	  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
	  const response = await fetch(`${API_URL}${authConfig.paths.conductorRegister}`, {
		method: 'POST',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		  ...(token && { 'Authorization': `Bearer ${token}` }), // Include Bearer token
		},
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
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
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
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
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

	// Magic Link Authentication
	async requestMagicLink(email: string, returnUrl?: string): Promise<ApiResponse<string>> {
	  const body: { email: string; returnUrl?: string } = { email };
	  if (returnUrl) {
		body.returnUrl = returnUrl;
	  }

	  const response = await fetch(`${API_URL}${authConfig.paths.magicLink}`, {
		method: 'POST',
		headers: {
          ...(AUTH_HOST && { 'Host': AUTH_HOST }),
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
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
	
  }
  
  
  
  export const authService = new AuthService();
  
  // Note: The axios interceptor is not needed for cookie-based authentication
  // as cookies are automatically sent with requests
  // Remove or comment out the axios interceptor code if it's not used elsewhere