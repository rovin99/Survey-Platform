"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import {
  evaluationService,
  type SessionForEvaluation,
  type QuestionEvaluationInput,
} from "@/services/evaluationService";
import { surveyService } from "@/services/surveyService";
import { Loader2, ArrowLeft, Save, Send, CheckCircle2, User } from "lucide-react";
import { toast } from "sonner";
import { debounce } from "perfect-debounce";
import { JustificationDisplay } from "@/components/quiz/JustificationDisplay";

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  points: number;
  correct_answers?: string;
  explanation?: string;
  options?: Array<{ id: number; option_text: string }>;
}

interface EvaluationState {
  marks_given: number;
  max_marks: number;
  feedback: string;
  saved: boolean;
}

export default function GradeSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const surveyId = Number(params.surveyId);
  const sessionId = Number(params.sessionId);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionData, setSessionData] = useState<SessionForEvaluation | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [evaluations, setEvaluations] = useState<Record<number, EvaluationState>>({});
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [surveyTitle, setSurveyTitle] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isAuthenticated && surveyId && sessionId) {
      loadData();
    }
  }, [authLoading, isAuthenticated, surveyId, sessionId]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load session data, survey questions, and survey info
      const [sessionResult, surveyData] = await Promise.all([
        evaluationService.getSessionForEvaluation(sessionId),
        surveyService.getSurvey(surveyId),
      ]);

      setSessionData(sessionResult);
      setQuestions(surveyData.questions || []);
      setSurveyTitle(surveyData.title || `Survey #${surveyId}`);

      // Initialize evaluation states from questions
      const initialEvaluations: Record<number, EvaluationState> = {};
      (surveyData.questions || []).forEach((q: Question) => {
        initialEvaluations[q.id] = {
          marks_given: 0,
          max_marks: q.points || 1,
          feedback: "",
          saved: false,
        };
      });
      setEvaluations(initialEvaluations);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load submission data");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save evaluation for a question
  const autoSaveEvaluation = useCallback(
    debounce(async (questionId: number, evaluation: EvaluationState) => {
      try {
        await evaluationService.saveQuestionEvaluation(sessionId, {
          question_id: questionId,
          marks_given: evaluation.marks_given,
          max_marks: evaluation.max_marks,
          feedback: evaluation.feedback,
        });
        setEvaluations((prev) => ({
          ...prev,
          [questionId]: { ...prev[questionId], saved: true },
        }));
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
    }, 1000),
    [sessionId]
  );

  const updateEvaluation = (questionId: number, field: keyof EvaluationState, value: number | string) => {
    setEvaluations((prev) => {
      const updated = {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          [field]: value,
          saved: false,
        },
      };

      // Trigger auto-save
      autoSaveEvaluation(questionId, updated[questionId]);

      return updated;
    });
  };

  const getAnswerForQuestion = (questionId: number) => {
    if (!sessionData?.answers) return null;
    return sessionData.answers.find((a) => a.question_id === questionId);
  };

  const parseResponseData = (responseData: string) => {
    try {
      return JSON.parse(responseData);
    } catch {
      return responseData;
    }
  };

  const renderAnswer = (question: Question) => {
    const answer = getAnswerForQuestion(question.id);
    if (!answer) {
      return <p className="text-muted-foreground italic">No answer provided</p>;
    }

    const parsed = parseResponseData(answer.response_data);

    let content: ReactNode;
    if (question.question_type === "MultipleChoice" || question.question_type === "multiple_choice") {
      const selectedIds = parsed.selected_option_ids || parsed.selectedOptionIds || [];
      content = (
        <div className="space-y-1">
          {question.options?.map((opt) => (
            <div
              key={opt.id}
              className={`p-2 rounded ${
                selectedIds.includes(opt.id)
                  ? "bg-primary/10 border border-primary"
                  : "bg-muted"
              }`}
            >
              {opt.option_text}
              {selectedIds.includes(opt.id) && " ✓"}
            </div>
          ))}
        </div>
      );
    } else if (question.question_type === "code" || question.question_type === "Code") {
      content = (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Language: {parsed.language || "Unknown"}
          </div>
          <pre className="bg-muted p-3 rounded overflow-x-auto text-sm">
            <code>{parsed.code || parsed.text || String(parsed)}</code>
          </pre>
        </div>
      );
    } else {
      // Text, long text, etc.
      content = (
        <div className="bg-muted p-3 rounded whitespace-pre-wrap">
          {parsed.text || parsed.value || String(parsed)}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {content}
        <JustificationDisplay justification={answer.justification} />
      </div>
    );
  };

  const calculateTotals = () => {
    let totalGiven = 0;
    let totalMax = 0;

    Object.values(evaluations).forEach((e) => {
      totalGiven += e.marks_given;
      totalMax += e.max_marks;
    });

    return { totalGiven, totalMax, percentage: totalMax > 0 ? (totalGiven / totalMax) * 100 : 0 };
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const evaluationInputs: QuestionEvaluationInput[] = Object.entries(evaluations).map(
        ([questionId, evaluation]) => ({
          question_id: Number(questionId),
          marks_given: evaluation.marks_given,
          max_marks: evaluation.max_marks,
          feedback: evaluation.feedback,
        })
      );

      await evaluationService.submitEvaluation(sessionId, {
        evaluations: evaluationInputs,
        notify_by_email: notifyByEmail,
      });

      toast.success("Evaluation submitted successfully!");
      router.push(`/surveys/evaluations/${surveyId}`);
    } catch (error) {
      console.error("Submit failed:", error);
      toast.error("Failed to submit evaluation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseParticipantInfo = (info?: string) => {
    if (!info) return null;
    try {
      return JSON.parse(info);
    } catch {
      return null;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const { totalGiven, totalMax, percentage } = calculateTotals();
  const participantInfo = parseParticipantInfo(sessionData?.session?.participant_info);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Pending Evaluations
      </Button>

      {/* Header Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Grade Submission</CardTitle>
          <p className="text-muted-foreground">{surveyTitle}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {sessionData?.session?.participant_email || "Anonymous Participant"}
              </p>
              {participantInfo?.name && (
                <p className="text-sm text-muted-foreground">{participantInfo.name}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => {
          const evaluation = evaluations[question.id] || {
            marks_given: 0,
            max_marks: question.points || 1,
            feedback: "",
            saved: false,
          };

          return (
            <Card key={question.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">Question {index + 1}</CardTitle>
                    <p className="mt-1">{question.question_text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Type: {question.question_type} | Max Points: {question.points || 1}
                    </p>
                  </div>
                  {evaluation.saved && (
                    <span className="flex items-center text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Saved
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Participant's Answer */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Participant&apos;s Answer:</h4>
                  {renderAnswer(question)}
                </div>

                {/* Correct Answer (if available) */}
                {question.correct_answers && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-green-600">Correct Answer:</h4>
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      {question.correct_answers}
                    </div>
                    {question.explanation && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Explanation:</strong> {question.explanation}
                      </p>
                    )}
                  </div>
                )}

                {/* Grading Section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium">Marks Given</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min={0}
                          max={evaluation.max_marks}
                          step={0.5}
                          value={evaluation.marks_given}
                          onChange={(e) =>
                            updateEvaluation(
                              question.id,
                              "marks_given",
                              Math.min(Number(e.target.value), evaluation.max_marks)
                            )
                          }
                          className="w-24"
                        />
                        <span className="text-muted-foreground">/ {evaluation.max_marks}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateEvaluation(question.id, "marks_given", 0)}
                      >
                        0
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateEvaluation(question.id, "marks_given", evaluation.max_marks / 2)
                        }
                      >
                        Half
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateEvaluation(question.id, "marks_given", evaluation.max_marks)
                        }
                      >
                        Full
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Feedback (Optional)</label>
                    <Textarea
                      placeholder="Add feedback for this question..."
                      value={evaluation.feedback}
                      onChange={(e) =>
                        updateEvaluation(question.id, "feedback", e.target.value)
                      }
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary and Submit */}
      <Card className="mt-6 sticky bottom-4 shadow-lg">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Score</p>
              <p className="text-2xl font-bold">
                {totalGiven.toFixed(1)} / {totalMax} ({percentage.toFixed(1)}%)
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="notify-email"
                  checked={notifyByEmail}
                  onCheckedChange={(checked) => setNotifyByEmail(checked === true)}
                />
                <label htmlFor="notify-email" className="text-sm cursor-pointer">
                  Notify participant by email
                </label>
              </div>

              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Evaluation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
