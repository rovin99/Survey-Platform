"use client";

import { ChevronRight, Download, Loader2, Users, CheckCircle, Clock, Trophy, Target, ChevronDown, ChevronUp, Mail, Timer, Award, Monitor, Smartphone, Tablet, Globe, RotateCcw, ImageIcon, AlertTriangle, Save, Send, Check, Pencil, Star } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
// XLSX imported dynamically in exportToExcel to avoid SSR issues

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { participantService, type SurveyResultsResponse, type ParticipantResult, type AnswerDetail } from "@/services/participantService";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { JustificationDisplay } from "@/components/quiz/JustificationDisplay";

const AnalyticsDashboard = dynamic(() => import("@/components/analytics/AnalyticsDashboard"), { ssr: false });

export default function SurveyResults() {
	const params = useParams();
	const surveyId = params.id as string;
	const [loading, setLoading] = useState(true);
	const [results, setResults] = useState<SurveyResultsResponse | null>(null);
	const [expandedParticipant, setExpandedParticipant] = useState<number | null>(null);
	const [resettingEmail, setResettingEmail] = useState<string | null>(null);
	// Edited marks: { [sessionId]: { [questionId]: number } }
	const [editedMarks, setEditedMarks] = useState<Record<number, Record<number, number>>>({});
	const [savingSession, setSavingSession] = useState<number | null>(null);
	const [notifyingSession, setNotifyingSession] = useState<number | null>(null);

	const [sessionExpired, setSessionExpired] = useState(false);

	useEffect(() => {
		fetchResults();
		const interval = setInterval(() => {
			if (!sessionExpired) fetchResults();
		}, 30000);
		return () => clearInterval(interval);
	}, [surveyId, sessionExpired]);

	const handleResetParticipant = async (email: string) => {
		if (!confirm(`Are you sure you want to reset "${email}"?\n\nThis will delete all their sessions and allow them to retake the survey/quiz.`)) {
			return;
		}

		setResettingEmail(email);
		try {
			await participantService.resetParticipant(parseInt(surveyId), email);
			toast.success(`Successfully reset ${email}. They can now retake the survey.`);
			fetchResults();
		} catch (error: any) {
			console.error('Error resetting participant:', error);
			toast.error('Failed to reset participant');
		} finally {
			setResettingEmail(null);
		}
	};

	const fetchResults = async () => {
		try {
			if (!results) setLoading(true); // Only show loading spinner on first load
			const data = await participantService.getSurveyResults(parseInt(surveyId));
			setResults(data);
		} catch (error: any) {
			console.error('Error fetching survey results:', error);
			if (error?.response?.status === 401) {
				setSessionExpired(true);
				toast.error('Session expired. Please re-login to continue.');
			} else if (!results) {
				// Only show error toast on first load, not on auto-refresh failures
				toast.error('Failed to load survey results');
			}
		} finally {
			setLoading(false);
		}
	};

	const formatTime = (seconds: number): string => {
		if (seconds < 60) return `${seconds}s`;
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		if (mins < 60) return `${mins}m ${secs}s`;
		const hours = Math.floor(mins / 60);
		const remainingMins = mins % 60;
		return `${hours}h ${remainingMins}m`;
	};

	const formatDate = (dateString: string): string => {
		return new Date(dateString).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const exportToExcel = async () => {
		if (!results) return;
		const XLSX = await import("xlsx");

		// Collect all unique participant info keys
		const allInfoKeys = new Set<string>();
		results.participants.forEach(p => {
			if (p.participantInfo) {
				Object.keys(p.participantInfo).forEach(key => allInfoKeys.add(key));
			}
		});
		const infoKeysArray = Array.from(allInfoKeys);
		const infoHeaders = infoKeysArray.map(k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

		// Build ordered list of all unique questions across all participants
		const questionMap = new Map<number, { text: string; type: string; pointsPossible?: number }>();
		const questionOrder: number[] = [];
		results.participants.forEach(p => {
			p.answers.forEach(a => {
				if (!questionMap.has(a.questionId)) {
					questionMap.set(a.questionId, {
						text: a.questionText,
						type: a.questionType,
						pointsPossible: a.pointsPossible,
					});
					questionOrder.push(a.questionId);
				}
			});
		});

		const formatAnswerValue = (value: any): string => {
			if (value === null || value === undefined) return '';
			if (typeof value === 'object') {
				if (value.value !== undefined) {
					return Array.isArray(value.value) ? value.value.join(', ') : String(value.value);
				}
				return JSON.stringify(value);
			}
			return String(value);
		};

		// Format a stored justification for a spreadsheet cell. Single-choice/text justifications
		// are plain strings; multiple-choice are a JSON array of { option, reason } (one per option).
		const formatJustification = (justification?: string): string => {
			if (!justification || !justification.trim()) return '';
			try {
				const parsed = JSON.parse(justification);
				if (Array.isArray(parsed)) {
					return parsed
						.map((e: { option?: string; reason?: string }) => `${e.option ?? ''}: ${e.reason ?? ''}`)
						.join('\n');
				}
			} catch {
				// not JSON → plain string
			}
			return justification;
		};

		// --- Sheet 1: Marks Overview (one question = one column with marks) ---
		const marksHeaders = [
			'#',
			'Email',
			...infoHeaders,
			'Status',
			...questionOrder.map((qId, i) => {
				const q = questionMap.get(qId)!;
				const label = q.text.length > 40 ? q.text.substring(0, 40) + '…' : q.text;
				return `Q${i + 1}: ${label}`;
			}),
			...(results.isQuiz ? ['Total Score', 'Max Score', 'Percentage', 'Passed'] : ['Questions Answered']),
			...(results.isQuiz ? ['Tab Switches'] : []),
			'Time Taken',
			'Started At',
			'Completed At',
		];

		const marksRows = results.participants.map((p, idx) => {
			const infoValues = infoKeysArray.map(key => p.participantInfo?.[key] || '');
			const answersByQId = new Map(p.answers.map(a => [a.questionId, a]));

			const questionMarks = questionOrder.map(qId => {
				const answer = answersByQId.get(qId);
				if (!answer) return '';
				if (results.isQuiz && answer.pointsEarned !== undefined) {
					return answer.pointsEarned;
				}
				// For non-quiz, show the answer text
				return formatAnswerValue(answer.userAnswer);
			});

			return [
				idx + 1,
				p.email,
				...infoValues,
				p.status,
				...questionMarks,
				...(results.isQuiz
					? [
						p.score ?? '',
						p.totalPoints ?? '',
						p.percentage !== undefined ? Math.round(p.percentage * 10) / 10 : '',
						p.passed !== undefined ? (p.passed ? 'Yes' : 'No') : '',
					]
					: [p.answers.length]),
				...(results.isQuiz ? [p.tabSwitchCount ?? 0] : []),
				p.timeTakenSeconds ? formatTime(p.timeTakenSeconds) : '',
				formatDate(p.startedAt),
				p.completedAt ? formatDate(p.completedAt) : 'In Progress',
			];
		});

		// Add a "Max Marks" row at top for quiz, so conductors see the scale
		const allRows: any[][] = [marksHeaders];
		if (results.isQuiz) {
			const maxMarksRow = [
				'',
				'MAX MARKS',
				...infoKeysArray.map(() => ''),
				'',
				...questionOrder.map(qId => questionMap.get(qId)?.pointsPossible ?? ''),
				'', '', '', '', // Total Score, Max Score, Percentage, Passed
				'', // Tab Switches
				'', '', '', // Time, Started, Completed
			];
			allRows.push(maxMarksRow);
		}
		allRows.push(...marksRows);

		const wsMarks = XLSX.utils.aoa_to_sheet(allRows);

		// Set column widths
		const colWidths = [
			{ wch: 4 },  // #
			{ wch: 28 }, // Email
			...infoKeysArray.map(() => ({ wch: 16 })),
			{ wch: 12 }, // Status
			...questionOrder.map(() => ({ wch: 18 })), // Question columns
			...(results.isQuiz ? [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 14 }] : [{ wch: 18 }]),
			{ wch: 12 }, // Time
			{ wch: 20 }, // Started
			{ wch: 20 }, // Completed
		];
		wsMarks['!cols'] = colWidths;

		// --- Sheet 2: Detailed Answers (full answer text per question) ---
		const detailHeaders = [
			'#',
			'Email',
			...infoHeaders,
			...questionOrder.map((qId, i) => {
				const q = questionMap.get(qId)!;
				const label = q.text.length > 40 ? q.text.substring(0, 40) + '…' : q.text;
				return `Q${i + 1}: ${label}`;
			}),
		];

		const detailRows = results.participants.map((p, idx) => {
			const infoValues = infoKeysArray.map(key => p.participantInfo?.[key] || '');
			const answersByQId = new Map(p.answers.map(a => [a.questionId, a]));

			const answerTexts = questionOrder.map(qId => {
				const answer = answersByQId.get(qId);
				if (!answer) return '';
				return formatAnswerValue(answer.userAnswer);
			});

			return [idx + 1, p.email, ...infoValues, ...answerTexts];
		});

		const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
		wsDetail['!cols'] = [
			{ wch: 4 },
			{ wch: 28 },
			...infoKeysArray.map(() => ({ wch: 16 })),
			...questionOrder.map(() => ({ wch: 30 })),
		];

		// --- Sheet: Justifications (only questions that have at least one justification) ---
		const justifiedQuestionOrder = questionOrder.filter(qId =>
			results.participants.some(p => {
				const a = p.answers.find(ans => ans.questionId === qId);
				return a?.justification && a.justification.trim().length > 0;
			})
		);

		let wsJustifications: any = null;
		if (justifiedQuestionOrder.length > 0) {
			const justHeaders = [
				'#',
				'Email',
				...infoHeaders,
				...justifiedQuestionOrder.map((qId) => {
					const i = questionOrder.indexOf(qId);
					const q = questionMap.get(qId)!;
					const label = q.text.length > 40 ? q.text.substring(0, 40) + '…' : q.text;
					return `Q${i + 1}: ${label}`;
				}),
			];

			const justRows = results.participants.map((p, idx) => {
				const infoValues = infoKeysArray.map(key => p.participantInfo?.[key] || '');
				const answersByQId = new Map(p.answers.map(a => [a.questionId, a]));
				const justTexts = justifiedQuestionOrder.map(qId => formatJustification(answersByQId.get(qId)?.justification));
				return [idx + 1, p.email, ...infoValues, ...justTexts];
			});

			wsJustifications = XLSX.utils.aoa_to_sheet([justHeaders, ...justRows]);
			wsJustifications['!cols'] = [
				{ wch: 4 },
				{ wch: 28 },
				...infoKeysArray.map(() => ({ wch: 16 })),
				...justifiedQuestionOrder.map(() => ({ wch: 40 })),
			];
		}

		// --- Sheet 3: Question Key (question ID, full text, type, max marks) ---
		const keyHeaders = ['Q#', 'Question ID', 'Question Text', 'Type', 'Max Marks'];
		const keyRows = questionOrder.map((qId, i) => {
			const q = questionMap.get(qId)!;
			return [`Q${i + 1}`, qId, q.text, q.type, q.pointsPossible ?? ''];
		});
		const wsKey = XLSX.utils.aoa_to_sheet([keyHeaders, ...keyRows]);
		wsKey['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 60 }, { wch: 16 }, { wch: 12 }];

		// Build workbook
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, wsMarks, 'Marks');
		XLSX.utils.book_append_sheet(wb, wsDetail, 'Answers');
		if (wsJustifications) {
			XLSX.utils.book_append_sheet(wb, wsJustifications, 'Justifications');
		}
		XLSX.utils.book_append_sheet(wb, wsKey, 'Question Key');

		const fileName = `${results.surveyTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim()}-results-${new Date().toISOString().split('T')[0]}.xlsx`;
		XLSX.writeFile(wb, fileName);
		toast.success('Results exported to Excel!');
	};

	const toggleParticipant = (sessionId: number) => {
		setExpandedParticipant(expandedParticipant === sessionId ? null : sessionId);
	};

	// Update a single question's marks in local state
	const handleMarkEdit = useCallback((sessionId: number, questionId: number, marks: number) => {
		setEditedMarks(prev => ({
			...prev,
			[sessionId]: {
				...(prev[sessionId] || {}),
				[questionId]: marks,
			}
		}));
	}, []);

	// Get the current marks for a question (edited or original)
	const getMarks = useCallback((sessionId: number, answer: AnswerDetail): number => {
		return editedMarks[sessionId]?.[answer.questionId] ?? answer.pointsEarned ?? 0;
	}, [editedMarks]);

	// Check if a session has any edits
	const hasEdits = useCallback((sessionId: number): boolean => {
		return !!editedMarks[sessionId] && Object.keys(editedMarks[sessionId]).length > 0;
	}, [editedMarks]);

	// Save all edited marks for a participant session
	const handleSaveMarks = async (participant: ParticipantResult) => {
		const sessionEdits = editedMarks[participant.sessionId];
		if (!sessionEdits || Object.keys(sessionEdits).length === 0) {
			toast.info('No changes to save');
			return;
		}

		setSavingSession(participant.sessionId);
		try {
			const evaluations = participant.answers.map(a => ({
				question_id: a.questionId,
				marks_given: editedMarks[participant.sessionId]?.[a.questionId] ?? a.pointsEarned ?? 0,
				max_marks: a.pointsPossible ?? 0,
			}));

			await participantService.submitEvaluation(participant.sessionId, evaluations, false);

			// Update local results state with new marks
			setResults(prev => {
				if (!prev) return prev;
				return {
					...prev,
					participants: prev.participants.map(p => {
						if (p.sessionId !== participant.sessionId) return p;
						const newAnswers = p.answers.map(a => ({
							...a,
							pointsEarned: editedMarks[p.sessionId]?.[a.questionId] ?? a.pointsEarned,
						}));
						const totalScore = newAnswers.reduce((sum, a) => sum + (a.pointsEarned ?? 0), 0);
						const totalPoints = newAnswers.reduce((sum, a) => sum + (a.pointsPossible ?? 0), 0);
						const percentage = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
						return { ...p, answers: newAnswers, score: totalScore, totalPoints, percentage };
					})
				};
			});

			// Clear edits for this session
			setEditedMarks(prev => {
				const next = { ...prev };
				delete next[participant.sessionId];
				return next;
			});

			toast.success('Marks saved successfully');
		} catch (error: any) {
			console.error('Error saving marks:', error);
			if (error?.response?.status === 401) {
				setSessionExpired(true);
				toast.error('Session expired. Please re-login to save marks.');
			} else {
				toast.error(error.message || 'Failed to save marks');
			}
		} finally {
			setSavingSession(null);
		}
	};

	// Save marks and send email notification to participant
	const handleNotifyParticipant = async (participant: ParticipantResult) => {
		if (!participant.email) {
			toast.error('No email address for this participant');
			return;
		}

		setNotifyingSession(participant.sessionId);
		try {
			const evaluations = participant.answers.map(a => ({
				question_id: a.questionId,
				marks_given: editedMarks[participant.sessionId]?.[a.questionId] ?? a.pointsEarned ?? 0,
				max_marks: a.pointsPossible ?? 0,
			}));

			await participantService.submitEvaluation(participant.sessionId, evaluations, true);

			// Clear edits
			setEditedMarks(prev => {
				const next = { ...prev };
				delete next[participant.sessionId];
				return next;
			});

			toast.success(`Results sent to ${participant.email}`);
		} catch (error: any) {
			console.error('Error notifying participant:', error);
			toast.error(error.message || 'Failed to send notification');
		} finally {
			setNotifyingSession(null);
		}
	};

	if (loading) {
		return (
			<div className="container mx-auto py-6 flex items-center justify-center min-h-screen">
				<div className="text-center">
					<Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
					<p className="text-gray-600">Loading survey results...</p>
				</div>
			</div>
		);
	}

	if (!results) {
		return (
			<div className="container mx-auto py-6">
				<div className="text-center py-12">
					<Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
					<h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
					<p className="text-gray-500">There are no responses for this survey yet.</p>
				</div>
			</div>
		);
	}

	const completionRate = results.totalSessions > 0
		? Math.round((results.completedSessions / results.totalSessions) * 100)
		: 0;

	return (
		<div className="container mx-auto py-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
						<Link href="/dashboard" className="hover:text-foreground">
							Surveys
						</Link>
						<ChevronRight className="h-4 w-4" />
						<span className="text-foreground">{results.surveyTitle}</span>
					</div>
					<h1 className="text-2xl font-bold">{results.surveyTitle}</h1>
					<div className="flex items-center gap-2 mt-2">
						{results.isQuiz && (
							<Badge variant="secondary">
								<Trophy className="h-3 w-3 mr-1" />
								Quiz
							</Badge>
						)}
						{results.maxAttempts && (
							<Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
								Max {results.maxAttempts} attempt{results.maxAttempts > 1 ? 's' : ''}
							</Badge>
						)}
					</div>
				</div>
				<Button onClick={exportToExcel} variant="outline">
					<Download className="mr-2 h-4 w-4" />
					Export Excel
				</Button>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center space-x-3">
							<div className="p-2 bg-blue-100 rounded-lg">
								<Users className="h-5 w-5 text-blue-600" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Total Responses</p>
								<p className="text-2xl font-bold">{results.totalSessions}</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center space-x-3">
							<div className="p-2 bg-green-100 rounded-lg">
								<CheckCircle className="h-5 w-5 text-green-600" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Completed</p>
								<p className="text-2xl font-bold text-green-600">{results.completedSessions}</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center space-x-3">
							<div className="p-2 bg-yellow-100 rounded-lg">
								<Clock className="h-5 w-5 text-yellow-600" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">In Progress</p>
								<p className="text-2xl font-bold text-yellow-600">{results.inProgressSessions}</p>
							</div>
						</div>
					</CardContent>
				</Card>
				{results.isQuiz ? (
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center space-x-3">
								<div className="p-2 bg-purple-100 rounded-lg">
									<Target className="h-5 w-5 text-purple-600" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Avg Score</p>
									<p className="text-2xl font-bold text-purple-600">
										{results.averageScore !== undefined ? results.averageScore.toFixed(1) : 'N/A'}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				) : (
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center space-x-3">
								<div className="p-2 bg-purple-100 rounded-lg">
									<Target className="h-5 w-5 text-purple-600" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Completion Rate</p>
									<p className="text-2xl font-bold text-purple-600">{completionRate}%</p>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Quiz-specific stats */}
			{results.isQuiz && results.passRate !== undefined && (
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<Award className="h-6 w-6 text-green-600" />
								<div>
									<p className="text-sm text-muted-foreground">Pass Rate</p>
									<p className="text-xl font-bold text-green-600">{results.passRate.toFixed(1)}%</p>
								</div>
							</div>
							<div className="text-right text-sm text-muted-foreground">
								{results.completedSessions > 0 && (
									<>
										{Math.round((results.passRate / 100) * results.completedSessions)} of {results.completedSessions} participants passed
									</>
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Analytics Dashboard */}
			{results.participants.length > 0 && (
				<AnalyticsDashboard results={results} />
			)}

			{/* Participants Table */}
			<Card>
				<CardHeader>
					<CardTitle>Participants</CardTitle>
				</CardHeader>
				<CardContent>
					{results.participants.length === 0 ? (
						<div className="text-center py-12">
							<Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
							<p className="text-gray-500">No participants yet</p>
						</div>
					) : (
						<div className="space-y-3">
							{/* Table Header */}
							<div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-500">
								<div className="col-span-4">Email</div>
								<div className="col-span-2">Status</div>
								{results.isQuiz && <div className="col-span-2">Score</div>}
								<div className="col-span-2">Time</div>
								<div className={results.isQuiz ? "col-span-2" : "col-span-4"}>Submitted</div>
							</div>

							{/* Participant Rows */}
							{results.participants.map((participant) => (
								<div key={participant.sessionId} className="border rounded-lg overflow-hidden">
									{/* Main Row */}
									<div 
										className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 items-center cursor-pointer hover:bg-gray-50 transition-colors"
										onClick={() => toggleParticipant(participant.sessionId)}
									>
										{/* Email */}
										<div className="md:col-span-4 flex items-center space-x-2">
											<Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
											<span className="truncate font-medium">{participant.email}</span>
											{participant.totalAttempts > 1 && (
												<Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
													{participant.totalAttempts} attempts
												</Badge>
											)}
											{results.isQuiz && participant.tabSwitchCount !== undefined && participant.tabSwitchCount > 0 && (
												<Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
													<AlertTriangle className="h-3 w-3 mr-1" />
													{participant.tabSwitchCount} tab switch{participant.tabSwitchCount > 1 ? 'es' : ''}
												</Badge>
											)}
										</div>

										{/* Status */}
										<div className="md:col-span-2">
											<Badge variant={participant.status === 'COMPLETED' ? 'default' : 'secondary'}>
												{participant.status === 'COMPLETED' ? (
													<CheckCircle className="h-3 w-3 mr-1" />
												) : (
													<Clock className="h-3 w-3 mr-1" />
												)}
												{participant.status}
											</Badge>
										</div>

										{/* Score (Quiz only) */}
										{results.isQuiz && (
											<div className="md:col-span-2">
												{participant.score !== undefined ? (
													<div className="flex flex-col">
														<div className="flex items-center space-x-2">
															<span className={`font-semibold ${participant.passed ? 'text-green-600' : 'text-red-600'}`}>
																{participant.score}/{participant.totalPoints}
															</span>
															<span className="text-sm text-gray-500">
																({participant.percentage?.toFixed(0)}%)
															</span>
															{participant.passed !== undefined && (
																<Badge variant={participant.passed ? "default" : "destructive"} className="text-xs">
																	{participant.passed ? 'Pass' : 'Fail'}
																</Badge>
															)}
														</div>
														{participant.bestScore !== undefined &&
														 participant.bestScore > (participant.score || 0) && (
															<span className="text-xs text-green-600 mt-0.5">
																Best: {participant.bestScore}/{participant.totalPoints} ({participant.bestPercentage?.toFixed(0)}%)
															</span>
														)}
													</div>
												) : (
													<span className="text-gray-400">—</span>
												)}
											</div>
										)}

										{/* Time */}
										<div className="md:col-span-2 flex items-center space-x-1 text-gray-600">
											<Timer className="h-4 w-4" />
											<span>{participant.timeTakenSeconds ? formatTime(participant.timeTakenSeconds) : '—'}</span>
										</div>

										{/* Submitted At */}
										<div className={`${results.isQuiz ? 'md:col-span-2' : 'md:col-span-4'} flex items-center justify-between`}>
											<span className="text-sm text-gray-500">
												{participant.completedAt ? formatDate(participant.completedAt) : 'In progress'}
											</span>
											{expandedParticipant === participant.sessionId ? (
												<ChevronUp className="h-4 w-4 text-gray-400" />
											) : (
												<ChevronDown className="h-4 w-4 text-gray-400" />
											)}
										</div>
									</div>

									{/* Expanded Details */}
									{expandedParticipant === participant.sessionId && (
										<div className="border-t bg-gray-50 px-4 py-4 space-y-4">
											{/* Participant Info Section */}
											{participant.participantInfo && Object.keys(participant.participantInfo).length > 0 && (
												<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
													<h4 className="font-medium mb-2 text-blue-800 flex items-center gap-2">
														<Users className="h-4 w-4" />
														Participant Information
													</h4>
													<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
														{Object.entries(participant.participantInfo).map(([key, value]) => (
															<div key={key} className="text-sm">
																<span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}: </span>
																<span className="font-medium text-gray-800">{String(value)}</span>
															</div>
														))}
													</div>
												</div>
											)}

											{/* Device/Browser Info Section */}
											{(participant.browserName || participant.osName || participant.deviceType) && (
												<div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
													<h4 className="font-medium mb-2 text-gray-700 flex items-center gap-2">
														{participant.deviceType === 'mobile' ? (
															<Smartphone className="h-4 w-4" />
														) : participant.deviceType === 'tablet' ? (
															<Tablet className="h-4 w-4" />
														) : (
															<Monitor className="h-4 w-4" />
														)}
														Device & Browser Info
													</h4>
													<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
														{participant.browserName && (
															<div>
																<span className="text-gray-500">Browser: </span>
																<span className="font-medium text-gray-800">
																	{participant.browserName} {participant.browserVersion}
																</span>
															</div>
														)}
														{participant.osName && (
															<div>
																<span className="text-gray-500">OS: </span>
																<span className="font-medium text-gray-800">{participant.osName}</span>
															</div>
														)}
														{participant.deviceType && (
															<div>
																<span className="text-gray-500">Device: </span>
																<span className="font-medium text-gray-800 capitalize">{participant.deviceType}</span>
															</div>
														)}
														{participant.ipAddress && (
															<div>
																<span className="text-gray-500">IP: </span>
																<span className="font-medium text-gray-800 font-mono text-xs">{participant.ipAddress}</span>
															</div>
														)}
													</div>
												</div>
											)}

											<div>
												<h4 className="font-medium mb-3">Answers ({participant.answers.length})</h4>
												<div className="space-y-3">
													{participant.answers.map((answer, idx) => (
														<AnswerCard
															key={answer.questionId}
															answer={answer}
															index={idx + 1}
															isQuiz={results.isQuiz}
															editedMarks={getMarks(participant.sessionId, answer)}
															onMarksChange={results.isQuiz ? (marks: number) => handleMarkEdit(participant.sessionId, answer.questionId, marks) : undefined}
														/>
													))}
												</div>
											</div>

											{/* Save Marks & Notify Buttons (quiz only) */}
											{results.isQuiz && participant.status === 'COMPLETED' && (
												<div className="pt-4 border-t border-gray-200 flex flex-wrap gap-3">
													<Button
														size="sm"
														onClick={(e) => { e.stopPropagation(); handleSaveMarks(participant); }}
														disabled={savingSession === participant.sessionId || !hasEdits(participant.sessionId)}
													>
														{savingSession === participant.sessionId ? (
															<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
														) : (
															<><Save className="h-4 w-4 mr-2" />Save Marks{hasEdits(participant.sessionId) ? ' *' : ''}</>
														)}
													</Button>
													{participant.email && participant.email.includes('@') ? (
													<Button
														variant="outline"
														size="sm"
														onClick={(e) => { e.stopPropagation(); handleNotifyParticipant(participant); }}
														disabled={notifyingSession === participant.sessionId}
													>
														{notifyingSession === participant.sessionId ? (
															<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
														) : (
															<><Send className="h-4 w-4 mr-2" />Save &amp; Notify Participant</>
														)}
													</Button>
												) : (
													<Button variant="outline" size="sm" disabled className="text-gray-400">
														<Send className="h-4 w-4 mr-2" />Anonymous — No Email
													</Button>
												)}
												</div>
											)}

											{/* Reset Participant Button */}
											<div className="pt-4 border-t border-gray-200">
												<Button
													variant="outline"
													size="sm"
													className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
													onClick={(e) => {
														e.stopPropagation();
														handleResetParticipant(participant.email);
													}}
													disabled={resettingEmail === participant.email}
												>
													{resettingEmail === participant.email ? (
														<>
															<Loader2 className="h-4 w-4 mr-2 animate-spin" />
															Resetting...
														</>
													) : (
														<>
															<RotateCcw className="h-4 w-4 mr-2" />
															Reset Participant (Allow Retake)
														</>
													)}
												</Button>
												<p className="text-xs text-gray-500 mt-2">
													This will delete all sessions for this participant, allowing them to take the survey again.
												</p>
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// Helper to check if a value is an uploaded image URL
function isImageUrl(value: any): string | null {
	const str = typeof value === 'string' ? value : value?.value;
	if (typeof str === 'string' && str.startsWith('/uploads/')) return str;
	return null;
}

// Build full image URL from a relative /uploads/ path
function buildImageUrl(path: string): string {
	if (path.startsWith('http')) return path;
	const base = process.env.NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL || 'http://localhost:5173';
	return `${base}${path}`;
}

// Answer Card Component
function AnswerCard({ answer, index, isQuiz, editedMarks, onMarksChange }: {
	answer: AnswerDetail;
	index: number;
	isQuiz: boolean;
	editedMarks?: number;
	onMarksChange?: (marks: number) => void;
}) {
	const formatAnswer = (value: any): string => {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'object') {
			if (value.value !== undefined) {
				if (Array.isArray(value.value)) {
					return value.value.join(', ');
				}
				return String(value.value);
			}
			return JSON.stringify(value);
		}
		return String(value);
	};

	const imageUrl = isImageUrl(answer.userAnswer);
	const currentMarks = editedMarks ?? answer.pointsEarned ?? 0;
	const isEdited = editedMarks !== undefined && editedMarks !== (answer.pointsEarned ?? 0);

	return (
		<div className={`p-3 rounded-lg ${isQuiz && answer.isCorrect !== undefined ? (answer.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200') : 'bg-white border border-gray-200'}`}>
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center space-x-2 mb-1">
						<span className="text-xs font-medium text-gray-500">Q{index}</span>
						<span className="text-xs text-gray-400">•</span>
						<span className="text-xs text-gray-500">{answer.questionType}</span>
					</div>
					<p className="text-sm font-medium text-gray-800 mb-2">{answer.questionText}</p>
					{imageUrl ? (
						<div className="mt-2">
							<span className="text-gray-500 text-sm flex items-center gap-1 mb-2">
								<ImageIcon className="h-3 w-3" /> Uploaded Image:
							</span>
							<a href={buildImageUrl(imageUrl)} target="_blank" rel="noopener noreferrer">
								<img
									src={buildImageUrl(imageUrl)}
									alt="Participant upload"
									className="max-h-48 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
								/>
							</a>
						</div>
					) : answer.questionType === 'rating' ? (
						<RatingDisplay value={answer.userAnswer} />
					) : (
						<div className="text-sm">
							<span className="text-gray-500">Answer: </span>
							<span className="font-medium">{formatAnswer(answer.userAnswer)}</span>
						</div>
					)}
					{isQuiz && answer.correctAnswer && (
						<div className="text-sm mt-1">
							<span className="text-gray-500">Correct: </span>
							<span className="font-medium text-green-700">{formatAnswer(answer.correctAnswer)}</span>
						</div>
					)}
					<JustificationDisplay justification={answer.justification} className="mt-2" />
				</div>
				{isQuiz && answer.pointsPossible !== undefined && (
					<div className="text-right ml-4 flex flex-col items-end gap-1">
						{onMarksChange ? (
							<div className="flex items-center gap-1">
								<Input
									type="number"
									min={0}
									max={answer.pointsPossible}
									value={currentMarks}
									onChange={(e) => onMarksChange(Math.min(Number(e.target.value) || 0, answer.pointsPossible ?? 0))}
									className={`w-16 h-8 text-center text-sm font-bold ${isEdited ? 'border-blue-500 bg-blue-50' : ''}`}
								/>
								<span className="text-gray-400 font-bold">/</span>
								<span className="text-sm font-medium text-gray-600">{answer.pointsPossible}</span>
							</div>
						) : (
							<div className={`text-lg font-bold ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
								{answer.pointsEarned}/{answer.pointsPossible}
							</div>
						)}
						<div className="text-xs text-gray-500">
							{isEdited ? <span className="text-blue-600">edited</span> : 'points'}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// AnalyticsDashboard is dynamically imported from @/components/analytics/AnalyticsDashboard
// to avoid recharts SSR issues in Next.js production builds

// Render rating answer as stars
function RatingDisplay({ value }: { value: any }) {
	let rating = 0;
	if (typeof value === 'number') rating = value;
	else if (typeof value === 'object' && value?.value !== undefined) rating = Number(value.value);
	else rating = Number(value) || 0;

	const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

	return (
		<div className="text-sm">
			<span className="text-gray-500">Rating: </span>
			<span className="inline-flex items-center gap-0.5 ml-1">
				{[1, 2, 3, 4, 5].map(i => (
					<Star
						key={i}
						className={`w-4 h-4 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
					/>
				))}
				<span className="ml-2 font-medium text-gray-700">{rating}/5</span>
				{labels[rating] && <span className="ml-1 text-gray-500">({labels[rating]})</span>}
			</span>
		</div>
	);
}
