"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
	const { user, logout } = useAuth();

	// No need for loading check here as the AuthGuard in the layout already handles authentication and loading states
	
	return (
		<main className="min-h-screen bg-gray-50">
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-2xl mx-auto">
					<Card>
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
				</div>
			</div>
		</main>
	);
}