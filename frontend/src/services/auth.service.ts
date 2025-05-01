// src/services/auth.service.ts

interface ApiResponse<T> {
	message: string;
	data: T;
	error: {
	  message: string;
	  code: string;
	  details: any;
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
  
  interface AuthResponse {
	// user: UserResponse;
	// accessToken: string;
	token: string;
  csrfToken?: string;
  CsrfToken?: string; // Support both casing conventions
  }
  
  interface UserResponse {
	userId: number;
	username: string;
	email: string;
	roles: string[];
  csrfToken?: string; // For login/register responses
  }
  
  const API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || "http://localhost:5171/api/auth";
  
  export class AuthError extends Error {
	constructor(
	  message: string,
	  public code: string,
	  public details: any,
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
	private setAccessToken(token: string) {
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
	  const response = await fetch(`${API_URL}/register`, {
		method: 'POST',
		headers: {
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
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
  
	  // Don't store token in localStorage anymore
	  // Token will be in HTTP-only cookies set by the server
	  return result;
	}
  
	
	async login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
	  const response = await fetch(`${API_URL}/login`, {
		method: 'POST',
		headers: {
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
		credentials: 'include', // Important for cookies
		body: JSON.stringify(data),
	  });
	
	  const result: ApiResponse<AuthResponse> = await response.json();
	
	  if (!result.success) {
		throw new AuthError(
		  result.error?.message || 'Login failed',
		  result.error?.code || 'UNKNOWN_ERROR',
		  result.error?.details,
		  result.statusCode
		);
	  }
	
	  // We need the parsed user data for the client-side context
	  if (result.data.token) {
		const userData = this.parseJwt(result.data.token);
		
		// Store user data in localStorage for client access
		// but not the token itself (which is in HTTP-only cookies)
		if (typeof window !== 'undefined') {
		  localStorage.setItem('user_data', JSON.stringify({
			userId: userData.sub,
			email: userData.email,
			roles: [userData['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']],
		  }));
		}
	  }
	
	  return result;
	}
	
	private parseJwt(token: string) {
	  try {
		return JSON.parse(atob(token.split('.')[1]));
	  } catch (e) {
		return null;
	  }
	}

	async isAuthenticated(): Promise<boolean> {
	  try {
		const response = await fetch(`${API_URL}/verify`, {
		  method: 'GET',
		  headers: {
			'Accept': 'application/json',
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
		await fetch(`${API_URL}/logout`, {
		  method: 'POST',
		  credentials: 'include',
		  headers: {
			'Accept': 'application/json',
		  },
		});
	  } catch (error) {
		console.error('Logout error:', error);
	  } finally {
		// Only clear local user data, not token (handled by server)
		if (typeof window !== 'undefined') {
		  localStorage.removeItem('user_data');
		}
	  }
	}
  
	async refreshToken(): Promise<ApiResponse<string>> {
	  const response = await fetch(`${API_URL}/refresh-token`, {
		method: 'POST',
		credentials: 'include',
		headers: {
		  'Accept': 'application/json',
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
	
	  // No need to store token anymore as it's in HTTP-only cookies
	  return result;
	}
  
	async forgotPassword(email: string): Promise<ApiResponse<null>> {
	  const response = await fetch(`${API_URL}/forgot-password`, {
		method: 'POST',
		headers: {
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
	  const response = await fetch(`${API_URL}/reset-password`, {
		method: 'POST',
		headers: {
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
	  const response = await fetch(`${API_URL}/verify-email`, {
		method: 'POST',
		headers: {
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
	  const response = await fetch(`${API_URL}/change-password`, {
		method: 'POST',
		headers: {
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		  'Authorization': `Bearer ${this.getAccessToken()}`
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
	  const response = await fetch(`${API_URL}/profile`, {
		method: 'PUT',
		headers: {
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		  'Authorization': `Bearer ${this.getAccessToken()}`
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
		localStorage.setItem('user_data', JSON.stringify(result.data));
	  }
  
	  return result;
	}
	
  }
  
  
  
  export const authService = new AuthService();
  
  // Axios interceptor for handling token refresh
  import axios from 'axios';
  
  let isRefreshing = false;
  let failedQueue: any[] = [];
  
  const processQueue = (error: Error | null, token: string | null = null) => {
	failedQueue.forEach(prom => {
	  if (error) {
		prom.reject(error);
	  } else {
		prom.resolve(token);
	  }
	});
  
	failedQueue = [];
  };
  
  axios.interceptors.request.use(
	(config) => {
	  const token = authService.getAccessToken();
	  if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	  }
	  return config;
	},
	(error) => {
	  return Promise.reject(error);
	}
  );
  
  axios.interceptors.response.use(
	(response) => response,
	async (error) => {
	  const originalRequest = error.config;
  
	  if (error.response?.status === 401 && !originalRequest._retry) {
		if (isRefreshing) {
		  return new Promise((resolve, reject) => {
			failedQueue.push({ resolve, reject });
		  })
			.then(token => {
			  originalRequest.headers['Authorization'] = `Bearer ${token}`;
			  return axios(originalRequest);
			})
			.catch(err => Promise.reject(err));
		}
  
		originalRequest._retry = true;
		isRefreshing = true;
  
		try {
		  await authService.refreshToken();
		  const newToken = authService.getAccessToken();
		  processQueue(null, newToken);
		  originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
		  return axios(originalRequest);
		} catch (error) {
		  processQueue(error as Error);
		  // Redirect to login page if refresh token is invalid
		  window.location.href = '/login';
		  return Promise.reject(error);
		} finally {
		  isRefreshing = false;
		}
	  }
  
	  return Promise.reject(error);
	}
  );