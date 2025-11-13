"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth.service";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser, isAuthenticated, user } = useAuth();
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    
    // Handle success redirect from backend GET endpoint
    if (status === 'success' && userId) {
      setStatus('success');
      setMessage("Successfully signed in! Checking authentication...");
      
      // Check if user is authenticated and update context
      const checkAuth = async () => {
        try {
          // Try to get user data from verify endpoint (this also validates cookies)
          const verifyUrl = `${process.env.NEXT_PUBLIC_AUTH_API_URL}/verify`;
          console.log('Calling verify endpoint:', verifyUrl);
          
          const response = await fetch(verifyUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            credentials: 'include',
          });
          
          console.log('Verify response status:', response.status);
          console.log('Verify response headers:', Object.fromEntries(response.headers.entries()));
          
          if (response.ok) {
            const result = await response.json();
            console.log('Verify response body:', result);
            if (result.success && result.data?.user) {
              // Authenticate user in the context using dummy login call
              // This will trigger the AuthContext to update properly
              console.log('User data found, logging in:', result.data.user);
              await  refreshUser();
              setMessage("Successfully signed in! Redirecting...");
            } else {
              console.log('No user data in response:', result);
              setStatus('error');
              setMessage("Authentication failed. Please try again.");
            }
          } else {
            const errorText = await response.text();
            console.log('Verify request failed with status:', response.status, 'Response:', errorText);
            setStatus('error');
            setMessage("Authentication failed. Please try again.");
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          setStatus('error');
          setMessage("Authentication failed. Please try again.");
        }
      };
      
      checkAuth();
      return;
    }
    
    // Handle token-based verification (POST method)
    if (!token) {
      setStatus('error');
      setMessage("Invalid magic link. No token provided.");
      return;
    }

    verifyMagicLink(token);
  }, [searchParams]);

  // Handle redirect after successful authentication
  useEffect(() => {
    if (isAuthenticated && user && status === 'success') {
      setIsRedirecting(true);
      
      // Check if user has only "User" role (needs role selection)
      const hasOnlyUserRole = user.roles.length === 1 && user.roles.includes("User");
      
      if (hasOnlyUserRole) {
        router.push("/role-selection");
      } else if (user.roles.length > 1 || !user.roles.includes("User")) {
        router.push("/dashboard");
      } else {
        router.push("/role-selection");
      }
    }
  }, [isAuthenticated, user, status, router]);

  const verifyMagicLink = async (token: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/verify-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setStatus('success');
        setMessage("Successfully signed in! Redirecting...");
        
        // Update auth context with user data
        if (result.data.user) {
          await refreshUser();
        }
      } else {
        setStatus('error');
        setMessage(result.error?.message || "Magic link verification failed.");
      }
    } catch (error) {
      console.error('Magic link verification error:', error);
      setStatus('error');
      setMessage("Failed to verify magic link. Please try again.");
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-600" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-red-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'verifying':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Magic Link Verification</CardTitle>
          <CardDescription>
            Verifying your magic link...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {getStatusIcon()}
            </div>
            
            <div>
              <h3 className={`text-lg font-medium ${getStatusColor()}`}>
                {status === 'verifying' && 'Verifying your link...'}
                {status === 'success' && (isRedirecting ? 'Redirecting...' : 'Success!')}
                {status === 'error' && 'Verification Failed'}
              </h3>
              
              <p className="text-sm text-gray-600 mt-2">
                {message}
              </p>
            </div>

            {status === 'error' && (
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href="/login">Back to Login</Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/register">Create Account</Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Magic Link Verification</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              </div>
              <p className="text-sm text-gray-600">
                Preparing verification...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <MagicLinkContent />
    </Suspense>
  );
}