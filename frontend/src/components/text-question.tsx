"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TextQuestion } from "@/types/survey-analysis";
import { QuestionComments } from "./question-comments";

interface TextQuestionProps {
	question: TextQuestion;
}

export function TextQuestionView({ question }: TextQuestionProps) {
	return (
		<div className="grid grid-cols-3 gap-6">
			<Card className="col-span-2">
				<CardHeader>
					<CardTitle>{question.text}</CardTitle>
					<p className="text-sm text-muted-foreground">
						{question.responses.length} responses
					</p>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{question.responses.map((response, index) => (
							<div key={index} className="rounded-lg border p-4 text-sm">
								{response}
							</div>
						))}
					</div>
				</CardContent>
			</Card>
			<div>
				<QuestionComments comments={question.comments} />
			</div>
		</div>
	);
}
