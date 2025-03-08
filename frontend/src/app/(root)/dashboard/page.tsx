
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth.service';

interface UserData {
  username: string;
  email: string;
  roles: string[];
}

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
useEffect(() => {
  let mounted = true;

  const checkAuth = async () => {
    try {
      // Get current token
      const token = authService.getAccessToken();
      
      if (!token && mounted) {
        router.replace('/login');
        return;
      }

      const isAuthed = await authService.isAuthenticated();
      
      if (!mounted) return;

      if (!isAuthed) {
        // Try refresh before redirecting
        try {
          await authService.refreshToken();
          // Check if refresh was successful
          const newToken = authService.getAccessToken();
          if (!newToken) {
            router.replace('/login');
          }
        } catch {
          router.replace('/login');
        }
        return;
      }

      const currentUser = authService.getCurrentUser();
      if (currentUser && mounted) {
        setUserData(currentUser);
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      if (mounted) {
        router.replace('/login');
      }
    }
  };

  checkAuth();

  return () => {
    mounted = false;
  };
}, [router]);
  const handleLogout = async () => {
    try {
      await authService.logout();
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!userData) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Welcome, {userData.username}!</CardTitle>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="mt-1">{userData.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Roles</p>
                  <div className="mt-1 flex gap-2">
                    {userData.roles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}