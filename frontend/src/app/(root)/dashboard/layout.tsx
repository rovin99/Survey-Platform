// app/dashboard/layout.tsx
import { AuthGuard } from "@/components/AuthGuard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Your App",
  description: "Your personal dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}