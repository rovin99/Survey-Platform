"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { surveyTakingService } from "@/services/surveyTaking.service";
import { QuestionRenderer } from "@/components/survey-taking/QuestionRenderer";
import { QuizTimer } from "@/components/quiz/QuizTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Save, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SessionResponse, SurveyQuestion } from "@/types/survey-taking";

export default function SurveyTakePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const surveyId = parseInt(params.id as string);

  // State
  const [sessionData, setSessionData] = useState<SessionResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const hasAutoSubmittedRef = useRef(false);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!user?.roles?.includes("Participating")) {
      toast.error("You need to register as a participant");
      router.push("/role-selection");
      return;
    }

    startSession();
  }, [isAuthenticated, user, surveyId]);

  // Start or resume session
  const startSession = async () => {
    try {
      setLoading(true);
      const data = await surveyTakingService.startOrResumeSession(surveyId);
      setSessionData(data);

      // Set quiz start time if it's a quiz
      if (data.survey.isQuiz && data.survey.timeLimitMinutes) {
        setQuizStartTime(new Date(data.session.createdAt));
      }

      // Restore draft if exists
      if (data.draft) {
        try {
          // Backend returns draft_answers_content as object, not draftContent as string
          let draftData;

          // Check if draft_answers_content exists (from backend)
          if ((data.draft as any).draft_answers_content) {
            draftData = (data.draft as any).draft_answers_content;
          }
          // Fallback to draftContent if it's a string (old format)
          else if (data.draft.draftContent) {
            draftData = JSON.parse(data.draft.draftContent);
          }

          if (draftData) {
            // Backend stores answers directly, frontend stores in nested structure
            if (draftData.answers) {
              setAnswers(draftData.answers);
            } else {
              // If draft_answers_content is the answers object itself
              setAnswers(draftData);
            }

            if (draftData.currentQuestionIndex !== undefined) {
              setCurrentIndex(draftData.currentQuestionIndex);
            }
            toast.info("Resumed your previous session");
          }
        } catch (error) {
          console.error("Error parsing draft:", error);
        }
      }
    } catch (error: any) {
      console.error("Error starting session:", error);
      toast.error(error.message || "Failed to load survey");
      router.push("/surveys/browse");
    } finally {
      setLoading(false);
    }
  };

  // Handle answer change
  const handleAnswerChange = useCallback((questionId: number, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }, []);

  // Save draft
  const saveDraft = async (showToast = true) => {
    if (!sessionData?.session) return;

    try {
      setSaving(true);

      // Backend expects draftAnswers as object with structure:
      // { answers: {...}, currentQuestionIndex: number, savedAt: string }
      const draftAnswers = {
        answers,
        currentQuestionIndex: currentIndex,
        savedAt: new Date().toISOString(),
      };

      await surveyTakingService.saveDraft(sessionData.session.id, {
        lastQuestionId: sessionData.survey.questions[currentIndex]?.id,
        draftAnswers: draftAnswers,
      });

      setLastAutoSave(new Date());
      if (showToast) {
        toast.success("Progress saved");
      }
    } catch (error) {
      console.error("Save error:", error);
      if (showToast) {
        toast.error("Failed to save progress");
      }
    } finally {
      setSaving(false);
    }
  };

  // Auto-save effect - saves every 30 seconds when answers change
  useEffect(() => {
    if (!sessionData || Object.keys(answers).length === 0) return;

    const autoSaveInterval = setInterval(() => {
      saveDraft(false); // Silent auto-save
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [answers, sessionData, currentIndex]);

  // Navigation
  // Process branching logic to determine next question
  const getNextQuestionIndex = (currentIdx: number): number | 'END' => {
    if (!sessionData) return currentIdx + 1;

    const currentQuestion = sessionData.survey.questions[currentIdx];
    const answer = answers[currentQuestion.id];

    // Parse branching logic if exists
    let branchingRules: any[] = [];
    if (currentQuestion.branchingLogic) {
      try {
        const parsed = JSON.parse(currentQuestion.branchingLogic);
        branchingRules = parsed.rules || [];
      } catch (error) {
        console.error('Error parsing branching logic:', error);
      }
    }

    // Evaluate branching rules
    for (const rule of branchingRules) {
      let matches = false;

      // Check if answer matches the rule
      if (currentQuestion.questionType === 'single-choice') {
        matches = answer === rule.value;
      } else if (currentQuestion.questionType === 'multiple-choice' && Array.isArray(answer)) {
        matches = answer.includes(rule.value);
      }

      // If rule matches, apply the action
      if (matches) {
        if (rule.action === 'end_survey') {
          return 'END';
        } else if (rule.action === 'skip_to' && rule.targetQuestionIndex !== undefined) {
          // Convert question number to zero-based index
          return rule.targetQuestionIndex - 1;
        }
      }
    }

    // No branching rules matched - proceed to next question
    return currentIdx + 1;
  };

  const handleNext = () => {
    if (!sessionData) return;

    const nextIndex = getNextQuestionIndex(currentIndex);

    if (nextIndex === 'END') {
      // Branching logic says end survey
      setShowSubmitDialog(true);
    } else if (nextIndex >= sessionData.survey.questions.length) {
      // Reached the end naturally
      setShowSubmitDialog(true);
    } else {
      // Move to next question (or skipped question)
      setCurrentIndex(nextIndex);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Check if can proceed (mandatory questions)
  const canProceed = useCallback(() => {
    if (!sessionData) return false;

    const currentQuestion = sessionData.survey.questions[currentIndex];
    if (!currentQuestion.mandatory) return true;

    const answer = answers[currentQuestion.id];
    if (!answer) return false;

    // Check based on question type
    if (currentQuestion.questionType === "multiple-choice") {
      return Array.isArray(answer) && answer.length > 0;
    }
    if (currentQuestion.questionType === "text") {
      return answer.trim().length > 0;
    }
    return answer !== undefined && answer !== null;
  }, [sessionData, currentIndex, answers]);

  // Handle quiz timer expiration
  const handleTimeExpired = useCallback(async () => {
    if (hasAutoSubmittedRef.current || isSubmitting) return;

    hasAutoSubmittedRef.current = true;
    toast.warning("Time's up! Submitting your quiz...");

    // Auto-submit without validation
    await handleSubmit(true);
  }, [isSubmitting]);

  // Submit survey
  const handleSubmit = async (isAutoSubmit = false) => {
    if (!sessionData) return;

    // Validate all mandatory questions (skip validation for auto-submit)
    if (!isAutoSubmit) {
      const unansweredMandatory = sessionData.survey.questions.filter(
        (q) => q.mandatory && !answers[q.id]
      );

      if (unansweredMandatory.length > 0) {
        toast.error(`Please answer all required questions (${unansweredMandatory.length} remaining)`);
        setShowSubmitDialog(false);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Convert answers to API format
      const answerArray = Object.entries(answers).map(([questionId, value]) => ({
        questionId: parseInt(questionId),
        responseData: JSON.stringify({ value }),
      }));

      await surveyTakingService.submitSurvey(sessionData.session.id, {
        answers: answerArray,
        completedAt: new Date().toISOString(),
      });

      // For quizzes, redirect to results page instead of generic complete page
      if (sessionData.survey.isQuiz) {
        toast.success("Quiz submitted! Loading results...");
        router.push(`/survey/quiz-results/${sessionData.session.id}`);
      } else {
        toast.success("Survey submitted successfully!");
        router.push(`/survey/complete?sessionId=${sessionData.session.id}`);
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Failed to submit survey");
      hasAutoSubmittedRef.current = false; // Reset flag on error
    } finally {
      setIsSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Survey</h2>
          <p className="text-gray-600 mb-4">Survey not found or you don't have access</p>
          <Button onClick={() => router.push("/surveys/browse")}>
            Back to Browse
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = sessionData.survey.questions[currentIndex];
  const progress = ((currentIndex + 1) / sessionData.survey.questions.length) * 100;
  const isLastQuestion = currentIndex === sessionData.survey.questions.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Fixed Progress Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50">
        <div className="container mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{sessionData.survey.title}</h2>
                {sessionData.survey.isQuiz && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    <Clock className="h-3 w-3 mr-1" />
                    Quiz Mode
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">
                  Question {currentIndex + 1} of {sessionData.survey.questions.length}
                </p>
                {lastAutoSave && !sessionData.survey.isQuiz && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Auto-saved
                  </span>
                )}
              </div>
            </div>

            {/* Quiz Timer or Progress Percentage */}
            {sessionData.survey.isQuiz && sessionData.survey.timeLimitMinutes && quizStartTime ? (
              <QuizTimer
                timeLimitMinutes={sessionData.survey.timeLimitMinutes}
                startTime={quizStartTime}
                onTimeExpired={handleTimeExpired}
                isSubmitting={isSubmitting}
              />
            ) : (
              <div className="text-right">
                <span className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</span>
                <p className="text-xs text-gray-500">Complete</p>
              </div>
            )}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-4xl px-4 pt-32 pb-12">
        {/* Question Card */}
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
            <CardContent className="p-8 md:p-12">
              {/* Question Header */}
              <div className="mb-8">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      {currentQuestion.questionType === "single-choice" && "Single Choice"}
                      {currentQuestion.questionType === "multiple-choice" && "Multiple Choice"}
                      {currentQuestion.questionType === "text" && "Text Response"}
                      {currentQuestion.questionType === "rating" && "Rating"}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                      {currentQuestion.questionText}
                    </h2>
                  </div>
                  {currentQuestion.mandatory && (
                    <Badge variant="destructive" className="shrink-0 shadow-sm">
                      Required
                    </Badge>
                  )}
                </div>
              </div>

              {/* Question Content */}
              <div className="mt-8">
                <QuestionRenderer
                  question={currentQuestion}
                  value={answers[currentQuestion.id]}
                  onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="sm:w-40 border-2 hover:bg-gray-50"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Previous
          </Button>

          <Button
            variant="ghost"
            size="lg"
            onClick={saveDraft}
            disabled={saving}
            className="flex items-center justify-center gap-2 hover:bg-white/80"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save & Exit
              </>
            )}
          </Button>

          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed()}
            className="sm:w-40 shadow-md hover:shadow-lg transition-shadow"
          >
            {isLastQuestion ? "Submit Survey" : "Next"}
            {!isLastQuestion && <ChevronRight className="h-5 w-5 ml-2" />}
          </Button>
        </div>

        {/* Helper Text */}
        {currentQuestion.mandatory && !answers[currentQuestion.id] && (
          <p className="text-center text-sm text-gray-500 mt-4">
            This question is required to continue
          </p>
        )}
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Survey?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to submit your responses. Once submitted, you cannot change your answers.
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Submit Survey"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

