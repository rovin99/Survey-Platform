"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { participantsConfig, authConfig, surveyConfig } from "@/lib/api-config";
import {
	FileText,
	CheckCircle2,
	Clock,
	LogOut,
	PlayCircle,
	Briefcase,
	User,
	Trophy,
	XCircle,
	ChevronDown,
	ChevronUp,
	Eye,
	Edit2,
	Save,
	X,
	Plus,
	Trash2
} from "lucide-react";

interface SurveyEntry {
	sessionId: number;
	surveyId: number;
	surveyTitle: string;
	isQuiz: boolean;
	status: string;
	attemptNumber: number;
	startedAt: string;
	completedAt?: string;
	timeTakenSeconds?: number;
	score?: number;
	totalPoints?: number;
	percentage?: number;
	passed?: boolean;
}

interface SurveyHistory {
	participantId: number;
	totalSurveys: number;
	completedSurveys: number;
	inProgressSurveys: number;
	surveys: SurveyEntry[];
}

interface AssignedSurvey {
	surveyId: number;
	title: string;
	description: string;
	isQuiz: boolean;
	assignedAt: string;
	invitationToken: string;
}

interface CustomField {
	name: string;
	value: string;
}

interface ParticipantProfile {
	participantId: number;
	userId: number;
	name?: string;
	email?: string;
	rollNo?: string;
	phoneNumber?: string;
	customFields?: CustomField[];
}

interface ParticipantDashboardProps {
	showConductorButton?: boolean;
}

export default function ParticipantDashboard({ showConductorButton = false }: ParticipantDashboardProps) {
	const { user, logout } = useAuth();
	const router = useRouter();
	const [history, setHistory] = useState<SurveyHistory | null>(null);
	const [assigned, setAssigned] = useState<AssignedSurvey[]>([]);
	const [profile, setProfile] = useState<ParticipantProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [expandedSurvey, setExpandedSurvey] = useState<number | null>(null);
	const [showProfileEdit, setShowProfileEdit] = useState(false);
	const [profileForm, setProfileForm] = useState({
		name: "",
		rollNo: "",
		phoneNumber: "",
		customFields: [] as CustomField[]
	});
	const [savingProfile, setSavingProfile] = useState(false);

	useEffect(() => {
		fetchDashboardData();
	}, []);

	const fetchDashboardData = async () => {
		try {
			setLoading(true);

			// Fetch survey history
			const historyResponse = await fetch(`${participantsConfig.baseUrl}/api/participant/my-history`, {
				credentials: 'include'
			});

			if (historyResponse.ok) {
				const data = await historyResponse.json();
				setHistory(data.data);
			}

			// Fetch surveys assigned to this student (invitations not yet completed)
			try {
				const assignedResponse = await fetch(`${surveyConfig.baseUrl}${surveyConfig.paths.assigned}`, {
					credentials: 'include'
				});
				if (assignedResponse.ok) {
					const data = await assignedResponse.json();
					setAssigned(data.data || []);
				}
			} catch (err) {
				console.error('Error fetching assigned surveys:', err);
			}

			// Fetch profile
			const profileResponse = await fetch(`${authConfig.baseUrl}/api/Participant/profile`, {
				credentials: 'include'
			});

			if (profileResponse.ok) {
				const data = await profileResponse.json();
				setProfile(data.data);
				setProfileForm({
					name: data.data?.name || "",
					rollNo: data.data?.rollNo || "",
					phoneNumber: data.data?.phoneNumber || "",
					customFields: data.data?.customFields || []
				});
			}

		} catch (error) {
			console.error('Error fetching dashboard data:', error);
		} finally {
			setLoading(false);
		}
	};

	const saveProfile = async () => {
		try {
			setSavingProfile(true);
			const response = await fetch(`${authConfig.baseUrl}/api/Participant/profile`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(profileForm)
			});

			if (response.ok) {
				const data = await response.json();
				setProfile(data.data);
				setShowProfileEdit(false);
				toast.success('Profile updated successfully');
			} else {
				toast.error('Failed to update profile');
			}
		} catch (error) {
			console.error('Error saving profile:', error);
			toast.error('Failed to update profile');
		} finally {
			setSavingProfile(false);
		}
	};

	const startSurvey = (surveyId: number) => {
		router.push(`/survey/take/${surveyId}`);
	};

	const viewResults = (sessionId: number) => {
		router.push(`/survey/quiz-results/${sessionId}`);
	};

	const formatTime = (seconds: number) => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (days > 0) {
			return `${days}d ${hours}h ${mins}m`;
		}
		if (hours > 0) {
			return `${hours}h ${mins}m ${secs}s`;
		}
		return `${mins}m ${secs}s`;
	};

	const inProgressSurveys = history?.surveys.filter(s => s.status === "IN_PROGRESS") || [];
	const completedSurveys = history?.surveys.filter(s => s.status === "COMPLETED") || [];
	// Don't show an assigned survey that's already started/completed (it appears in the sections below)
	const historySurveyIds = new Set((history?.surveys || []).map(s => s.surveyId));
	const assignedToDo = assigned.filter(a => !historySurveyIds.has(a.surveyId));

	const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }) => (
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
							<p className="text-sm text-gray-500 mt-1">Welcome back, {profile?.name || user?.username}</p>
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
				{/* Profile Card */}
				<Card className="mb-8">
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2">
								<User className="h-5 w-5 text-blue-600" />
								My Profile
							</CardTitle>
							{!showProfileEdit ? (
								<Button variant="outline" size="sm" onClick={() => setShowProfileEdit(true)}>
									<Edit2 className="h-4 w-4 mr-2" />
									Edit Profile
								</Button>
							) : (
								<div className="flex gap-2">
									<Button variant="outline" size="sm" onClick={() => setShowProfileEdit(false)}>
										<X className="h-4 w-4 mr-2" />
										Cancel
									</Button>
									<Button size="sm" onClick={saveProfile} disabled={savingProfile}>
										<Save className="h-4 w-4 mr-2" />
										{savingProfile ? 'Saving...' : 'Save'}
									</Button>
								</div>
							)}
						</div>
					</CardHeader>
					<CardContent>
						{showProfileEdit ? (
							<div className="space-y-6">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="text-sm font-medium text-gray-700">Name</label>
										<Input
											value={profileForm.name}
											onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
											placeholder="Your name"
											className="mt-1"
										/>
									</div>
									<div>
										<label className="text-sm font-medium text-gray-700">Email</label>
										<Input
											value={profile?.email || ""}
											disabled
											className="mt-1 bg-gray-100"
										/>
										<p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
									</div>
									<div>
										<label className="text-sm font-medium text-gray-700">Roll No (Optional)</label>
										<Input
											value={profileForm.rollNo}
											onChange={(e) => setProfileForm({ ...profileForm, rollNo: e.target.value })}
											placeholder="Your roll number"
											className="mt-1"
										/>
									</div>
									<div>
										<label className="text-sm font-medium text-gray-700">Phone Number (Optional)</label>
										<Input
											value={profileForm.phoneNumber}
											onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
											placeholder="Your phone number"
											className="mt-1"
										/>
									</div>
								</div>

								{/* Custom Fields Section */}
								<div className="border-t pt-4">
									<div className="flex items-center justify-between mb-3">
										<div>
											<h4 className="text-sm font-medium text-gray-700">Custom Fields</h4>
											<p className="text-xs text-gray-500">Add your own profile fields (e.g., Department, Year, Section)</p>
										</div>
										{profileForm.customFields.length < 20 && (
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => setProfileForm({
													...profileForm,
													customFields: [...profileForm.customFields, { name: "", value: "" }]
												})}
											>
												<Plus className="h-4 w-4 mr-1" />
												Add Field
											</Button>
										)}
									</div>
									{profileForm.customFields.length === 0 ? (
										<p className="text-sm text-gray-400 italic">No custom fields added yet</p>
									) : (
										<div className="space-y-3">
											{profileForm.customFields.map((field, index) => (
												<div key={index} className="flex items-start gap-2">
													<div className="flex-1">
														<Input
															value={field.name}
															onChange={(e) => {
																const updated = [...profileForm.customFields];
																updated[index] = { ...updated[index], name: e.target.value };
																setProfileForm({ ...profileForm, customFields: updated });
															}}
															placeholder="Field name (e.g., Department)"
															className="mb-1"
															maxLength={50}
														/>
													</div>
													<div className="flex-1">
														<Input
															value={field.value}
															onChange={(e) => {
																const updated = [...profileForm.customFields];
																updated[index] = { ...updated[index], value: e.target.value };
																setProfileForm({ ...profileForm, customFields: updated });
															}}
															placeholder="Value"
															maxLength={200}
														/>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="text-red-500 hover:text-red-700 hover:bg-red-50"
														onClick={() => {
															const updated = profileForm.customFields.filter((_, i) => i !== index);
															setProfileForm({ ...profileForm, customFields: updated });
														}}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						) : (
							<div className="space-y-4">
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<div>
										<p className="text-sm text-gray-500">Name</p>
										<p className="font-medium">{profile?.name || user?.username || '-'}</p>
									</div>
									<div>
										<p className="text-sm text-gray-500">Email</p>
										<p className="font-medium">{profile?.email || '-'}</p>
									</div>
									<div>
										<p className="text-sm text-gray-500">Roll No</p>
										<p className="font-medium">{profile?.rollNo || '-'}</p>
									</div>
									<div>
										<p className="text-sm text-gray-500">Phone</p>
										<p className="font-medium">{profile?.phoneNumber || '-'}</p>
									</div>
								</div>
								{/* Display Custom Fields */}
								{profile?.customFields && profile.customFields.length > 0 && (
									<div className="border-t pt-4">
										<p className="text-sm font-medium text-gray-700 mb-2">Custom Fields</p>
										<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
											{profile.customFields.map((field, index) => (
												<div key={index}>
													<p className="text-sm text-gray-500">{field.name}</p>
													<p className="font-medium">{field.value}</p>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<StatCard
						title="Total Surveys"
						value={history?.totalSurveys || 0}
						icon={FileText}
						color="text-blue-600"
					/>
					<StatCard
						title="In Progress"
						value={history?.inProgressSurveys || 0}
						icon={Clock}
						color="text-yellow-600"
					/>
					<StatCard
						title="Completed"
						value={history?.completedSurveys || 0}
						icon={CheckCircle2}
						color="text-green-600"
					/>
				</div>

				{/* Assigned to you (not yet started) */}
				{assignedToDo.length > 0 && (
					<Card className="mb-8 border-blue-200">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5 text-blue-600" />
								Assigned to you ({assignedToDo.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{assignedToDo.map((a) => (
									<div
										key={`assigned-${a.surveyId}`}
										className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50/40 rounded-lg"
									>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
												<Badge variant="secondary" className={a.isQuiz ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}>
													{a.isQuiz ? "Quiz" : "Survey"}
												</Badge>
											</div>
											{a.description && <p className="text-sm text-gray-500 line-clamp-1 mt-1">{a.description}</p>}
											<p className="text-xs text-gray-400 mt-1">Assigned: {new Date(a.assignedAt).toLocaleDateString()}</p>
										</div>
										<Button onClick={() => startSurvey(a.surveyId)} className="ml-4 shrink-0">
											<PlayCircle className="h-4 w-4 mr-2" />
											Take {a.isQuiz ? "Quiz" : "Survey"}
										</Button>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

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
								{inProgressSurveys.map((survey) => (
									<div
										key={survey.sessionId}
										className="border border-yellow-200 bg-yellow-50 rounded-lg p-4"
									>
										<div className="flex items-center justify-between">
											<div className="flex-1">
												<h3 className="text-lg font-semibold text-gray-900">
													{survey.surveyTitle}
												</h3>
												<div className="flex items-center gap-2 mt-1">
													{survey.isQuiz && (
														<Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
															Quiz
														</Badge>
													)}
													<span className="text-sm text-gray-600">
														Started: {new Date(survey.startedAt).toLocaleString()}
													</span>
													{survey.attemptNumber > 1 && (
														<span className="text-sm text-gray-500">
															• Attempt #{survey.attemptNumber}
														</span>
													)}
												</div>
											</div>
											<Button
												onClick={() => startSurvey(survey.surveyId)}
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

				{/* Completed Surveys */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5 text-green-600" />
							Completed Surveys ({completedSurveys.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						{loading ? (
							<div className="text-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
								<p className="text-gray-500 mt-3">Loading your surveys...</p>
							</div>
						) : completedSurveys.length === 0 ? (
							<div className="text-center py-12">
								<FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
								<h3 className="text-lg font-medium text-gray-900 mb-2">No completed surveys yet</h3>
								<p className="text-gray-500">Complete a survey to see your results here</p>
							</div>
						) : (
							<div className="space-y-4">
								{completedSurveys.map((survey) => (
									<div
										key={survey.sessionId}
										className="border border-gray-200 rounded-lg overflow-hidden"
									>
										<div
											className="p-4 hover:bg-gray-50 cursor-pointer"
											onClick={() => setExpandedSurvey(expandedSurvey === survey.sessionId ? null : survey.sessionId)}
										>
											<div className="flex items-center justify-between">
												<div className="flex-1">
													<div className="flex items-center gap-2">
														<h3 className="text-lg font-semibold text-gray-900">
															{survey.surveyTitle}
														</h3>
														{survey.isQuiz && (
															<Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
																Quiz
															</Badge>
														)}
														{survey.passed !== undefined && (
															<Badge variant={survey.passed ? "default" : "destructive"}>
																{survey.passed ? (
																	<><Trophy className="h-3 w-3 mr-1" /> Passed</>
																) : (
																	<><XCircle className="h-3 w-3 mr-1" /> Not Passed</>
																)}
															</Badge>
														)}
													</div>
													<div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
														<span>Completed: {new Date(survey.completedAt || survey.startedAt).toLocaleDateString()}</span>
														{survey.timeTakenSeconds && (
															<span>• Time: {formatTime(survey.timeTakenSeconds)}</span>
														)}
														{survey.attemptNumber > 1 && (
															<span>• Attempt #{survey.attemptNumber}</span>
														)}
													</div>
												</div>
												<div className="flex items-center gap-4">
													{survey.isQuiz && survey.percentage !== undefined && (
														<div className="text-right">
															<p className="text-2xl font-bold text-gray-900">
																{survey.percentage.toFixed(1)}%
															</p>
															<p className="text-sm text-gray-500">
																{survey.score}/{survey.totalPoints} pts
															</p>
														</div>
													)}
													{expandedSurvey === survey.sessionId ? (
														<ChevronUp className="h-5 w-5 text-gray-400" />
													) : (
														<ChevronDown className="h-5 w-5 text-gray-400" />
													)}
												</div>
											</div>
										</div>

										{/* Expanded details */}
										{expandedSurvey === survey.sessionId && (
											<div className="border-t border-gray-200 bg-gray-50 p-4">
												<div className="flex justify-between items-center">
													<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
														<div>
															<p className="text-gray-500">Started</p>
															<p className="font-medium">{new Date(survey.startedAt).toLocaleString()}</p>
														</div>
														<div>
															<p className="text-gray-500">Completed</p>
															<p className="font-medium">{new Date(survey.completedAt || survey.startedAt).toLocaleString()}</p>
														</div>
														{survey.isQuiz && (
															<>
																<div>
																	<p className="text-gray-500">Score</p>
																	<p className="font-medium">{survey.score} / {survey.totalPoints}</p>
																</div>
																<div>
																	<p className="text-gray-500">Percentage</p>
																	<p className="font-medium">{survey.percentage?.toFixed(1)}%</p>
																</div>
															</>
														)}
													</div>
													{survey.isQuiz && (
														<Button
															variant="outline"
															size="sm"
															onClick={(e) => {
																e.stopPropagation();
																viewResults(survey.sessionId);
															}}
														>
															<Eye className="h-4 w-4 mr-2" />
															View Details
														</Button>
													)}
												</div>
											</div>
										)}
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
