"use client";

import { Navbar } from "@/components/navbar";
import { SurveyTable } from "@/components/survey-table";
import type { Survey } from "@/types/survey";

const draftSurveys: Survey[] = [
	{
		id: "1",
		name: "Customer Satisfaction Q1",
		prizePool: "$500",
		dueDate: "Mar 1, 2024",
		status: "draft",
	},
	{
		id: "2",
		name: "Employee Feedback 2024",
		prizePool: "$1000",
		dueDate: "Mar 15, 2024",
		status: "draft",
	},
];

const ongoingSurveys: Survey[] = [
	{
		id: "3",
		name: "Product Feature Survey",
		prizePool: "$750",
		dueDate: "Feb 28, 2024",
		responses: "2k / 10k",
		status: "ongoing",
	},
	{
		id: "4",
		name: "User Experience Study",
		prizePool: "$1200",
		dueDate: "Mar 5, 2024",
		responses: "500 / 1000",
		status: "ongoing",
	},
];

const completedSurveys: Survey[] = [
	{
		id: "5",
		name: "Website Redesign Feedback",
		prizePool: "$600",
		dueDate: "Feb 1, 2024",
		responses: "1000 / 1000",
		status: "completed",
	},
	{
		id: "6",
		name: "Marketing Campaign Survey",
		prizePool: "$800",
		dueDate: "Jan 15, 2024",
		responses: "5000 / 5000",
		status: "completed",
	},
];

export default function Home() {
	return (
		<div className="min-h-screen bg-background">
			<main className="container mx-auto py-6 space-y-8">
				<SurveyTable title="Drafts" surveys={draftSurveys} />
				<SurveyTable
					title="On Going Surveys"
					surveys={ongoingSurveys}
					showResponses
				/>
				<SurveyTable
					title="Completed"
					surveys={completedSurveys}
					showResponses
				/>
			</main>
		</div>
	);
}
