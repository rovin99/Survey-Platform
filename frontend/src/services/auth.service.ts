
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
  token: string;
}

interface UserResponse {
  userId: number;
  username: string;
  email: string;
  roles: string[];
}

const API_URL = "http://localhost:8080/api/auth";

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
  private accessToken: string | null = null;
  private currentUser: UserResponse | null = null;

  constructor() {
    // Initialize from secure HTTP-only cookie only
    // Token handling is now managed server-side
  }

  private setAccessToken(token: string) {
    this.accessToken = token;
    // Set auth cookie server-side instead of managing in localStorage
  }

  getAccessToken(): string | null {
    return this.accessToken;
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
        result.message || 'Login failed',
        'AUTH_ERROR',
        null,
        result.statusCode
      );
    }
  
    if (result.data.token) {
      this.setAccessToken(result.data.token);
      // Parse JWT only for immediate use, don't store in localStorage
      const userData = this.parseJwt(result.data.token);
      if (userData) {
        this.currentUser = {
          userId: userData.sub,
          email: userData.email,
          username: userData.username,
          roles: [userData['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']],
        };
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
          'Authorization': `Bearer ${this.accessToken}`
        },
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
    return this.currentUser;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.accessToken = null;
      this.currentUser = null;
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

  async updateProfile(data: Partial<UserResponse>): Promise<ApiResponse<UserResponse>> {
    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
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
      this.currentUser = result.data;
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