"use client";

import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ConductorLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<AuthGuard>
			<ConductorRoleGuard>
				<main>
					<Navbar userType="Conductor" />
					{children}
					<Toaster />
				</main>
			</ConductorRoleGuard>
		</AuthGuard>
	);
}

// Component to ensure only users with "Conducting" role can access conductor pages
function ConductorRoleGuard({ children }: { children: React.ReactNode }) {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && user) {
			const hasConductingRole = user.roles?.includes("Conducting");
			if (!hasConductingRole) {
				// Redirect users without Conducting role to role selection
				router.push("/role-selection");
				return;
			}
		}
	}, [user, loading, router]);

	// Show loading while checking role
	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<p>Loading...</p>
			</div>
		);
	}

	// Don't render if user doesn't have Conducting role
	if (!user?.roles?.includes("Conducting")) {
		return null;
	}

	return <>{children}</>;
}
