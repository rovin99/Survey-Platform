// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';
import { useRouter } from 'next/navigation';
import { authConfig } from '@/lib/api-config';

const API_URL = authConfig.baseUrl;

interface AuthContextType {
  user: UserResponse | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ user?: UserResponse }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface UserResponse {
  userId: number;
  username: string;
  email?: string;  // Optional - only available from server, not localStorage cache
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
      // Try server-side verify
      const response = await fetch(`${API_URL}${authConfig.paths.verify}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.success && result?.data?.user) {
          setUser(result.data.user);
          setIsAuthenticated(true);
          return;
        }
      }

      // Fallback to cached user
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        return;
      }

      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const isAuthed = await authService.isAuthenticated();
        if (isAuthed) {
          await refreshUser();
        } else {
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

  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (isAuthenticated) {
      refreshInterval = setInterval(async () => {
        try {
          await authService.refreshToken();
          // CSRF token is automatically updated via cookie by backend
          await refreshUser();
        } catch (error) {
          console.error('Token refresh failed:', error);
          logout();
        }
      }, 55 * 60 * 1000); // Refresh 5 minutes before 1-hour token expires
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [isAuthenticated]);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const response = await authService.login({ username, password });

      // Extract user data from response for immediate use
      const userData = response.data.user;

      // Update state
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
      }

      // CSRF token is automatically set via cookie by backend
      // Return user for immediate redirect use
      return { user: userData };
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
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, isAuthenticated, login, logout, refreshUser }}>
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
