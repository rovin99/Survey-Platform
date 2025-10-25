// src/components/AuthGuard.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// This component already has "use client" directive and can be used directly in layouts
// No need for a separate ClientAuthGuard wrapper component
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user, refreshUser } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [lastAuthCheck, setLastAuthCheck] = useState<number>(Date.now());

  // Initial authentication check
  useEffect(() => {
    // Only proceed when loading is complete
    if (!loading) {
      if (!isAuthenticated) {
        // If not authenticated, redirect to login
        router.push("/login");
      }
      // Authentication check is complete
      setIsChecking(false);
      setLastAuthCheck(Date.now());
    }
  }, [isAuthenticated, loading, router]);

  // Periodic re-authentication check while user is active
  useEffect(() => {
    if (!isAuthenticated) return;

    // Check session validity every 5 minutes
    const checkInterval = setInterval(async () => {
      try {
        await refreshUser();
        setLastAuthCheck(Date.now());
      } catch (error) {
        console.error("Session validation error:", error);
        // Will be handled by the auth context refresh mechanism
      }
    }, 5 * 60 * 1000);

    // Set up activity listeners to detect user activity
    const resetTimer = () => {
      setLastAuthCheck(Date.now());
    };

    // Listen for user activity
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keypress", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keypress", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
    };
  }, [isAuthenticated, refreshUser]);

  // Show loading state while checking auth
  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // If not authenticated, don't render children
  if (!isAuthenticated || !user) {
    return null;
  }

  return <>{children}</>;
}