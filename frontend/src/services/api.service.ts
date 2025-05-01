/**
 * This file provides a centralized API request service with CSRF protection
 */

interface ApiServiceOptions {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  cache?: RequestCache;
}

class ApiService {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private csrfToken: string | null = null;

  constructor(options: ApiServiceOptions = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.defaultHeaders || {})
    };
  }

  // Set CSRF token to be used in subsequent requests
  setCSRFToken(token: string) {
    this.csrfToken = token;
  }

  // Get CSRF token from cookies
  getCSRFTokenFromCookie(): string | null {
    if (typeof window === 'undefined') return null;
    
    const name = 'csrf-token=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    
    for (let i = 0; i < cookieArray.length; i++) {
      let cookie = cookieArray[i].trim();
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length, cookie.length);
      }
    }
    return null;
  }

  // Build request headers with CSRF token for mutations
  private buildHeaders(method: string, customHeaders?: Record<string, string>): Record<string, string> {
    const headers = { ...this.defaultHeaders, ...customHeaders };
    
    // Only add CSRF token for non-GET requests
    if (method !== 'GET') {
      // Try to get token from instance property first, then from cookie
      const csrfToken = this.csrfToken || this.getCSRFTokenFromCookie();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }
    
    return headers;
  }

  // Build URL with query parameters
  private buildUrl(endpoint: string, query?: Record<string, string>): string {
    const url = `${this.baseUrl}${endpoint}`;
    
    if (!query) return url;
    
    const queryParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  // Generic request method
  async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const headers = this.buildHeaders(method, options.headers);
    const url = this.buildUrl(endpoint, options.query);
    
    const config: RequestInit = {
      method,
      headers,
      credentials: 'include', // Always include credentials for cookies
      cache: options.cache || 'default'
    };
    
    if (data !== undefined && method !== 'GET' && method !== 'HEAD') {
      config.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, config);
    
    // Handle HTTP error responses
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      
      throw new Error(errorData.message || 'An error occurred');
    }
    
    // For 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }
    
    return await response.json() as T;
  }

  // Convenience methods for common HTTP verbs
  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }
  
  async post<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }
  
  async put<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', endpoint, data, options);
  }
  
  async patch<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, options);
  }
  
  async delete<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', endpoint, data, options);
  }
}

// Create and export a default instance
export const apiService = new ApiService();

// Export the class for custom instances
export default ApiService; 