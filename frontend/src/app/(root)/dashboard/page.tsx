"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, BarChart3 } from "lucide-react";

export default function DashboardPage() {
	const { user, logout } = useAuth();
	const router = useRouter();

	// Check user roles and redirect appropriately
	useEffect(() => {
		if (user && user.roles) {
			const hasConductingRole = user.roles.includes("Conducting");
			const hasParticipatingRole = user.roles.includes("Participating");
			
			// If user has no specific roles beyond "User", redirect to role selection
			if (!hasConductingRole && !hasParticipatingRole && user.roles.includes("User")) {
				router.push("/role-selection");
				return;
			}
		}
	}, [user, router]);

	// Determine what to show based on user roles
	const hasConductingRole = user?.roles?.includes("Conducting");
	const hasParticipatingRole = user?.roles?.includes("Participating");

	const handleCreateSurvey = () => {
		router.push("/survey/create");
	};

	const handleViewSurveys = () => {
		router.push("/surveys");
	};

	const handleRegisterAsRole = (role: string) => {
		router.push("/role-selection");
	};

	return (
		<main className="min-h-screen bg-gray-50">
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					<Card className="mb-6">
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Welcome, {user?.username}!</CardTitle>
								<Button variant="outline" onClick={logout}>
									Logout
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<p className="text-sm font-medium text-gray-500">Email</p>
									<p className="mt-1">{user?.email}</p>
								</div>
								<div>
									<p className="text-sm font-medium text-gray-500">Roles</p>
									<div className="mt-1 flex gap-2">
										{user?.roles?.map((role) => (
											<span
												key={role}
												className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
											>
												{role}
											</span>
										))}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Role-based Actions */}
					<div className="grid gap-6 md:grid-cols-2">
						{hasConductingRole && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Plus className="h-5 w-5" />
										Survey Creation
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 mb-4">
										Create and manage surveys for your participants
									</p>
									<div className="space-y-2">
										<Button onClick={handleCreateSurvey} className="w-full">
											Create New Survey
										</Button>
										<Button 
											variant="outline" 
											onClick={handleViewSurveys} 
											className="w-full"
										>
											<BarChart3 className="h-4 w-4 mr-2" />
											View My Surveys
										</Button>
									</div>
								</CardContent>
							</Card>
						)}

						{hasParticipatingRole && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Users className="h-5 w-5" />
										Survey Participation
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 mb-4">
										Participate in surveys and share your insights
									</p>
									<Button variant="outline" className="w-full">
										View Available Surveys
									</Button>
								</CardContent>
							</Card>
						)}

						{/* Registration Cards for missing roles */}
						{!hasConductingRole && (
							<Card>
								<CardHeader>
									<CardTitle>Become a Survey Conductor</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 mb-4">
										Create and conduct surveys for research or business insights
									</p>
									<Button 
										variant="outline" 
										onClick={() => handleRegisterAsRole("conductor")}
										className="w-full"
									>
										Register as Conductor
									</Button>
								</CardContent>
							</Card>
						)}

						{!hasParticipatingRole && (
							<Card>
								<CardHeader>
									<CardTitle>Become a Survey Participant</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 mb-4">
										Share your opinions and insights by participating in surveys
									</p>
									<Button 
										variant="outline" 
										onClick={() => handleRegisterAsRole("participant")}
										className="w-full"
									>
										Register as Participant
									</Button>
								</CardContent>
							</Card>
						)}
					</div>
				</div>
			</div>
		</main>
	);
}