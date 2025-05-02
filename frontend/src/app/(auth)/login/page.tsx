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
  const { login, loading: authLoading, error: authError, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Check if user is registered as conductor or participant
      const checkUserRoles = async () => {
        try {
          // You might need to implement these endpoints in your API
          const [conductorResponse, participantResponse] = await Promise.all([
            apiService.get('/api/Conductor/current'),
            apiService.get('/api/Participant/current')
          ]);
          
          // Check if user has conductor or participant role by checking API responses
          const isConductor = conductorResponse && Object.keys(conductorResponse).length > 0;
          const isParticipant = participantResponse && Object.keys(participantResponse).length > 0;
          
          // If user has no roles yet, redirect to role selection
          if (!isConductor && !isParticipant) {
            router.push("/role-selection");
          } else {
            router.push("/dashboard");
          }
        } catch (error) {
          // If API call fails, assume user needs to register roles
          router.push("/role-selection");
        }
      };
      
      checkUserRoles();
    }
  }, [isAuthenticated, router]);

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