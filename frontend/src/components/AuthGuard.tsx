// src/components/AuthGuard.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// This component already has "use client" directive and can be used directly in layouts
// No need for a separate ClientAuthGuard wrapper component
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only proceed when loading is complete
    if (!loading) {
      if (!isAuthenticated) {
        // If not authenticated, redirect to login
        router.push("/login");
      }
      // Authentication check is complete
      setIsChecking(false);
    }
  }, [isAuthenticated, loading, router]);

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