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
  }
  
  interface UserResponse {
	userId: number;
	username: string;
	email: string;
	roles: string[];
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
  
	private setAccessToken(token: string) {
		if (typeof window !== 'undefined') {
			localStorage.setItem('access_token', token);
		}
	}
  
	getAccessToken(): string | null {
	  if (typeof window !== 'undefined') {
		return localStorage.getItem('access_token');
	  }
	  return null;
	}
  
	async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
	  const response = await fetch(`${API_URL}/register`, {
		method: 'POST',
		headers: {
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
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
  
	  this.setAccessToken(result.data.token);
	  // localStorage.setItem('user_data', JSON.stringify(result.data.user));
	  return result;
	}
  
	
	async login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
	  const response = await fetch(`${API_URL}/login`, {
		method: 'POST',
		headers: {
		  'Content-Type': 'application/json',
		  'Accept': 'application/json',
		},
		credentials: 'include',
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
	
	  // Store the token
	  if (result.data.token) {
		this.setAccessToken(result.data.token);
		
		if (typeof window !== 'undefined') {
		  // Parse the JWT to get user data
		  const userData = this.parseJwt(result.data.token);
		  localStorage.setItem('user_data', JSON.stringify({
			userId: userData.sub,
			email: userData.email,
			roles: [userData['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']],
		  }));
		  
		  // Set auth cookie
		  document.cookie = `auth_token=${result.data.token}; path=/; max-age=86400; samesite=strict`;
		}
	  }
	
	  return result;
	}
	
	// Add this helper method to parse JWT
	private parseJwt(token: string) {
	  try {
		return JSON.parse(atob(token.split('.')[1]));
	  } catch (e) {
		return null;
	  }
	}
	async isAuthenticated(): Promise<boolean> {
	  try {
		const token = this.getAccessToken();
		if (!token) {
		  return false;
		}
  
		const response = await fetch(`${API_URL}/verify`, {
		  method: 'GET',
		  headers: {
			'Accept': 'application/json',
			'Authorization': `Bearer ${token}`
		  },
		  credentials: 'include',
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
			'Authorization': `Bearer ${this.getAccessToken()}`
		  },
		});
	  } catch (error) {
		console.error('Logout error:', error);
	  } finally {
		// Always clear local storage and cookies
		if (typeof window !== 'undefined') {
		  localStorage.removeItem('access_token');
		  localStorage.removeItem('user_data');
		  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
		}
	  }
	}
  
	async refreshToken(): Promise<void> {
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
  
	  this.setAccessToken(result.data);
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