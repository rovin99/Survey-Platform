"use client";

import { ChevronRight, Download, Share } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

// Sample data
const metrics: SurveyMetrics = {
	prizePool: {
		current: 2000,
		total: 5000,
	},
	progress: 65,
	responses: 1234,
	averageTime: "5m 30s",
};

const timeSeriesData: TimeSeriesData[] = Array.from({ length: 30 }, (_, i) => ({
	timestamp: `2024-02-${(i + 1).toString().padStart(2, "0")}`,
	responses: Math.floor(Math.random() * 50) + 10,
}));

const distributionData: DistributionData = {
	gender: [
		{ name: "Male", value: 45 },
		{ name: "Female", value: 40 },
		{ name: "Other", value: 15 },
	],
	geography: [
		{ name: "North America", value: 40 },
		{ name: "Europe", value: 30 },
		{ name: "Asia", value: 20 },
		{ name: "Others", value: 10 },
	],
	age: [
		{ range: "18-24", count: 20 },
		{ range: "25-34", count: 35 },
		{ range: "35-44", count: 25 },
		{ range: "45-54", count: 15 },
		{ range: "55+", count: 5 },
	],
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function SurveyResults() {
	const [surveyEnded, setSurveyEnded] = useState(false);

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

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				<CircularProgress
					value={(metrics.prizePool.current / metrics.prizePool.total) * 100}
					label="Prize Pool"
					sublabel={`$${metrics.prizePool.current} / $${metrics.prizePool.total}`}
				/>
				<CircularProgress
					value={metrics.progress}
					label="Progress"
					sublabel="Based on due date"
				/>
				<div className="space-y-4">
					<Card>
						<CardContent className="p-4">
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">Responses</p>
								<p className="text-2xl font-bold">{metrics.responses}</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">Average Time</p>
								<p className="text-2xl font-bold">{metrics.averageTime}</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			<Card>
				<CardContent className="p-6">
					<h3 className="font-semibold mb-4">Response Timeline</h3>
					<div className="h-[300px]">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={timeSeriesData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="timestamp" />
								<YAxis />
								<Tooltip />
								<Line type="monotone" dataKey="responses" stroke="#8884d8" />
							</LineChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-6 md:grid-cols-3">
				<Card>
					<CardContent className="p-6">
						<h3 className="font-semibold mb-4">Gender Distribution</h3>
						<div className="h-[200px]">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={distributionData.gender}
										cx="50%"
										cy="50%"
										innerRadius={40}
										outerRadius={80}
										fill="#8884d8"
										dataKey="value"
										label
									>
										{distributionData.gender.map((_, index) => (
											<Cell
												key={`cell-${index}`}
												fill={COLORS[index % COLORS.length]}
											/>
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<h3 className="font-semibold mb-4">Geographic Distribution</h3>
						<div className="h-[200px]">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={distributionData.geography}
										cx="50%"
										cy="50%"
										innerRadius={40}
										outerRadius={80}
										fill="#8884d8"
										dataKey="value"
										label
									>
										{distributionData.geography.map((_, index) => (
											<Cell
												key={`cell-${index}`}
												fill={COLORS[index % COLORS.length]}
											/>
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<h3 className="font-semibold mb-4">Age Distribution</h3>
						<div className="h-[200px]">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={distributionData.age}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="range" />
									<YAxis />
									<Tooltip />
									<Bar dataKey="count" fill="#8884d8" />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
