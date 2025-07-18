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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const { login, loading: authLoading, error: authError, isAuthenticated, user } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

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