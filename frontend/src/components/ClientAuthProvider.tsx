"use client";

import { AuthProvider } from "@/context/AuthContext";

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
} 