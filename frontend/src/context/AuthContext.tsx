// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';

interface AuthContextType {
  user: UserResponse | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ csrfToken?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface UserResponse {
  userId: number;
  username: string;
  email: string;
  roles: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const isAuthed = await authService.isAuthenticated();
        if (isAuthed) {
          await refreshUser();
        } else {
          // If not authenticated, ensure user state is cleared
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Setup token refresh mechanism
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
  
    if (isAuthenticated) {
      // Refresh every 14 minutes (assuming token lasts 15 minutes)
      // This gives a 1-minute buffer before the token expires
      refreshInterval = setInterval(async () => {
        try {
          const response = await authService.refreshToken();
          
          // If the refresh returns a CSRF token, update it in the API service
          if (response && typeof response === 'object' && 'data' in response) {
            const csrfToken = response.data;
            if (typeof csrfToken === 'string') {
              apiService.setCSRFToken(csrfToken);
            }
          }
          
          await refreshUser();
        } catch (error) {
          console.error('Token refresh failed:', error);
          // If refresh fails, log the user out
          logout();
        }
      }, 14 * 60 * 1000); 
    }
  
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isAuthenticated]);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const response = await authService.login({ username, password });
      
      // Refresh user data after login
      await refreshUser();
      
      // Return the CSRF token if available in the response
      const csrfToken = response.data.csrfToken || response.data.CsrfToken;
      if (csrfToken && typeof csrfToken === 'string') {
        apiService.setCSRFToken(csrfToken);
      }
      
      // Don't redirect here - let the login page handle role-based redirects
      console.log("Login successful, user data updated");
      
      return { csrfToken };
    } catch (err) {
      setError('Invalid credentials');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setError('Logout failed');
      // Even if server logout fails, clear local state
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}