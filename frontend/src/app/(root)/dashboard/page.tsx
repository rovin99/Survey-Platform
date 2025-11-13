"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ConductorDashboard from "@/components/dashboards/ConductorDashboard";
import ParticipantDashboard from "@/components/dashboards/ParticipantDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Briefcase } from "lucide-react";

export default function DashboardPage() {
	const { user, loading } = useAuth();
	const router = useRouter();
	const [activeRole, setActiveRole] = useState<"conductor" | "participant">("conductor");

	const hasConductingRole = user?.roles?.includes("Conducting");
	const hasParticipatingRole = user?.roles?.includes("Participating");
	const hasBothRoles = hasConductingRole && hasParticipatingRole;

	useEffect(() => {
		if (!loading && user) {
			// Redirect to role selection if no specific roles
			if (!hasConductingRole && !hasParticipatingRole) {
				router.push("/role-selection");
				return;
			}

			// Set default active role
			if (hasConductingRole && !hasParticipatingRole) {
				setActiveRole("conductor");
			} else if (hasParticipatingRole && !hasConductingRole) {
				setActiveRole("participant");
			}
		}
	}, [user, loading, router, hasConductingRole, hasParticipatingRole]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	if (!user) {
		router.push("/login");
		return null;
	}

	// Role Toggle Component (only shown if user has both roles)
	const RoleToggle = () => {
		if (!hasBothRoles) return null;

		return (
			<div className="fixed top-20 right-4 z-50">
				<Card className="shadow-lg">
					<CardContent className="p-2">
						<div className="flex gap-1">
							<Button
								variant={activeRole === "conductor" ? "default" : "outline"}
								size="sm"
								onClick={() => setActiveRole("conductor")}
								className="gap-2"
							>
								<Briefcase className="h-4 w-4" />
								Conductor
							</Button>
							<Button
								variant={activeRole === "participant" ? "default" : "outline"}
								size="sm"
								onClick={() => setActiveRole("participant")}
								className="gap-2"
							>
								<Users className="h-4 w-4" />
								Participant
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	};

	// Render appropriate dashboard
	return (
		<>
			<RoleToggle />
			{activeRole === "conductor" && hasConductingRole && (
				<ConductorDashboard showParticipantButton={!hasParticipatingRole} />
			)}
			{activeRole === "participant" && hasParticipatingRole && (
				<ParticipantDashboard showConductorButton={!hasConductingRole} />
			)}
		</>
	);
}
