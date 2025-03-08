"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Survey } from "@/types/survey";

interface SurveyTableProps {
	title: string;
	surveys: Survey[];
	showResponses?: boolean;
}

export function SurveyTable({
	title,
	surveys: initialSurveys,
	showResponses = false,
}: SurveyTableProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [surveys, setSurveys] = useState(initialSurveys);

	const handleSearch = (term: string) => {
		setSearchTerm(term);
		const filtered = initialSurveys.filter((survey) =>
			survey.name.toLowerCase().includes(term.toLowerCase()),
		);
		setSurveys(filtered);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">{title}</h2>
				<div className="flex items-center space-x-2">
					{title === "Drafts" && <Button>+ New</Button>}
					<div className="relative">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search..."
							value={searchTerm}
							onChange={(e) => handleSearch(e.target.value)}
							className="pl-8"
						/>
					</div>
				</div>
			</div>

			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Prize Pool</TableHead>
							{showResponses && <TableHead>Responses</TableHead>}
							<TableHead>Due Date</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{surveys.map((survey) => (
							<TableRow key={survey.id}>
								<TableCell>
									<Link
										href={`/survey/${survey.id}`}
										className="hover:underline"
									>
										{survey.name}
									</Link>
								</TableCell>
								<TableCell>{survey.prizePool}</TableCell>
								{showResponses && <TableCell>{survey.responses}</TableCell>}
								<TableCell>{survey.dueDate}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
