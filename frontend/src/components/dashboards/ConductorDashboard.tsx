"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, BarChart3, Clock, LogOut, TrendingUp, Users } from "lucide-react";
import { authConfig } from "@/lib/api-config";

interface Survey {
	id: number;
	title: string;
	description: string;
	status: string;
	created_at: string;
	responseCount?: number;
}

interface ConductorDashboardProps {
	showParticipantButton?: boolean;
}

export default function ConductorDashboard({ showParticipantButton = false }: ConductorDashboardProps) {
	const { user, logout } = useAuth();
	const router = useRouter();
	const [surveys, setSurveys] = useState<Survey[]>([]);
	const [stats, setStats] = useState({
		total: 0,
		draft: 0,
		published: 0,
		responses: 0
	});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchSurveys();
	}, []);

	const fetchSurveys = async () => {
		try {
			setLoading(true);
			// Get conductor ID from user data
			const conductorResponse = await fetch(`${authConfig.baseUrl}/api/Conductor/current`, {
				credentials: 'include',
				headers: {
					'Host': authConfig.host,
					'Content-Type': 'application/json'
				}
			});

			if (!conductorResponse.ok) {
				console.error('Failed to fetch conductor:', conductorResponse.status);
				throw new Error('Failed to fetch conductor');
			}

			const conductorData = await conductorResponse.json();
			console.log('Conductor response:', conductorData);
			
			// Handle different response structures
			const conductorId = conductorData.data?.conductorId || conductorData.conductorId;
			
			if (!conductorId) {
				console.error('No conductor ID found in response:', conductorData);
				throw new Error('Conductor not registered');
			}

			console.log('Fetching surveys for conductor ID:', conductorId);

			// Fetch surveys by conductor via AuthService proxy
			const response = await fetch(`${authConfig.baseUrl}/api/SurveyProxy/surveys/conductor/${conductorId}`, {
				credentials: 'include',
				headers: {
					'Host': authConfig.host,
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				console.log('Surveys response:', data);
				const surveyList = data.data || [];
				setSurveys(surveyList);

				// Calculate stats
				const total = surveyList.length;
				const published = surveyList.filter((s: Survey) => s.status === 'PUBLISHED').length;
				const draft = total - published;

				setStats({
					total,
					draft,
					published,
					responses: 0 // TODO: Get actual response count
				});
			} else {
				console.error('Failed to fetch surveys:', response.status, await response.text());
			}
		} catch (error) {
			console.error('Error fetching surveys:', error);
		} finally {
			setLoading(false);
		}
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
							<h1 className="text-2xl font-bold text-gray-900">Conductor Dashboard</h1>
							<p className="text-sm text-gray-500 mt-1">Welcome back, {user?.username}</p>
						</div>
						<div className="flex items-center gap-3">
							{showParticipantButton && (
								<Button 
									onClick={() => router.push("/role-selection")} 
									variant="secondary"
									size="sm"
								>
									<Users className="h-4 w-4 mr-2" />
									Become Participant
								</Button>
							)}
							<Button onClick={() => router.push("/survey/create")} size="sm">
								<Plus className="h-4 w-4 mr-2" />
								New Survey
							</Button>
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
				<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
					<StatCard 
						title="Total Surveys" 
						value={stats.total} 
						icon={FileText} 
						color="text-blue-600" 
					/>
					<StatCard 
						title="Published" 
						value={stats.published} 
						icon={TrendingUp} 
						color="text-green-600" 
					/>
					<StatCard 
						title="Drafts" 
						value={stats.draft} 
						icon={Clock} 
						color="text-yellow-600" 
					/>
					<StatCard 
						title="Responses" 
						value={stats.responses} 
						icon={BarChart3} 
						color="text-purple-600" 
					/>
				</div>

				{/* Surveys List */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>My Surveys</CardTitle>
							<Button 
								variant="outline" 
								size="sm"
								onClick={() => router.push("/survey/create")}
							>
								<Plus className="h-4 w-4 mr-2" />
								Create Survey
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						{loading ? (
							<div className="text-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
								<p className="text-gray-500 mt-3">Loading surveys...</p>
							</div>
						) : surveys.length === 0 ? (
							<div className="text-center py-12">
								<FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
								<h3 className="text-lg font-medium text-gray-900 mb-2">No surveys yet</h3>
								<p className="text-gray-500 mb-6">Create your first survey to get started</p>
								<Button onClick={() => router.push("/survey/create")}>
									<Plus className="h-4 w-4 mr-2" />
									Create Your First Survey
								</Button>
							</div>
						) : (
							<div className="space-y-4">
								{surveys.map((survey) => (
									<div 
										key={survey.id}
										className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
										onClick={() => router.push(`/surveys/results/${survey.id}`)}
									>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-3">
													<h3 className="text-lg font-semibold text-gray-900">
														{survey.title}
													</h3>
													<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
														survey.status === 'PUBLISHED' 
															? 'bg-green-100 text-green-800' 
															: 'bg-yellow-100 text-yellow-800'
													}`}>
														{survey.status}
													</span>
												</div>
												<p className="text-gray-600 mt-1 line-clamp-2">
													{survey.description}
												</p>
												<div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
													<span className="flex items-center gap-1">
														<Clock className="h-4 w-4" />
														{new Date(survey.created_at).toLocaleDateString()}
													</span>
													<span className="flex items-center gap-1">
														<BarChart3 className="h-4 w-4" />
														{survey.responseCount || 0} responses
													</span>
												</div>
											</div>
											<Button 
												variant="outline" 
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													router.push(`/surveys/results/${survey.id}`);
												}}
											>
												View Results
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</main>
		</div>
	);
}

