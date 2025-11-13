"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { surveyTakingService } from "@/services/surveyTaking.service";
import { QuestionRenderer } from "@/components/survey-taking/QuestionRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Save, AlertCircle } from "lucide-react";
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

      // Restore draft if exists
      if (data.draft?.draftContent) {
        try {
          const draftContent = JSON.parse(data.draft.draftContent);
          if (draftContent.answers) {
            setAnswers(draftContent.answers);
          }
          if (draftContent.currentQuestionIndex !== undefined) {
            setCurrentIndex(draftContent.currentQuestionIndex);
          }
          toast.info("Resumed your previous session");
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
  const saveDraft = async () => {
    if (!sessionData?.session) return;

    try {
      setSaving(true);
      const draftContent = {
        answers,
        currentQuestionIndex: currentIndex,
        savedAt: new Date().toISOString(),
      };

      await surveyTakingService.saveDraft(sessionData.session.id, {
        lastQuestionId: sessionData.survey.questions[currentIndex]?.id,
        draftContent: JSON.stringify(draftContent),
      });

      toast.success("Progress saved");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save progress");
    } finally {
      setSaving(false);
    }
  };

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

  // Submit survey
  const handleSubmit = async () => {
    if (!sessionData) return;

    // Validate all mandatory questions
    const unansweredMandatory = sessionData.survey.questions.filter(
      (q) => q.mandatory && !answers[q.id]
    );

    if (unansweredMandatory.length > 0) {
      toast.error(`Please answer all required questions (${unansweredMandatory.length} remaining)`);
      setShowSubmitDialog(false);
      return;
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

      toast.success("Survey submitted successfully!");
      router.push(`/survey/complete?sessionId=${sessionData.session.id}`);
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Failed to submit survey");
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-3xl px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-4">
              <h1 className="text-2xl font-bold mb-2">{sessionData.survey.title}</h1>
              <p className="text-gray-600 text-sm">{sessionData.survey.description}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Question {currentIndex + 1} of {sessionData.survey.questions.length}</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Question */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="text-xl font-semibold flex-1">
                  {currentQuestion.questionText}
                </h2>
                {currentQuestion.mandatory && (
                  <Badge variant="destructive" className="shrink-0">
                    Required
                  </Badge>
                )}
              </div>
            </div>

            <QuestionRenderer
              question={currentQuestion}
              value={answers[currentQuestion.id]}
              onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center gap-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="w-32"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <Button
            variant="ghost"
            onClick={saveDraft}
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save & Exit
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="w-32"
          >
            {isLastQuestion ? "Submit" : "Next"}
            {!isLastQuestion && <ChevronRight className="h-4 w-4 ml-2" />}
          </Button>
        </div>
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

