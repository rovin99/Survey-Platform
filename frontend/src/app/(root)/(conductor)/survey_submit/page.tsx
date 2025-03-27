"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { surveyService } from "@/services/surveyService";
import type { Survey, Question, Answer } from "@/services/surveyService";

export default function Survey() {
	const searchParams = useSearchParams();
	const surveyId = searchParams.get("id");

	const [survey, setSurvey] = useState<Survey | null>(null);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [responses, setResponses] = useState<Record<string, string>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [hasSubmitted, setHasSubmitted] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchSurveyData = async () => {
			if (!surveyId) {
				toast.error("Survey ID is required");
				return;
			}

			try {
				setIsLoading(true);
				const surveyData = await surveyService.getSurvey(surveyId);
				setSurvey(surveyData);

				// Check for existing progress
				const progress = await surveyService.getProgress(surveyId);
				if (progress.currentQuestionIndex > -1) {
					setCurrentIndex(progress.currentQuestionIndex);
				}
			} catch (error) {
				toast.error("Failed to load survey");
				console.error("Error loading survey:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchSurveyData();
	}, [surveyId]);

	// Track progress using local storage
	useEffect(() => {
		if (surveyId) {
			const savedData = localStorage.getItem(`surveyProgress_${surveyId}`);
			if (savedData) {
				const { index, responses } = JSON.parse(savedData);
				setCurrentIndex(index);
				setResponses(responses);
			}
		}
	}, [surveyId]);

	useEffect(() => {
		if (surveyId) {
			localStorage.setItem(
				`surveyProgress_${surveyId}`,
				JSON.stringify({ index: currentIndex, responses })
			);
		}
	}, [currentIndex, responses, surveyId]);

	const currentQuestion = survey?.questions[currentIndex];

	const handleStart = () => setCurrentIndex(0);
	const handleReturn = () => setCurrentIndex(-1);

	const handlePrevious = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		if (currentQuestion) {
			setErrors((prevErrors) => ({ ...prevErrors, [currentQuestion.id]: "" }));
		}

		setCurrentIndex((prev) => {
			if (prev === 0) return -1;
			return Math.max(0, prev - 1);
		});
	};

	const handleNext = () => {
		if (!currentQuestion) return;

		const questionId = currentQuestion.id;
		const response = responses[questionId];

		if (currentQuestion.mandatory && !response) {
			setErrors((prevErrors) => ({
				...prevErrors,
				[questionId]: "This question is required",
			}));
			return;
		}

		setErrors((prevErrors) => ({ ...prevErrors, [questionId]: "" }));
		setCurrentIndex((prev) => Math.min((survey?.questions.length || 0) - 1, prev + 1));
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!surveyId) return;

		setIsSubmitting(true);
		try {
			const answers: Answer[] = Object.entries(responses).map(([questionId, value]) => ({
				questionId: parseInt(questionId),
				value,
			}));

			await surveyService.submitAnswers(surveyId, answers);
			localStorage.removeItem(`surveyProgress_${surveyId}`);
			setHasSubmitted(true);
			toast.success("Survey submitted successfully!");
		} catch (error) {
			toast.error("Failed to submit survey");
			console.error("Submission failed:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const renderQuestionInput = (question: Question) => {
		switch (question.question_type) {
			case "multiple-choice":
				const options = question.correct_answers.split(",").map(opt => opt.trim());
				return (
					<div className="flex flex-col gap-2">
						{options.map((option, idx) => (
							<Button
								key={option}
								type="button"
								variant={
									responses[question.id] === option
										? "default"
										: "outline"
								}
								className="w-full justify-start"
								onClick={() =>
									setResponses((prev) => ({
										...prev,
										[question.id]: option,
									}))
								}
							>
								<span className="mr-2 text-muted-foreground">
									{idx + 1}.
								</span>
								{option}
							</Button>
						))}
					</div>
				);

			case "text":
				return (
					<div className="space-y-4">
						<textarea
							name={question.id.toString()}
							className="w-full p-2 border rounded-md min-h-[100px]"
							placeholder="Type your response..."
							value={responses[question.id] || ""}
							onChange={(e) =>
								setResponses((prev) => ({
									...prev,
									[question.id]: e.target.value,
								}))
							}
							maxLength={500}
							autoFocus
						/>
						<div className="text-sm text-muted-foreground text-right">
							{responses[question.id]?.length || 0}/500
						</div>
					</div>
				);

			case "rating":
				return (
					<div className="flex justify-center gap-2">
						{[1, 2, 3, 4, 5].map((rating) => (
							<Button
								key={rating}
								type="button"
								variant={
									responses[question.id] === rating.toString()
										? "default"
										: "outline"
								}
								onClick={() =>
									setResponses((prev) => ({
										...prev,
										[question.id]: rating.toString(),
									}))
								}
							>
								{rating}
							</Button>
						))}
					</div>
				);

			default:
				return null;
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (!survey) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4">
				<h1 className="text-2xl font-bold text-red-500">Survey not found</h1>
			</div>
		);
	}

	if (hasSubmitted) {
		return (
			<div className="flex flex-col items-center justify-center h-screen p-4 text-center">
				<CheckCircle className="h-16 w-16 text-green-500 mb-4" />
				<h1 className="text-2xl font-bold mb-2">Thank you!</h1>
				<p className="text-muted-foreground">
					Your responses have been submitted successfully.
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
				<div className="text-center">
					<h1 className="text-2xl font-bold">{survey.title}</h1>
				</div>
				{currentIndex === -1 ? (
					<Card className="mb-6 max-w-md mx-auto border border-gray-200 shadow-md bg-white dark:bg-gray-900 dark:border-gray-700 p-4">
						<CardHeader className="p-4">
							<p className="text-sm text-gray-500 dark:text-gray-400">
								{survey.description}
							</p>
						</CardHeader>
						<CardContent className="p-4 text-sm text-gray-700 dark:text-gray-300">
							<p className="font-medium">Conducted by:</p>
							<p>Survey Platform</p>
						</CardContent>
						<CardFooter className="p-4 flex justify-between">
							<Button
								variant="outline"
								onClick={handleReturn}
								className="px-4 py-2 rounded-lg border-gray-300 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
							>
								Return
							</Button>
							<Button
								variant="default"
								onClick={handleStart}
								className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
							>
								Start
							</Button>
						</CardFooter>
					</Card>
				) : (
					<Card className="w-full max-w-lg shadow-lg transition-all duration-300">
						<CardHeader>
							<CardTitle className="text-lg">
								{currentQuestion?.question_text}
								{currentQuestion?.mandatory && (
									<span className="text-red-500 ml-1">*</span>
								)}
							</CardTitle>
						</CardHeader>

						<CardContent>
							{currentQuestion && renderQuestionInput(currentQuestion)}
							{errors[currentQuestion?.id || ""] && (
								<p className="text-sm text-destructive mt-2">
									{errors[currentQuestion?.id || ""]}
								</p>
							)}
						</CardContent>

						<CardFooter className="flex justify-between items-center">
							<div className="flex gap-2">
								<Button variant="outline" onClick={handlePrevious}>
									Previous
								</Button>
								<Button
									type="button"
									variant={
										currentIndex === (survey.questions.length - 1)
											? "default"
											: "outline"
									}
									onClick={
										currentIndex === (survey.questions.length - 1)
											? handleSubmit
											: handleNext
									}
									disabled={isSubmitting}
								>
									{isSubmitting && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									{currentIndex === (survey.questions.length - 1)
										? isSubmitting
											? "Submitting..."
											: "Submit"
										: "Next"}
								</Button>
							</div>
							<p className="text-sm text-muted-foreground">
								Question {currentIndex + 1} of {survey.questions.length}
							</p>
						</CardFooter>
					</Card>
				)}

				<Progress
					value={((currentIndex + 1) / (survey.questions.length || 1)) * 100}
					className="w-full max-w-lg"
				/>
			</div>
		</form>
	);
}
