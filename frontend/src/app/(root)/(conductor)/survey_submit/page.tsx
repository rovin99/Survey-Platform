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
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
// Assume a new service or additions to surveyService for participant endpoints
import { participantService } from "@/services/participantService"; // NEW or Updated Service
import type { Survey, Question } from "@/services/surveyService"; // Keep existing types if survey data comes from elsewhere
import type { SurveySession, ParticipantSurveyDraft, FinalAnswerInput } from "@/services/participantService"; // NEW Types

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    return new Promise((resolve) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => resolve(func(...args)), waitFor);
    });
  };
}

// Main component
function SurveyComponentInner() { 
	const searchParams = useSearchParams();
	const surveyId = searchParams.get("id");

	const [survey, setSurvey] = useState<Survey | null>(null); 
    const [session, setSession] = useState<SurveySession | null>(null);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [responses, setResponses] = useState<Record<string, any>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [hasSubmitted, setHasSubmitted] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
    const [isSavingDraft, setIsSavingDraft] = useState(false);

    // Ref to track if initial load is done to prevent premature draft saves
    const initialLoadComplete = useRef(false);

	// Fetch Survey Structure and Session/Draft Data on Load
	useEffect(() => {
		const fetchInitialData = async () => {
			if (!surveyId) {
				toast.error("Survey ID is required");
                setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
                // 1. Fetch Survey Structure (assuming this is still needed from old service or combined)
                //    If participantService.startOrResume also returns survey details, adjust accordingly.
                // const surveyData = await surveyService.getSurvey(surveyId);
                // setSurvey(surveyData);

                // 2. Call the new backend endpoint to start/resume session and get draft
                const { session: sessionData, draft: draftData, survey: surveyData } = await participantService.startOrResume(surveyId); // Adjust if survey data comes separately
                setSurvey(surveyData); // Set survey structure
				setSession(sessionData);

                // Restore state from session and draft
				if (sessionData?.lastQuestionId) {
                    // Find index corresponding to lastQuestionId
                    const lastIndex = surveyData?.questions.findIndex((q: Question) => q.id === sessionData.lastQuestionId) ?? -1;
                    setCurrentIndex(lastIndex >= 0 ? lastIndex : 0); // Go to last question or first if ID invalid
                } else {
                    setCurrentIndex(-1); // Go to start screen if no progress saved in session
                }

				if (draftData?.draftAnswersContent) {
					// Backend returns JSON, parse it (GORM might return map[string]interface{} directly)
                    // Ensure draftData.draftAnswersContent is parsed if it's a string
                    const draftResponses = typeof draftData.draftAnswersContent === 'string'
                        ? JSON.parse(draftData.draftAnswersContent)
                        : draftData.draftAnswersContent;
					setResponses(draftResponses || {});
				} else {
                    setResponses({}); // Start with empty responses if no draft
                }
                initialLoadComplete.current = true; // Mark initial load as done

			} catch (error) {
				toast.error("Failed to load survey session");
				console.error("Error loading survey/session:", error);
                // Handle specific errors, e.g., 401 Unauthorized
			} finally {
				setIsLoading(false);
			}
		};

		fetchInitialData();
	}, [surveyId]);


    // --- Auto-Save Draft ---
    const debouncedSaveDraft = useCallback(
        debounce(async (sessionId: number, lastQuestionId: number | null, currentResponses: Record<string, any>) => {
            if (!sessionId || !initialLoadComplete.current) return; // Don't save if no session or initial load pending

            // Find the ID of the currently viewed question
            const currentQuestionModel = survey?.questions?.[lastQuestionId ?? -1]; // Use currentIndex state
            const currentQuestionModelId = currentQuestionModel ? currentQuestionModel.id : null;


            setIsSavingDraft(true);
            console.log("Attempting to save draft:", { sessionId, lastQuestionId: currentQuestionModelId, currentResponses });
            try {
                await participantService.saveDraft(sessionId, currentQuestionModelId, currentResponses);
                console.log("Draft saved successfully");
                // Optionally show a subtle saving indicator/toast
            } catch (error) {
                console.error("Failed to save draft:", error);
                toast.error("Failed to save progress. Please check connection.", { duration: 2000 });
            } finally {
                setIsSavingDraft(false);
            }
        }, 1500), // Debounce time: 1.5 seconds
    [survey?.questions]); // Dependency includes survey questions to correctly map index to ID

    useEffect(() => {
        if (session?.id && currentIndex > -1) { // Only save when in a question screen
            debouncedSaveDraft(session.id, currentIndex, responses);
        }
    }, [currentIndex, responses, session?.id, debouncedSaveDraft]);
    // --- End Auto-Save ---


	const currentQuestion = survey?.questions[currentIndex];

	const handleStart = () => {
        if (survey?.questions && survey.questions.length > 0) {
            setCurrentIndex(0); // Go to the first question
        } else {
            toast.info("This survey has no questions.");
            // Maybe submit immediately or show a different message
        }
    };
	const handleReturn = () => {
        // Navigate back or close survey logic
        window.history.back(); // Example
    };

	const handlePrevious = (event?: React.MouseEvent<HTMLButtonElement>) => { // Make event optional
		event?.preventDefault();
		if (currentQuestion) {
			setErrors((prevErrors) => ({ ...prevErrors, [currentQuestion.id.toString()]: "" }));
		}
		setCurrentIndex((prev) => Math.max(-1, prev - 1)); // Allow going back to start screen
	};

	const handleNext = () => {
		if (!currentQuestion) return;

		const questionId = currentQuestion.id.toString(); // Ensure key is string for responses object
		const response = responses[questionId];

		if (currentQuestion.mandatory && (response === undefined || response === null || response === "")) {
			setErrors((prevErrors) => ({
				...prevErrors,
				[questionId]: "This question is required",
			}));
			return;
		}

		setErrors((prevErrors) => ({ ...prevErrors, [questionId]: "" }));
        if (currentIndex < (survey?.questions.length || 0) - 1) {
		    setCurrentIndex((prev) => prev + 1);
        }
	};

	const handleSubmit = async (event?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => { // Allow button click trigger
		event?.preventDefault();
		if (!surveyId || !session?.id || !survey) return;

        // Final validation check before submitting (optional, depends on flow)
        if (currentQuestion?.mandatory) {
            const questionId = currentQuestion.id.toString();
            const response = responses[questionId];
             if (response === undefined || response === null || response === "") {
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    [questionId]: "This question is required before submitting",
                }));
                return; // Stop submission if last question mandatory and unanswered
            }
             setErrors((prevErrors) => ({ ...prevErrors, [questionId]: "" }));
        }


		setIsSubmitting(true);
		try {
			// Format answers correctly for the backend DTO (FinalAnswerInput)
			const answersToSubmit: FinalAnswerInput[] = Object.entries(responses).map(([questionIdStr, value]) => ({
				questionId: parseInt(questionIdStr, 10),
				responseData: value, // Send the raw value (string, number, array, etc.)
			}));

			await participantService.submitSurvey(session.id, answersToSubmit);
			// No need to remove localStorage item anymore
			setHasSubmitted(true);
			toast.success("Survey submitted successfully!");
		} catch (error: any) {
            if (error?.response?.data?.error === "Session not in progress") {
                 toast.error("This survey has already been submitted or is no longer active.");
                 setHasSubmitted(true); // Treat as submitted to prevent further action
            } else {
			    toast.error("Failed to submit survey");
            }
			console.error("Submission failed:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

    // Centralized response update function
    const handleResponseChange = (questionId: number | string, value: any) => {
        setResponses(prev => ({
            ...prev,
            [questionId.toString()]: value,
        }));
         // Clear error on change
        setErrors((prevErrors) => ({ ...prevErrors, [questionId.toString()]: "" }));
    };


	// --- Render Functions (Minor adjustments) ---
	const renderQuestionInput = (question: Question) => {
        const questionIdStr = question.id.toString();
        const responseValue = responses[questionIdStr];

		switch (question.question_type) {
			case "multiple-choice":
				// Parse options from correct_answers string
				const options = question.correct_answers?.split(',').map(opt => opt.trim()) || [];

				return (
					<div className="flex flex-col gap-2">
						{options.map((option, idx) => (
							<Button
								key={`option-${idx}`}
								type="button"
								variant={
									responseValue === option
										? "default"
										: "outline"
								}
								className="w-full justify-start text-left h-auto py-2"
                                style={{ whiteSpace: 'normal' }}
								onClick={() => handleResponseChange(question.id, option)}
							>
								<span className="mr-2 text-muted-foreground">
									{String.fromCharCode(65 + idx)} {/* A, B, C... */}
								</span>
								{option}
							</Button>
						))}
					</div>
				);

			case "text":
				return (
					<div className="space-y-2">
						<textarea
							name={questionIdStr}
							className="w-full p-2 border rounded-md min-h-[100px] dark:bg-gray-800 dark:border-gray-700"
							placeholder="Type your response..."
							value={responseValue || ""}
							onChange={(e) => handleResponseChange(question.id, e.target.value)}
							maxLength={500} // Consider making this configurable
							autoFocus
						/>
						<div className="text-sm text-muted-foreground text-right">
							{(responseValue || "").length}/500
						</div>
					</div>
				);

			case "rating": // Assuming rating is 1-5 stored as string or number
				return (
					<div className="flex justify-center gap-2 flex-wrap">
						{[1, 2, 3, 4, 5].map((rating) => (
							<Button
								key={rating}
								type="button"
								variant={
									// Ensure comparison handles string/number type mismatch
                                    responseValue?.toString() === rating.toString()
										? "default"
										: "outline"
								}
								onClick={() => handleResponseChange(question.id, rating)} // Store as number
                                className="min-w-[40px]"
							>
								{rating}
							</Button>
						))}
					</div>
				);

            // Add cases for other question types (checkbox, dropdown, etc.)

			default:
                console.warn("Unsupported question type:", question.question_type);
				return <p className="text-red-500">Unsupported question type: {question.question_type}</p>;
		}
	};

    // --- Loading / Not Found / Submitted States (Mostly unchanged) ---
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2">Loading Survey...</span>
			</div>
		);
	}

	if (!survey || !session) { // Check for session as well
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
				<h1 className="text-2xl font-bold text-red-500 mb-4">Survey Session Error</h1>
                <p className="text-muted-foreground">Could not load the survey or session.</p>
                <p className="text-muted-foreground">Please ensure you are logged in and the survey ID is correct.</p>
                <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
			</div>
		);
	}

	if (hasSubmitted) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
				<CheckCircle className="h-16 w-16 text-green-500 mb-4" />
				<h1 className="text-2xl font-bold mb-2">Thank you!</h1>
				<p className="text-muted-foreground">
					Your responses have been submitted successfully.
				</p>
                {/* Add link back to dashboard or elsewhere */}
                <Button onClick={() => window.location.href = '/dashboard'} className="mt-4">Go to Dashboard</Button>
			</div>
		);
	}

    // --- Main Render ---
	return (
		// Use a form only if traditional submission is an option, otherwise div is fine
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-950">
            {isSavingDraft && (
                <div className="fixed top-4 right-4 z-50 bg-gray-700 text-white text-xs px-2 py-1 rounded shadow flex items-center">
                    <Loader2 className="h-3 w-3 animate-spin mr-1"/> Saving...
                </div>
            )}
			<div className="text-center mb-6 max-w-2xl">
				<h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{survey.title}</h1>
                 {currentIndex > -1 && ( // Show description only on start screen? Or always?
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {survey.description}
                    </p>
                 )}
			</div>

			{currentIndex === -1 ? ( // Start Screen
				<Card className="w-full max-w-md mx-auto border border-gray-200 shadow-md bg-white dark:bg-gray-900 dark:border-gray-700">
					<CardHeader className="p-6 border-b dark:border-gray-700">
                        <CardTitle className="text-lg text-center">Survey Instructions</CardTitle>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
							{survey.description || "Please read the instructions carefully before starting."}
						</p>
					</CardHeader>
					<CardContent className="p-6 text-sm text-gray-700 dark:text-gray-300">
						<p><span className="font-medium">Number of Questions:</span> {survey.questions?.length || 0}</p>
						{/* Add more details if available: estimated time, conductor info etc */}
                        <p className="mt-2"><span className="font-medium">Conducted by:</span> Survey Platform</p>
					</CardContent>
					<CardFooter className="p-6 flex justify-between border-t dark:border-gray-700">
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
							disabled={!survey.questions || survey.questions.length === 0}
							className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
						>
							Start Survey
						</Button>
					</CardFooter>
				</Card>
			) : ( // Question Screen
				<Card className="w-full max-w-2xl shadow-lg transition-all duration-300 bg-white dark:bg-gray-900">
					<CardHeader className="p-6 border-b dark:border-gray-700">
						<div className="flex justify-between items-center mb-2">
                            <CardTitle className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                                {currentQuestion?.question_text}
                                {currentQuestion?.mandatory && (
                                    <span className="text-red-500 ml-1">*</span>
                                )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground whitespace-nowrap">
                                Question {currentIndex + 1} of {survey.questions.length}
                            </p>
                        </div>
                        {/* Optional: Add question description if available */}
					</CardHeader>

					<CardContent className="p-6">
						{currentQuestion && renderQuestionInput(currentQuestion)}
						{errors[currentQuestion?.id.toString() || ""] && (
							<p className="text-sm text-destructive mt-2">
								{errors[currentQuestion?.id.toString() || ""]}
							</p>
						)}
					</CardContent>

					<CardFooter className="p-6 flex justify-between items-center border-t dark:border-gray-700">
						<Button variant="outline" onClick={handlePrevious} disabled={isSubmitting}>
							{currentIndex === 0 ? "Back to Start" : "Previous"}
						</Button>
                        <div className="flex-grow mx-4">
                             <Progress
                                value={((currentIndex + 1) / (survey.questions.length || 1)) * 100}
                                className="w-full"
                            />
                        </div>
						<Button
							type="button" // Changed from submit unless inside a form
                            variant={currentIndex === survey.questions.length - 1 ? "default" : "outline"}
							onClick={
								currentIndex === survey.questions.length - 1
									? handleSubmit // Directly call submit handler
									: handleNext
							}
							disabled={isSubmitting}
                            className="min-w-[110px] flex justify-center items-center" // Ensure consistent width
						>
							{isSubmitting && currentIndex === survey.questions.length - 1 ? ( // Show spinner only on last step submit
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							{currentIndex === survey.questions.length - 1
								? isSubmitting ? "Submitting..." : "Submit"
								: "Next"}
						</Button>
					</CardFooter>
				</Card>
			)}

            {/* Progress bar moved inside the CardFooter for question view */}
            {/* {currentIndex > -1 && (
                <Progress
                    value={((currentIndex + 1) / (survey.questions.length || 1)) * 100}
                    className="w-full max-w-2xl mt-6"
                />
            )} */}
		</div>
	);
}

// Wrapper component with Suspense boundary
export default function SurveyComponent() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2">Loading...</span>
            </div>
        }>
            <SurveyComponentInner />
        </Suspense>
    );
}