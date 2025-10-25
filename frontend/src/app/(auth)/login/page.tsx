// src/app/login/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { apiService } from "@/services/api.service";
import { authService } from "@/services/auth.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Mail, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const { login, loading: authLoading, error: authError, isAuthenticated, user } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  
  const [magicLinkData, setMagicLinkData] = useState({
    email: "",
  });
  
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      handlePostLoginRedirect();
    }
  }, [isAuthenticated, user]);

  const handlePostLoginRedirect = async () => {
    if (!user) return;

    try {
      // Check if user has only "User" role (needs role selection)
      const hasOnlyUserRole = user.roles.length === 1 && user.roles.includes("User");
      
      if (hasOnlyUserRole) {
        console.log("User has only 'User' role, redirecting to role selection");
        router.push("/role-selection");
        return;
      }

      // Check if user has other roles - if so, go to dashboard
      if (user.roles.length > 1 || !user.roles.includes("User")) {
        console.log("User has additional roles, redirecting to dashboard");
        router.push("/dashboard");
        return;
      }

      // Fallback - redirect to role selection
      console.log("Fallback: redirecting to role selection");
      router.push("/role-selection");
      
    } catch (error) {
      console.error('Error in post-login redirect:', error);
      // Fallback to role selection if there's an error
      router.push("/role-selection");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Call the login method from auth context
      const response = await login(formData.username, formData.password);
      
      // If login returns a CSRF token, set it in the API service
      if (response?.csrfToken) {
        apiService.setCSRFToken(response.csrfToken);
      }

      // The redirect will be handled by the useEffect above
      // after the auth context updates the user state
    } catch (err: any) {
      setError(err.message || "Invalid username or password");
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMagicLinkLoading(true);

    try {
      await authService.requestMagicLink(magicLinkData.email);
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleMagicLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMagicLinkData({
      email: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Password
              </TabsTrigger>
              <TabsTrigger value="magic-link" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Magic Link
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="password">
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  {(error || authError) && (
                    <div className="text-red-500 text-sm">{error || authError}</div>
                  )}
                  <Button className="w-full" type="submit" disabled={authLoading}>
                    {authLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="magic-link">
              {magicLinkSent ? (
                <div className="text-center space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center justify-center mb-2">
                      <Mail className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium text-green-800">Check your email!</h3>
                    <p className="text-sm text-green-700 mt-2">
                      We've sent a magic link to <strong>{magicLinkData.email}</strong>
                    </p>
                    <p className="text-xs text-green-600 mt-2">
                      Click the link in your email to sign in. The link will expire in 15 minutes.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setMagicLinkSent(false)}
                    className="w-full"
                  >
                    Send another link
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleMagicLinkSubmit}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email address"
                        value={magicLinkData.email}
                        onChange={handleMagicLinkChange}
                        required
                      />
                      <p className="text-xs text-gray-500">
                        We'll send you a secure link to sign in without a password.
                      </p>
                    </div>
                    {error && (
                      <div className="text-red-500 text-sm">{error}</div>
                    )}
                    <Button className="w-full" type="submit" disabled={magicLinkLoading}>
                      {magicLinkLoading ? "Sending..." : "Send Magic Link"}
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 text-center text-sm">
            Don't have an account?{" "}
            <Link href="/register" className="text-blue-500 hover:underline">
              Register
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}