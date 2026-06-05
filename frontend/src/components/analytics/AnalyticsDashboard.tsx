"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronUp, ChevronDown, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import type { SurveyResultsResponse } from "@/services/participantService";

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AnalyticsDashboard({ results }: { results: SurveyResultsResponse }) {
	const [showAnalytics, setShowAnalytics] = useState(true);
	const completed = results.participants.filter(p => p.status === 'COMPLETED');

	const deviceData = (() => {
		const counts: Record<string, number> = {};
		results.participants.forEach(p => {
			const device = p.deviceType || 'unknown';
			counts[device] = (counts[device] || 0) + 1;
		});
		return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
	})();

	const scoreDistribution = (() => {
		if (!results.isQuiz) return [];
		const buckets = [
			{ range: '0-20%', min: 0, max: 20, count: 0 },
			{ range: '20-40%', min: 20, max: 40, count: 0 },
			{ range: '40-60%', min: 40, max: 60, count: 0 },
			{ range: '60-80%', min: 60, max: 80, count: 0 },
			{ range: '80-100%', min: 80, max: 101, count: 0 },
		];
		completed.forEach(p => {
			if (p.percentage !== undefined) {
				const bucket = buckets.find(b => p.percentage! >= b.min && p.percentage! < b.max);
				if (bucket) bucket.count++;
			}
		});
		return buckets.map(b => ({ name: b.range, count: b.count }));
	})();

	const passFail = (() => {
		if (!results.isQuiz) return [];
		let passed = 0, failed = 0;
		completed.forEach(p => {
			if (p.passed === true) passed++;
			else if (p.passed === false) failed++;
		});
		return [
			{ name: 'Passed', value: passed },
			{ name: 'Failed', value: failed },
		].filter(d => d.value > 0);
	})();

	const questionDifficulty = (() => {
		if (!results.isQuiz) return [];
		const qStats: Record<number, { text: string; correct: number; total: number }> = {};
		completed.forEach(p => {
			p.answers.forEach(a => {
				if (!qStats[a.questionId]) qStats[a.questionId] = { text: a.questionText, correct: 0, total: 0 };
				qStats[a.questionId].total++;
				if (a.isCorrect) qStats[a.questionId].correct++;
			});
		});
		return Object.entries(qStats)
			.map(([id, s], i) => ({
				name: `Q${i + 1}`,
				fullName: s.text.length > 30 ? s.text.substring(0, 30) + '…' : s.text,
				correctPct: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
			}))
			.sort((a, b) => a.correctPct - b.correctPct);
	})();

	const timeDistribution = (() => {
		const buckets = [
			{ range: '0-5m', max: 300, count: 0 },
			{ range: '5-10m', max: 600, count: 0 },
			{ range: '10-20m', max: 1200, count: 0 },
			{ range: '20-30m', max: 1800, count: 0 },
			{ range: '30m+', max: Infinity, count: 0 },
		];
		completed.forEach(p => {
			if (p.timeTakenSeconds) {
				const bucket = buckets.find(b => p.timeTakenSeconds! <= b.max);
				if (bucket) bucket.count++;
			}
		});
		return buckets.map(b => ({ name: b.range, count: b.count }));
	})();

	const tabSwitchDistribution = (() => {
		if (!results.isQuiz) return [];
		const buckets = [
			{ range: '0', min: 0, max: 0, count: 0 },
			{ range: '1-2', min: 1, max: 2, count: 0 },
			{ range: '3-5', min: 3, max: 5, count: 0 },
			{ range: '5+', min: 6, max: Infinity, count: 0 },
		];
		completed.forEach(p => {
			const ts = p.tabSwitchCount ?? 0;
			const bucket = buckets.find(b => ts >= b.min && ts <= b.max);
			if (bucket) bucket.count++;
		});
		return buckets.map(b => ({ name: b.range, count: b.count }));
	})();

	const completionFunnel = (() => {
		if (results.isQuiz) return [];
		return [
			{ name: 'Started', count: results.totalSessions },
			{ name: 'Completed', count: results.completedSessions },
			{ name: 'In Progress', count: results.inProgressSessions },
		];
	})();

	const responsesPerDay = (() => {
		const dayCounts: Record<string, number> = {};
		completed.forEach(p => {
			if (p.completedAt) {
				const day = new Date(p.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
				dayCounts[day] = (dayCounts[day] || 0) + 1;
			}
		});
		return Object.entries(dayCounts).map(([name, count]) => ({ name, count }));
	})();

	const questionResponseRate = (() => {
		if (results.isQuiz) return [];
		const qCounts: Record<number, { text: string; count: number }> = {};
		results.participants.forEach(p => {
			p.answers.forEach(a => {
				if (!qCounts[a.questionId]) qCounts[a.questionId] = { text: a.questionText, count: 0 };
				qCounts[a.questionId].count++;
			});
		});
		return Object.entries(qCounts).map(([id, s], i) => ({
			name: `Q${i + 1}`,
			fullName: s.text.length > 30 ? s.text.substring(0, 30) + '…' : s.text,
			responses: s.count,
		}));
	})();

	return (
		<Card>
			<CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowAnalytics(!showAnalytics)}>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Target className="h-5 w-5 text-purple-600" />
						Analytics
					</CardTitle>
					{showAnalytics ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
				</div>
			</CardHeader>
			{showAnalytics && (
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{results.isQuiz && scoreDistribution.length > 0 && (
							<ChartCard title="Score Distribution">
								<ResponsiveContainer width="100%" height={220}>
									<BarChart data={scoreDistribution}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis dataKey="name" fontSize={12} />
										<YAxis allowDecimals={false} fontSize={12} />
										<Tooltip />
										<Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
						{results.isQuiz && passFail.length > 0 && (
							<ChartCard title="Pass / Fail">
								<ResponsiveContainer width="100%" height={220}>
									<PieChart>
										<Pie data={passFail} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
											<Cell fill="#10b981" />
											<Cell fill="#ef4444" />
										</Pie>
										<Tooltip />
										<Legend />
									</PieChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
						{results.isQuiz && questionDifficulty.length > 0 && (
							<ChartCard title="Question Difficulty (% correct, hardest first)">
								<ResponsiveContainer width="100%" height={Math.max(220, questionDifficulty.length * 32)}>
									<BarChart data={questionDifficulty} layout="vertical">
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis type="number" domain={[0, 100]} fontSize={12} tickFormatter={(v: number) => `${v}%`} />
										<YAxis type="category" dataKey="name" fontSize={12} width={40} />
										<Tooltip formatter={(v: number) => `${v}%`} labelFormatter={(label: string) => questionDifficulty.find(d => d.name === label)?.fullName || label} />
										<Bar dataKey="correctPct" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
									</BarChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
						{results.isQuiz && tabSwitchDistribution.some(d => d.count > 0) && (
							<ChartCard title="Tab Switches (Anti-Cheating)">
								<ResponsiveContainer width="100%" height={220}>
									<BarChart data={tabSwitchDistribution}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis dataKey="name" fontSize={12} />
										<YAxis allowDecimals={false} fontSize={12} />
										<Tooltip />
										<Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
						{!results.isQuiz && completionFunnel.length > 0 && (
							<ChartCard title="Completion Funnel">
								<ResponsiveContainer width="100%" height={220}>
									<BarChart data={completionFunnel}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis dataKey="name" fontSize={12} />
										<YAxis allowDecimals={false} fontSize={12} />
										<Tooltip />
										<Bar dataKey="count" radius={[4, 4, 0, 0]}>
											{completionFunnel.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
						{!results.isQuiz && questionResponseRate.length > 0 && (
							<ChartCard title="Responses per Question">
								<ResponsiveContainer width="100%" height={Math.max(220, questionResponseRate.length * 32)}>
									<BarChart data={questionResponseRate} layout="vertical">
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis type="number" allowDecimals={false} fontSize={12} />
										<YAxis type="category" dataKey="name" fontSize={12} width={40} />
										<Tooltip labelFormatter={(label: string) => questionResponseRate.find(d => d.name === label)?.fullName || label} />
										<Bar dataKey="responses" fill="#3b82f6" radius={[0, 4, 4, 0]} />
									</BarChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
						{timeDistribution.some(d => d.count > 0) && (
							<ChartCard title="Time Taken">
								<ResponsiveContainer width="100%" height={220}>
									<BarChart data={timeDistribution}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis dataKey="name" fontSize={12} />
										<YAxis allowDecimals={false} fontSize={12} />
										<Tooltip />
										<Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
						{responsesPerDay.length > 1 && (
							<ChartCard title="Responses Over Time">
								<ResponsiveContainer width="100%" height={220}>
									<BarChart data={responsesPerDay}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis dataKey="name" fontSize={12} />
										<YAxis allowDecimals={false} fontSize={12} />
										<Tooltip />
										<Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
						{deviceData.length > 0 && (
							<ChartCard title="Device Breakdown">
								<ResponsiveContainer width="100%" height={220}>
									<PieChart>
										<Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
											{deviceData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
										</Pie>
										<Tooltip />
										<Legend />
									</PieChart>
								</ResponsiveContainer>
							</ChartCard>
						)}
					</div>
				</CardContent>
			)}
		</Card>
	);
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="border rounded-lg p-4">
			<h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
			{children}
		</div>
	);
}
