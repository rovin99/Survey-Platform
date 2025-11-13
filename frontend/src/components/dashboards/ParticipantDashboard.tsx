"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
	FileText, 
	CheckCircle2, 
	Clock, 
	LogOut, 
	PlayCircle,
	Search,
	Briefcase
} from "lucide-react";

interface Survey {
	id: number;
	title: string;
	description: string;
	status: string;
	created_at: string;
}

interface SurveySession {
	id: number;
	survey_id: number;
	session_status: string;
	created_at: string;
	updated_at: string;
}

interface ParticipantDashboardProps {
	showConductorButton?: boolean;
}

export default function ParticipantDashboard({ showConductorButton = false }: ParticipantDashboardProps) {
	const { user, logout } = useAuth();
	const router = useRouter();
	const [availableSurveys, setAvailableSurveys] = useState<Survey[]>([]);
	const [inProgressSurveys, setInProgressSurveys] = useState<any[]>([]);
	const [completedCount, setCompletedCount] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchDashboardData();
	}, []);

	const fetchDashboardData = async () => {
		try {
			setLoading(true);
			
			// Fetch available surveys (mock for now - replace with actual API)
			// In production, this would fetch surveys the participant can take
			const mockSurveys: Survey[] = [
				{
					id: 2,
					title: "Sample Survey 2",
					description: "Help us understand your preferences",
					status: "PUBLISHED",
					created_at: new Date().toISOString()
				}
			];
			setAvailableSurveys(mockSurveys);
			
			// Mock in-progress and completed surveys
			// In production, fetch from participant service
			setInProgressSurveys([]);
			setCompletedCount(0);

		} catch (error) {
			console.error('Error fetching dashboard data:', error);
		} finally {
			setLoading(false);
		}
	};

	const startSurvey = (surveyId: number) => {
		router.push(`/survey/take/${surveyId}`);
	};

	const StatCard = ({ title, value, icon: Icon, color }: any) => (
		<Card>
			<CardContent className="pt-6">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-gray-500">{title}</p>
						<p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
					</div>
					<div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('600', '100')}`}>
						<Icon className={`h-6 w-6 ${color}`} />
					</div>
				</div>
			</CardContent>
		</Card>
	);

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b border-gray-200">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-bold text-gray-900">Participant Dashboard</h1>
							<p className="text-sm text-gray-500 mt-1">Welcome back, {user?.username}</p>
						</div>
						<div className="flex items-center gap-3">
							{showConductorButton && (
								<Button 
									onClick={() => router.push("/role-selection")} 
									variant="secondary"
									size="sm"
								>
									<Briefcase className="h-4 w-4 mr-2" />
									Become Conductor
								</Button>
							)}
							<Button onClick={logout} variant="outline" size="sm">
								<LogOut className="h-4 w-4 mr-2" />
								Logout
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<StatCard 
						title="Available Surveys" 
						value={availableSurveys.length} 
						icon={Search} 
						color="text-blue-600" 
					/>
					<StatCard 
						title="In Progress" 
						value={inProgressSurveys.length} 
						icon={Clock} 
						color="text-yellow-600" 
					/>
					<StatCard 
						title="Completed" 
						value={completedCount} 
						icon={CheckCircle2} 
						color="text-green-600" 
					/>
				</div>

				{/* In Progress Surveys */}
				{inProgressSurveys.length > 0 && (
					<Card className="mb-8">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock className="h-5 w-5 text-yellow-600" />
								Continue Where You Left Off
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{inProgressSurveys.map((session) => (
									<div 
										key={session.id}
										className="border border-yellow-200 bg-yellow-50 rounded-lg p-4"
									>
										<div className="flex items-center justify-between">
											<div className="flex-1">
												<h3 className="text-lg font-semibold text-gray-900">
													Survey #{session.survey_id}
												</h3>
												<p className="text-sm text-gray-600 mt-1">
													Last saved: {new Date(session.updated_at).toLocaleString()}
												</p>
											</div>
											<Button 
												onClick={() => startSurvey(session.survey_id)}
												size="sm"
											>
												<PlayCircle className="h-4 w-4 mr-2" />
												Continue
											</Button>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Available Surveys */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5 text-blue-600" />
							Available Surveys
						</CardTitle>
					</CardHeader>
					<CardContent>
						{loading ? (
							<div className="text-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
								<p className="text-gray-500 mt-3">Loading surveys...</p>
							</div>
						) : availableSurveys.length === 0 ? (
							<div className="text-center py-12">
								<Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
								<h3 className="text-lg font-medium text-gray-900 mb-2">No surveys available</h3>
								<p className="text-gray-500">Check back later for new surveys to participate in</p>
							</div>
						) : (
							<div className="space-y-4">
								{availableSurveys.map((survey) => (
									<div 
										key={survey.id}
										className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
									>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<h3 className="text-lg font-semibold text-gray-900">
													{survey.title}
												</h3>
												<p className="text-gray-600 mt-2 line-clamp-2">
													{survey.description}
												</p>
												<div className="flex items-center gap-2 mt-3">
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
														Active
													</span>
													<span className="text-sm text-gray-500">
														• Est. 5-10 minutes
													</span>
												</div>
											</div>
											<Button 
												onClick={() => startSurvey(survey.id)}
												className="ml-4"
											>
												<PlayCircle className="h-4 w-4 mr-2" />
												Start Survey
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Completed Surveys */}
				{completedCount > 0 && (
					<Card className="mt-8">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CheckCircle2 className="h-5 w-5 text-green-600" />
								Completed Surveys ({completedCount})
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								Thank you for your participation! You've completed {completedCount} survey{completedCount > 1 ? 's' : ''}.
							</p>
						</CardContent>
					</Card>
				)}
			</main>
		</div>
	);
}

