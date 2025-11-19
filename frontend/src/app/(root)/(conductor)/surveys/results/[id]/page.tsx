"use client";

import { ChevronRight, Download, Share, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import { CircularProgress } from "@/components/circular-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
	DistributionData,
	SurveyMetrics,
	TimeSeriesData,
} from "@/types/survey-results";
import { participantService, type SurveyResultsResponse } from "@/services/participantService";
import { toast } from "sonner";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function SurveyResults() {
	const params = useParams();
	const surveyId = params.id as string;
	const [surveyEnded, setSurveyEnded] = useState(false);
	const [loading, setLoading] = useState(true);
	const [results, setResults] = useState<SurveyResultsResponse | null>(null);

	useEffect(() => {
		fetchResults();
	}, [surveyId]);

	const fetchResults = async () => {
		try {
			setLoading(true);
			const data = await participantService.getSurveyResults(parseInt(surveyId));
			setResults(data);
		} catch (error: any) {
			console.error('Error fetching survey results:', error);
			toast.error('Failed to load survey results');
		} finally {
			setLoading(false);
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
				<div className="text-center">
					<p className="text-gray-600">No results found for this survey.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-2 text-sm text-muted-foreground">
					<Link href="/surveys" className="hover:text-foreground">
						Surveys
					</Link>
					<ChevronRight className="h-4 w-4" />
					<span className="text-foreground">Customer Satisfaction Q1</span>
				</div>
				<div className="flex items-center space-x-2">
					<Button
						variant={surveyEnded ? "secondary" : "destructive"}
						onClick={() => setSurveyEnded(!surveyEnded)}
					>
						{surveyEnded ? "Ended" : "End"}
					</Button>
					<Button variant="outline">
						<Share className="mr-2 h-4 w-4" />
						Share
					</Button>
					<Button variant="outline">
						<Download className="mr-2 h-4 w-4" />
						Export
					</Button>
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent className="p-4">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">Total Sessions</p>
							<p className="text-2xl font-bold">{results.totalSessions}</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">Completed</p>
							<p className="text-2xl font-bold text-green-600">{results.completedSessions}</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">In Progress</p>
							<p className="text-2xl font-bold text-yellow-600">{results.inProgressSessions}</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">Completion Rate</p>
							<p className="text-2xl font-bold text-blue-600">
								{results.totalSessions > 0
									? Math.round((results.completedSessions / results.totalSessions) * 100)
									: 0}%
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardContent className="p-6">
					<h3 className="font-semibold mb-4">Survey Responses</h3>
					{results.sessions.length === 0 ? (
						<div className="text-center py-12">
							<p className="text-gray-500">No completed responses yet</p>
						</div>
					) : (
						<div className="space-y-4">
							{results.sessions.map((session, index) => (
								<div key={session.sessionId} className="border border-gray-200 rounded-lg p-4">
									<div className="flex items-center justify-between mb-3">
										<div>
											<h4 className="font-medium">Response #{index + 1}</h4>
											<p className="text-sm text-gray-500">
												Participant ID: {session.participantId} | Submitted: {new Date(session.createdAt).toLocaleString()}
											</p>
										</div>
										<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
											session.status === 'COMPLETED'
												? 'bg-green-100 text-green-800'
												: 'bg-yellow-100 text-yellow-800'
										}`}>
											{session.status}
										</span>
									</div>
									<div className="grid gap-2">
										<p className="text-sm font-medium text-gray-700">Answers: {session.answers.length} questions answered</p>
										<details className="text-sm">
											<summary className="cursor-pointer text-blue-600 hover:text-blue-800">
												View detailed responses
											</summary>
											<div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200">
												{session.answers.map((answer) => (
													<div key={answer.questionId} className="py-2">
														<p className="font-medium text-gray-700">Question ID: {answer.questionId}</p>
														<p className="text-gray-600">
															Answer: {typeof answer.responseData === 'object'
																? JSON.stringify(answer.responseData)
																: String(answer.responseData)}
														</p>
													</div>
												))}
											</div>
										</details>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
