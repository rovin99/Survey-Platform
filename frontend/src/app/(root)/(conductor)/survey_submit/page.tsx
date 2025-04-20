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
	const surveyId = searchParams.get("id") || "4"; // Default to sample survey ID 4 for testing

	const [survey, setSurvey] = useState<Survey | null>(null); 
    const [session, setSession] = useState<SurveySession | null>(null);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [responses, setResponses] = useState<Record<string, any>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [hasSubmitted, setHasSubmitted] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
                
                // Fetch session and draft from backend
                const result = await participantService.startOrResume(surveyId);
                
                console.log("Result from API:", result);
                
                // Validate API response structure
                if (!result) {
                    toast.error("Invalid API response: empty response");
                    throw new Error("Invalid API response: empty response");
                }
                
                // Safely extract data with fallbacks
                const { session: sessionData, draft: draftData, survey: surveyData } = result || {};
                
                if (!sessionData || !surveyData) {
                    const errorMessage = "Invalid response: Missing session or survey data";
                    toast.error(errorMessage);
                    throw new Error(errorMessage);
                }
                
                console.log("Survey data received:", surveyData);
                console.log("Survey questions:", surveyData.questions);
                
                setSurvey(surveyData);
                setSession(sessionData);
                
                // Check if we have a local draft in localStorage
                let localDraft = null;
                if (sessionData?.id) {
                    try {
                        const localDraftData = localStorage.getItem(`survey_response_${sessionData.id}`);
                        if (localDraftData) {
                            localDraft = JSON.parse(localDraftData);
                        }
                    } catch (e) {
                        console.error("Error parsing local draft:", e);
                    }
                }
                
                // Determine which draft to use (backend or local) based on timestamps
                let draftToUse = draftData;
                let draftResponses = {};
                
                if (localDraft && draftData) {
                    // Convert dates to comparable format
                    const backendDate = new Date(draftData.lastSaved).getTime();
                    const localDate = new Date(localDraft.timestamp).getTime();
                    
                    // Compare timestamps and use the most recent draft
                    if (localDate > backendDate) {
                        console.log("Using local draft (more recent)");
                        draftToUse = localDraft;
                    } else {
                        console.log("Using backend draft (more recent)");
                    }
                } else if (localDraft && !draftData) {
                    // Only have local draft
                    console.log("Using local draft (no backend draft)");
                    draftToUse = localDraft;
                }
                
                // Process the selected draft
                if (draftToUse) {
                    // Handle different formats from different sources
                    if (draftToUse === localDraft) {
                        // Local draft format
                        draftResponses = localDraft.answers || {};
                        
                        // If we have a local lastQuestionId, use that
                        if (localDraft.lastQuestionId) {
                            const localLastIndex = surveyData?.questions.findIndex(
                                (q) => q.id === localDraft.lastQuestionId
                            ) ?? -1;
                            setCurrentIndex(localLastIndex >= 0 ? localLastIndex : 0);
                        }
                        setLastSaved(new Date(localDraft.timestamp));
                    } else {
                        // Backend draft format
                        // Handle both string and object formats
                        if (typeof draftToUse.draftAnswersContent === 'string') {
                            try {
                                draftResponses = JSON.parse(draftToUse.draftAnswersContent);
                            } catch (e) {
                                console.error("Error parsing draft content:", e);
                            }
                        } else {
                            draftResponses = draftToUse.draftAnswersContent;
                        }
                        
                        // Set last question index from session data
                        if (sessionData?.lastQuestionId) {
                            const lastIndex = surveyData?.questions.findIndex(
                                (q) => q.id === sessionData.lastQuestionId
                            ) ?? -1;
                            setCurrentIndex(lastIndex >= 0 ? lastIndex : 0);
                        }
                        setLastSaved(new Date(draftToUse.lastSaved));
                    }
                } else {
                    // No draft at all
                    setCurrentIndex(-1);
                }
                
                setResponses(draftResponses || {});
                initialLoadComplete.current = true;
			} catch (error) {
				console.error("Error loading survey/session:", error);
				toast.error("Failed to load survey session");
			} finally {
				setIsLoading(false);
			}
		};

		fetchInitialData();
	}, [surveyId]);


    // --- Auto-Save Draft ---
    const debouncedSaveDraft = useCallback(
        debounce(async (sessionId: number, lastQuestionId: number | null, currentResponses: Record<string, any>) => {
            if (!sessionId || !initialLoadComplete.current) return;

            const currentQuestionModel = survey?.questions?.[currentIndex];
            const currentQuestionModelId = currentQuestionModel ? currentQuestionModel.id : null;

            // Save to localStorage as backup
            const timestamp = new Date().toISOString();
            try {
                localStorage.setItem(`survey_response_${sessionId}`, JSON.stringify({
                    answers: currentResponses,
                    lastQuestionId: currentQuestionModelId,
                    timestamp
                }));
            } catch (e) {
                console.error("Error saving to localStorage:", e);
            }

            setIsSavingDraft(true);
            try {
                await participantService.saveDraft(sessionId, currentQuestionModelId, currentResponses);
                setLastSaved(new Date());
            } catch (error) {
                console.error("Failed to save draft:", error);
                if (Math.random() < 0.3) {
                    toast.error("Failed to save progress. Please check connection.", { duration: 2000 });
                }
            } finally {
                setIsSavingDraft(false);
            }
        }, 1500),
        [survey?.questions, currentIndex]
    );

    // Trigger draft save when responses or current question changes
    useEffect(() => {
        if (session?.id && currentIndex > -1 && initialLoadComplete.current) { // Only save when in a question screen and after initial load
            debouncedSaveDraft(session.id, currentIndex, responses);
        }
    }, [responses, currentIndex, session?.id, debouncedSaveDraft]);
    // --- End Auto-Save ---


	const currentQuestion = survey?.questions[currentIndex];

	const handleStart = () => {
        if (survey?.questions && survey.questions.length > 0) {
            console.log("Starting survey with questions:", survey.questions);
            setCurrentIndex(0); // Go to the first question
        } else {
            console.log("No questions found in survey:", survey);
            toast.info("This survey has no questions.");
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
			const answersToSubmit: FinalAnswerInput[] = Object.entries(responses)
			    .filter(([_, value]) => value !== undefined && value !== null && value !== "") // Filter out empty responses
			    .map(([questionIdStr, value]) => ({
				    questionId: parseInt(questionIdStr, 10),
				    responseData: value, // Send the raw value (string, number, array, etc.)
			    }));

			await participantService.submitSurvey(session.id, answersToSubmit);
			setHasSubmitted(true);
			toast.success("Survey submitted successfully!");
		} catch (error: any) {
            if (error?.response?.status === 409 || 
                error?.response?.data?.error === "survey session is not in progress") {
                 toast.error("This survey has already been submitted or is no longer active.");
                 setHasSubmitted(true); // Treat as submitted to prevent further action
            } else {
			    toast.error("Failed to submit survey");
                console.error("Submission failed:", error);
            }
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
        console.log("Rendering question:", question);
        const questionIdStr = question.id.toString();
        const responseValue = responses[questionIdStr];
        const questionType = question.question_type.toLowerCase();

		switch (questionType) {
			case "multiple-choice":
			case "multiple_choice":
			case "multiplechoice":
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

			case "rating":
			case "rating_scale":
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
            
            {lastSaved && (
                <div className="fixed top-4 left-4 z-50 text-xs text-gray-500 dark:text-gray-400">
                    Last saved: {lastSaved.toLocaleTimeString()}
                </div>
            )}
            
			<div className="text-center mb-6 max-w-2xl">
				<h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{survey.title}</h1>
                 {currentIndex === -1 && ( // Show description only on start screen
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