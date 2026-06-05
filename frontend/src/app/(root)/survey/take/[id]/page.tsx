"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { surveyTakingService } from "@/services/surveyTaking.service";
import { authService, ParticipantProfile } from "@/services/auth.service";
import { QuestionRenderer } from "@/components/survey-taking/QuestionRenderer";
import { QuizTimer } from "@/components/quiz/QuizTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Save, AlertCircle, Clock, User, Info, PlayCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SessionResponse, SurveyQuestion } from "@/types/survey-taking";
import { surveyApi } from "@/services/surveyApi";

// Custom participant field definition (from survey settings)
interface ParticipantField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'tel';
  required: boolean;
  placeholder?: string;
}

export default function SurveyTakePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const surveyId = parseInt(params.id as string);
  
  // Check for share token (allows anonymous access)
  const shareToken = searchParams.get("token");
  const tokenType = searchParams.get("type"); // 'invitation' or undefined for share links
  const isAnonymousAccess = !!shareToken;
  const isPreviewMode = searchParams.get("preview") === "true";

  // Fisher-Yates shuffle algorithm (creates a new shuffled array)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Resolve the quiz start timestamp for the timer. Prefer the server-persisted quiz_started_at
  // (set when the participant clicked "Start"); returns null for a fresh, not-yet-started session
  // so the timer doesn't begin while the intro is still open.
  const resolveQuizStart = (session: any): Date | null => {
    const value = session?.quiz_started_at || session?.quizStartedAt;
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  // State
  const [sessionData, setSessionData] = useState<SessionResponse | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<SurveyQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  // Participant-authored justifications per question (anti-cheating), keyed by question id
  const [reasons, setReasons] = useState<Record<number, string>>({});
  // Per-option justifications for multiple-choice, keyed by questionId → optionId → reason
  const [optionReasons, setOptionReasons] = useState<Record<number, Record<number, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [showParticipantInfoForm, setShowParticipantInfoForm] = useState(false);
  const [participantInfo, setParticipantInfo] = useState<Record<string, string>>({});
  const [participantFields, setParticipantFields] = useState<ParticipantField[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);
  const hasAutoSubmittedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const hasShuffledRef = useRef(false);
  const passwordRef = useRef<string | undefined>(undefined); // Store password for multi-step flows
  const hasFetchedProfileRef = useRef(false); // Track if we've already fetched the profile
  const tabSwitchCountRef = useRef(0); // Anti-cheating: track tab switches (ref to avoid stale closures)

  // Map participant profile fields to common survey field IDs
  const mapProfileToFields = (profile: ParticipantProfile, fields: ParticipantField[]): Record<string, string> => {
    const mapped: Record<string, string> = {};

    for (const field of fields) {
      const fieldId = field.id.toLowerCase();
      const fieldLabel = field.label.toLowerCase();

      // Match standard profile fields to survey fields by common patterns
      if (fieldId === 'name' || fieldId === 'full_name' || fieldId === 'fullname') {
        if (profile.name) mapped[field.id] = profile.name;
      } else if (fieldId === 'email' || fieldId === 'e-mail' || fieldId === 'email_address') {
        if (profile.email) mapped[field.id] = profile.email;
      } else if (fieldId === 'roll_no' || fieldId === 'rollno' || fieldId === 'roll_number' || fieldId === 'rollnumber' || fieldId === 'student_id') {
        if (profile.rollNo) mapped[field.id] = profile.rollNo;
      } else if (fieldId === 'phone' || fieldId === 'phone_number' || fieldId === 'phonenumber' || fieldId === 'mobile' || fieldId === 'contact') {
        if (profile.phoneNumber) mapped[field.id] = profile.phoneNumber;
      } else if (profile.customFields && profile.customFields.length > 0) {
        // Try to match custom fields by name (case-insensitive)
        const customField = profile.customFields.find(cf =>
          cf.name.toLowerCase() === fieldId ||
          cf.name.toLowerCase() === fieldLabel ||
          cf.name.toLowerCase().replace(/[\s_-]/g, '') === fieldId.replace(/[\s_-]/g, '') ||
          cf.name.toLowerCase().replace(/[\s_-]/g, '') === fieldLabel.replace(/[\s_-]/g, '')
        );
        if (customField && customField.value) {
          mapped[field.id] = customField.value;
        }
      }
    }

    return mapped;
  };

  // Fetch participant profile and auto-fill form fields
  const fetchAndFillProfile = async (fields: ParticipantField[]) => {
    // Only fetch for authenticated users and if not already fetched
    if (!isAuthenticated || hasFetchedProfileRef.current) return;
    hasFetchedProfileRef.current = true;

    try {
      const profile = await authService.getParticipantProfile();
      if (profile) {
        const mappedData = mapProfileToFields(profile, fields);
        if (Object.keys(mappedData).length > 0) {
          setParticipantInfo(prev => ({ ...mappedData, ...prev })); // Existing values take priority
          console.log('[DEBUG] Auto-filled participant info from profile:', mappedData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch participant profile for auto-fill:', error);
    }
  };

  // Effect to shuffle questions and options when session data is loaded
  useEffect(() => {
    if (!sessionData || hasShuffledRef.current) return;
    
    let questions = [...sessionData.survey.questions];
    
    if (sessionData.survey.shuffleQuestions) {
      questions = shuffleArray(questions);
    }

    if (sessionData.survey.shuffleOptions) {
      questions = questions.map(q => ({
        ...q,
        options: q.options ? shuffleArray(q.options) : q.options
      }));
    }
    
    setShuffledQuestions(questions);
    hasShuffledRef.current = true;
  }, [sessionData]);

  // Check authentication or allow anonymous via token
  useEffect(() => {
    // Prevent double execution
    if (hasStartedRef.current) return;
    
    // Wait for auth to finish loading
    if (authLoading) return;

    // Preview mode - load survey without creating session
    if (isPreviewMode) {
      hasStartedRef.current = true;
      startPreview();
      return;
    }

    // Anonymous access via share token - skip auth check
    if (isAnonymousAccess) {
      hasStartedRef.current = true;
      startSessionViaToken();
      return;
    }

    // Authenticated access - require login and participant role
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!user?.roles?.includes("Participating")) {
      toast.error("You need to register as a participant");
      router.push("/role-selection");
      return;
    }

    hasStartedRef.current = true;
    startSession();
  }, [isAuthenticated, user, surveyId, authLoading, isAnonymousAccess, isPreviewMode]);

  // Start session via share token (anonymous access)
  const startSessionViaToken = async (participantInfoData?: Record<string, string>) => {
    try {
      setLoading(true);

      // Get email from URL parameter first (more reliable), then sessionStorage as fallback
      const emailFromUrl = searchParams.get('email') || undefined;
      const emailFromStorage = sessionStorage.getItem('survey_participant_email') || undefined;
      const email = emailFromUrl || emailFromStorage;

      // Get password from ref (if already read) or sessionStorage (first time)
      let password = passwordRef.current;
      if (!password) {
        password = sessionStorage.getItem('survey_access_password') || undefined;
        if (password) {
          // Store in ref for subsequent calls (e.g., after participant info form)
          passwordRef.current = password;
          // Clear from sessionStorage for security
          sessionStorage.removeItem('survey_access_password');
        }
      }

      console.log('[DEBUG] startSessionViaToken called with:', { shareToken, tokenType, email: email ? '***' : undefined, emailSource: emailFromUrl ? 'url' : (emailFromStorage ? 'storage' : 'none'), hasPassword: !!password, participantInfo: participantInfoData });
      
      const data = await surveyTakingService.startSessionViaShareLink(shareToken!, email, password, participantInfoData, tokenType || undefined);
      console.log('[DEBUG] startSessionViaShareLink response:', data);
      
      // Check if survey has participant fields and session doesn't have participant_info yet
      // IMPORTANT: Skip this check if we just submitted participant info (participantInfoData is provided)
      // This prevents an infinite loop when backend doesn't return participant_info in the response
      if (!participantInfoData) {
        const surveyParticipantFields = (data.survey as any).participantFields;
        const sessionParticipantInfo = (data.session as any).participant_info;

        if (surveyParticipantFields && Array.isArray(surveyParticipantFields) && surveyParticipantFields.length > 0) {
          // Check if participant info already exists (session was resumed with data)
          if (!sessionParticipantInfo || Object.keys(sessionParticipantInfo).length === 0) {
            // Need to collect participant info first
            setParticipantFields(surveyParticipantFields);
            setShowParticipantInfoForm(true);
            setSessionData(data); // Still set session data so we have survey info

            // Auto-fill form with participant's profile data (for authenticated users)
            fetchAndFillProfile(surveyParticipantFields);

            setLoading(false);
            return;
          }
        }
      }
      
      setSessionData(data);
      setShowParticipantInfoForm(false);

      // Anchor the quiz timer. Prefer the server-persisted quiz_started_at (accurate across resumes);
      // fall back to the session's created_at so the timer ALWAYS renders for a timed quiz even if
      // the start endpoint hasn't persisted a start time yet.
      if (data.survey.isQuiz && data.survey.timeLimitMinutes) {
        const started = resolveQuizStart(data.session);
        const createdAtValue = (data.session as any).created_at || data.session.createdAt;
        const fallback = createdAtValue ? new Date(createdAtValue) : new Date();
        setQuizStartTime(started || (isNaN(fallback.getTime()) ? new Date() : fallback));
      }

      // Restore draft if exists (pass survey questions to restore shuffled order)
      if (data.draft) {
        restoreDraft(data.draft, data.survey.questions);
      }
    } catch (error: any) {
      console.error("Error starting session via token:", error);
      const errorMessage = error.message || "Access denied or link expired";
      setAccessError(errorMessage);
      // Don't redirect - show error on page so user can see what happened
    } finally {
      setLoading(false);
    }
  };

  // Submit participant info and restart session
  const handleParticipantInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    for (const field of participantFields) {
      if (field.required && !participantInfo[field.id]?.trim()) {
        toast.error(`Please fill in ${field.label}`);
        return;
      }
    }
    
    // Restart session with participant info
    await startSessionViaToken(participantInfo);
  };

  // Helper: Restore draft answers and shuffled order
  const restoreDraft = (draft: any, surveyQuestions: SurveyQuestion[]) => {
    try {
      let draftData;

      // Check if draft_answers_content exists (from backend)
      if (draft.draft_answers_content) {
        draftData = draft.draft_answers_content;
      }
      // Fallback to draftContent if it's a string (old format)
      else if (draft.draftContent) {
        draftData = JSON.parse(draft.draftContent);
      }

      if (draftData) {
        if (draftData.answers) {
          setAnswers(draftData.answers);
        } else if (!draftData.shuffledQuestionIds) {
          // Old format without shuffled order - treat entire object as answers
          setAnswers(draftData);
        }

        // Restore participant justifications
        if (draftData.reasons) {
          setReasons(draftData.reasons);
        }
        if (draftData.optionReasons) {
          setOptionReasons(draftData.optionReasons);
        }

        if (draftData.currentQuestionIndex !== undefined) {
          setCurrentIndex(draftData.currentQuestionIndex);
        }

        // Restore shuffled order if saved
        if (draftData.shuffledQuestionIds && draftData.shuffledOptionIds) {
          const restoredQuestions = draftData.shuffledQuestionIds
            .map((qId: number) => {
              const question = surveyQuestions.find(q => q.id === qId);
              if (!question) return null;
              
              // Restore shuffled options for this question
              const shuffledOptionIds = draftData.shuffledOptionIds[qId];
              if (shuffledOptionIds && question.options) {
                const restoredOptions = shuffledOptionIds
                  .map((optId: number) => question.options?.find(o => o.id === optId))
                  .filter(Boolean);
                return { ...question, options: restoredOptions };
              }
              return question;
            })
            .filter(Boolean) as SurveyQuestion[];
          
          if (restoredQuestions.length > 0) {
            setShuffledQuestions(restoredQuestions);
            hasShuffledRef.current = true;
          }
        }
        
        // Restore tab switch count from draft (prevents reset on resume)
        if (draftData.tabSwitchCount && typeof draftData.tabSwitchCount === 'number') {
          tabSwitchCountRef.current = draftData.tabSwitchCount;
        }

        toast.info("Resumed your previous session");
      }
    } catch (error) {
      console.error("Error parsing draft:", error);
    }
  };

  // Start or resume session (authenticated users)
  const startSession = async () => {
    try {
      setLoading(true);
      const data = await surveyTakingService.startOrResumeSession(surveyId);
      setSessionData(data);

      // Anchor the quiz timer. Prefer the server-persisted quiz_started_at (accurate across resumes);
      // fall back to the session's created_at so the timer ALWAYS renders for a timed quiz even if
      // the start endpoint hasn't persisted a start time yet.
      if (data.survey.isQuiz && data.survey.timeLimitMinutes) {
        const started = resolveQuizStart(data.session);
        const createdAtValue = (data.session as any).created_at || data.session.createdAt;
        const fallback = createdAtValue ? new Date(createdAtValue) : new Date();
        setQuizStartTime(started || (isNaN(fallback.getTime()) ? new Date() : fallback));
      }

      // Restore draft if exists (pass survey questions to restore shuffled order)
      if (data.draft) {
        restoreDraft(data.draft, data.survey.questions);
      }
    } catch (error: any) {
      console.error("Error starting session:", error);
      toast.error(error.message || "Failed to load survey");
      router.push("/surveys/browse");
    } finally {
      setLoading(false);
    }
  };

  // Preview mode - load survey without creating a session
  const startPreview = async () => {
    try {
      setLoading(true);
      const data = await surveyApi.getSurveyForPreview(surveyId);
      setSessionData(data);
    } catch (error: any) {
      console.error("Error loading preview:", error);
      setAccessError("Failed to load survey preview. Make sure you own this survey.");
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

  // Handle justification ("reason") change (single-choice)
  const handleReasonChange = useCallback((questionId: number, reason: string) => {
    setReasons((prev) => ({
      ...prev,
      [questionId]: reason,
    }));
  }, []);

  // Handle per-option justification change (multiple-choice)
  const handleOptionReasonChange = useCallback((questionId: number, optionId: number, reason: string) => {
    setOptionReasons((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), [optionId]: reason },
    }));
  }, []);

  // Whether a question's required-justification is satisfied. Returns true when not required,
  // not answered, or fully justified. Multiple-choice requires a reason for EACH selected option.
  const isJustificationComplete = (q: SurveyQuestion): boolean => {
    if (!q.requiresJustification || !q.justificationRequired) return true;
    const ans = answers[q.id];
    if (q.questionType === "multiple-choice") {
      const selected = Array.isArray(ans) ? ans : [];
      if (selected.length === 0) return true; // nothing selected → nothing to justify
      return selected.every((optId: number) => (optionReasons[q.id]?.[optId] || "").trim().length > 0);
    }
    if (ans === undefined || ans === null || ans === "") return true; // not answered
    return (reasons[q.id] || "").trim().length > 0;
  };

  // Build the justification payload for an answer. Multiple-choice → JSON array of
  // {option, reason} for each selected option that has a reason; otherwise the single reason string.
  const buildJustification = (q: SurveyQuestion, value: any): string | undefined => {
    if (q.questionType === "multiple-choice") {
      const selected = Array.isArray(value) ? value : [];
      const entries = selected
        .map((optId: number) => {
          const opt = q.options?.find((o) => o.id === optId);
          return { option: opt?.optionText ?? String(optId), reason: (optionReasons[q.id]?.[optId] || "").trim() };
        })
        .filter((e: { reason: string }) => e.reason.length > 0);
      return entries.length ? JSON.stringify(entries) : undefined;
    }
    const r = (reasons[q.id] || "").trim();
    return r.length ? r : undefined;
  };

  // Save draft
  const saveDraft = async (showToast = true) => {
    if (!sessionData?.session) return;

    try {
      setSaving(true);

      // Build shuffled order maps for persistence
      const shuffledQuestionIds = shuffledQuestions.map(q => q.id);
      const shuffledOptionIds: Record<number, number[]> = {};
      shuffledQuestions.forEach(q => {
        if (q.options) {
          shuffledOptionIds[q.id] = q.options.map(o => o.id);
        }
      });

      // Backend expects draftAnswers as object with structure:
      // { answers: {...}, currentQuestionIndex: number, savedAt: string, shuffledQuestionIds: [...], shuffledOptionIds: {...} }
      const draftAnswers = {
        answers,
        reasons,
        optionReasons,
        currentQuestionIndex: currentIndex,
        savedAt: new Date().toISOString(),
        shuffledQuestionIds,
        shuffledOptionIds,
        tabSwitchCount: tabSwitchCountRef.current,
      };

      await surveyTakingService.saveDraft(sessionData.session.id, {
        lastQuestionId: shuffledQuestions[currentIndex]?.id,
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

  // Auto-save effect - saves every 30 seconds when answers change (disabled in preview)
  useEffect(() => {
    if (!sessionData || Object.keys(answers).length === 0 || isPreviewMode) return;

    const autoSaveInterval = setInterval(() => {
      saveDraft(false); // Silent auto-save
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [answers, reasons, optionReasons, sessionData, currentIndex, isPreviewMode]);

  // Anti-cheating: track tab/window switches for quizzes
  useEffect(() => {
    if (!sessionData?.survey.isQuiz || showIntro || isPreviewMode) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current += 1;
        console.log(`[Anti-cheat] Tab switch detected. Count: ${tabSwitchCountRef.current}`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [sessionData, showIntro]);

  // Navigation
  const handleNext = () => {
    if (!sessionData) return;

    if (currentIndex >= shuffledQuestions.length - 1) {
      if (isPreviewMode) {
        toast.success("Preview complete! You've seen all questions.");
        return;
      }
      setShowSubmitDialog(true);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex <= 0) return;
    setCurrentIndex(currentIndex - 1);
  };

  // Check if can proceed (mandatory questions)
  const canProceed = useCallback(() => {
    if (!sessionData) return false;

    const currentQuestion = shuffledQuestions[currentIndex];
    if (!currentQuestion) return false;

    const answer = answers[currentQuestion.id];

    // Determine whether the question has been answered
    let answered: boolean;
    if (currentQuestion.questionType === "multiple-choice") {
      answered = Array.isArray(answer) && answer.length > 0;
    } else if (currentQuestion.questionType === "text") {
      answered = typeof answer === "string" && answer.trim().length > 0;
    } else {
      answered = answer !== undefined && answer !== null;
    }

    // Mandatory questions must be answered
    if (currentQuestion.mandatory && !answered) return false;

    // Required justification (single reason for single-choice, per selected option for multiple-choice)
    if (answered && !isJustificationComplete(currentQuestion)) return false;

    return true;
  }, [sessionData, currentIndex, answers, reasons, optionReasons, shuffledQuestions]);

  // Handle quiz timer expiration — warn the participant, then auto-submit
  const handleTimeExpired = useCallback(async () => {
    if (hasAutoSubmittedRef.current || isSubmitting) return;

    hasAutoSubmittedRef.current = true;
    // Close any open confirm dialog and show a prominent warning before submitting
    setShowSubmitDialog(false);
    toast.warning("⏰ Time's up! Your quiz is being submitted automatically…", { duration: 5000 });

    // Brief grace so the participant sees the warning, then auto-submit (skips validation)
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await handleSubmit(true);
  }, [isSubmitting]);

  // Submit survey
  const handleSubmit = async (isAutoSubmit = false) => {
    if (!sessionData) return;

    // Validate mandatory questions (skip for auto-submit on timer expiry)
    if (!isAutoSubmit) {
      const unansweredMandatory = shuffledQuestions.filter(
        (q) => q.mandatory && !answers[q.id]
      );

      if (unansweredMandatory.length > 0) {
        toast.error(`Please answer all required questions (${unansweredMandatory.length} remaining)`);
        setShowSubmitDialog(false);
        return;
      }

      // Validate mandatory justifications (per selected option for multiple-choice)
      const missingJustification = shuffledQuestions.filter((q) => !isJustificationComplete(q));

      if (missingJustification.length > 0) {
        toast.error(`Please justify your answer for all required questions (${missingJustification.length} remaining)`);
        setShowSubmitDialog(false);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Convert answers to API format. responseData stays exactly { value } so the
      // grader is unaffected; the justification rides in its own field. For multiple-choice
      // the justification is a JSON array of {option, reason} (one per justified option).
      const answerArray = Object.entries(answers).map(([questionId, value]) => {
        const qid = parseInt(questionId);
        const q = shuffledQuestions.find((sq) => sq.id === qid);
        const justification = q ? buildJustification(q, value) : undefined;
        return {
          questionId: qid,
          responseData: JSON.stringify({ value }),
          ...(justification ? { justification } : {}),
        };
      });

      // Get participant email from sessionStorage (set during public access validation)
      const participantEmail = typeof window !== 'undefined' 
        ? sessionStorage.getItem('survey_participant_email') || undefined
        : undefined;

      await surveyTakingService.submitSurvey(sessionData.session.id, {
        answers: answerArray,
        completedAt: new Date().toISOString(),
        participantEmail, // For invitation tracking
        tabSwitchCount: tabSwitchCountRef.current, // Anti-cheating
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

  // Access error state (e.g., MAX_RESPONSES_REACHED, expired link, etc.)
  if (accessError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="bg-red-100 rounded-full p-4 w-fit mx-auto mb-4">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">{accessError}</p>
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Participant info collection form
  if (showParticipantInfoForm && participantFields.length > 0) {
    // Check if any fields have been auto-filled from profile
    const hasAutoFilledFields = Object.keys(participantInfo).length > 0;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <div className="p-6 text-center border-b">
            <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-4">
              <User className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold">{sessionData?.survey.title || 'Survey'}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Please provide your information to continue
            </p>
          </div>
          <CardContent className="pt-6">
            {/* Show message if fields were auto-filled from profile */}
            {hasAutoFilledFields && isAuthenticated && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  ✓ Some fields have been filled from your profile. You can edit them if needed.
                </p>
              </div>
            )}

            <form onSubmit={handleParticipantInfoSubmit} className="space-y-4">
              {participantFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={field.id}
                    type={field.type}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    value={participantInfo[field.id] || ''}
                    onChange={(e) => setParticipantInfo(prev => ({
                      ...prev,
                      [field.id]: e.target.value
                    }))}
                    required={field.required}
                  />
                </div>
              ))}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Start Quiz'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
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

  // Wait for questions to be shuffled
  if (!shuffledQuestions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Intro screen showing survey description before starting
  if (showIntro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-2xl">
          <div className="p-8 text-center border-b">
            <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-4">
              {sessionData.survey.isQuiz ? (
                <Clock className="h-10 w-10 text-blue-600" />
              ) : (
                <Info className="h-10 w-10 text-blue-600" />
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {sessionData.survey.title}
            </h1>
            {sessionData.survey.isQuiz && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 mt-2">
                <Clock className="h-3 w-3 mr-1" />
                Quiz Mode
              </Badge>
            )}
          </div>
          <CardContent className="p-8">
            {/* Survey Description */}
            {sessionData.survey.description ? (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Description
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {sessionData.survey.description}
                </p>
              </div>
            ) : (
              <p className="text-gray-500 mb-6">
                This {sessionData.survey.isQuiz ? 'quiz' : 'survey'} has no description.
              </p>
            )}

            {/* Survey Info */}
            <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-500">Questions</p>
                <p className="text-xl font-semibold text-gray-900">{shuffledQuestions.length}</p>
              </div>
              {sessionData.survey.isQuiz && sessionData.survey.timeLimitMinutes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-500">Time Limit</p>
                  <p className="text-xl font-semibold text-gray-900">{sessionData.survey.timeLimitMinutes} min</p>
                </div>
              )}
            </div>

            {/* Timer Warning for Quizzes */}
            {sessionData.survey.isQuiz && sessionData.survey.timeLimitMinutes && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> This is a timed quiz ({sessionData.survey.timeLimitMinutes} min). The
                  countdown runs while you take it and cannot be paused — when it reaches zero your quiz is
                  submitted automatically. Make sure you have enough time to finish.
                </p>
              </div>
            )}

            {/* Start Button */}
            <Button
              size="lg"
              className="w-full shadow-md hover:shadow-lg transition-shadow"
              onClick={async () => {
                // Anchor the timer at the moment the participant starts (not at session creation)
                if (!isPreviewMode && sessionData?.session?.id) {
                  await surveyTakingService.startSession(sessionData.session.id);
                  if (sessionData.survey.isQuiz && sessionData.survey.timeLimitMinutes && !quizStartTime) {
                    setQuizStartTime(new Date());
                  }
                }
                setShowIntro(false);
              }}
            >
              <PlayCircle className="h-5 w-5 mr-2" />
              Start {sessionData.survey.isQuiz ? 'Quiz' : 'Survey'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentIndex];
  const isLastQuestion = currentIndex === shuffledQuestions.length - 1;

  const isAllAtOnce = sessionData.survey.questionDisplayMode === 'all_at_once';

  // Whether a given question has a non-empty answer (used for answered-count progress + validation)
  const isQuestionAnswered = (q: SurveyQuestion): boolean => {
    const a = answers[q.id];
    if (q.questionType === "multiple-choice") return Array.isArray(a) && a.length > 0;
    if (q.questionType === "text") return typeof a === "string" && a.trim().length > 0;
    return a !== undefined && a !== null && a !== "";
  };
  const answeredCount = shuffledQuestions.filter(isQuestionAnswered).length;

  // In one-by-one mode progress reflects position; in all-at-once it reflects answered count
  const progress = isAllAtOnce
    ? (answeredCount / shuffledQuestions.length) * 100
    : ((currentIndex + 1) / shuffledQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <div className="fixed top-0 left-0 right-0 bg-purple-600 text-white text-center py-2 z-[60] flex items-center justify-center gap-4">
          <span className="text-sm font-medium">Preview Mode — No responses are being recorded</span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={() => router.push("/dashboard")}
          >
            Exit Preview
          </Button>
        </div>
      )}

      {/* Fixed Progress Bar */}
      <div className={`fixed left-0 right-0 bg-white shadow-sm z-50 ${isPreviewMode ? 'top-10' : 'top-0'}`}>
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
                {/* Info button to view description */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowDescriptionDialog(true)}
                  title="View survey description"
                >
                  <Info className="h-4 w-4 text-gray-500" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">
                  {isAllAtOnce
                    ? `${answeredCount} of ${shuffledQuestions.length} answered`
                    : `Question ${currentIndex + 1} of ${shuffledQuestions.length}`}
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
            {sessionData.survey.isQuiz && sessionData.survey.timeLimitMinutes && quizStartTime && !isPreviewMode ? (
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

      {/* All-at-once (Google Form style): every question on one scrollable page */}
      {isAllAtOnce && (
        <div className={`container mx-auto max-w-3xl px-4 pb-12 space-y-6 ${isPreviewMode ? 'pt-44' : 'pt-32'}`}>
          {shuffledQuestions.map((q, idx) => (
            <Card key={q.id} className="border-0 shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="p-6 md:p-8">
                <div className="mb-4">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 leading-tight">
                      <span className="text-blue-600 mr-2">{idx + 1}.</span>{q.questionText}
                    </h2>
                    {q.mandatory && (
                      <Badge variant="destructive" className="shrink-0">Required</Badge>
                    )}
                  </div>
                  {q.mediaFiles && q.mediaFiles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {q.mediaFiles.map((media) => (
                        <div key={media.id} className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                          <img src={media.fileUrl} alt="Question attachment" className="max-h-48 w-auto object-contain rounded-lg" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <QuestionRenderer
                  question={q}
                  value={answers[q.id]}
                  onChange={(value) => handleAnswerChange(q.id, value)}
                  sessionId={sessionData?.session.id}
                  reason={reasons[q.id]}
                  onReasonChange={(r) => handleReasonChange(q.id, r)}
                  optionReasons={optionReasons[q.id]}
                  onOptionReasonChange={(optId, r) => handleOptionReasonChange(q.id, optId, r)}
                />
              </CardContent>
            </Card>
          ))}

          <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 pt-2">
            {!isPreviewMode && (
              <Button variant="ghost" size="lg" onClick={() => saveDraft()} disabled={saving} className="flex items-center justify-center gap-2">
                {saving ? (<><Loader2 className="h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="h-4 w-4" />Save &amp; Exit</>)}
              </Button>
            )}
            <Button
              size="lg"
              onClick={() => { if (isPreviewMode) { toast.success("Preview complete! You've seen all questions."); return; } setShowSubmitDialog(true); }}
              disabled={isSubmitting}
              className="sm:w-48 shadow-md hover:shadow-lg transition-shadow"
            >
              {sessionData.survey.isQuiz ? "Submit Quiz" : "Submit Survey"}
            </Button>
          </div>
        </div>
      )}

      {/* Main Content (one question at a time) */}
      {!isAllAtOnce && (currentQuestion.questionType === "code" ? (
        /* LeetCode-style split layout for code questions */
        <div className={`px-4 pb-12 ${isPreviewMode ? 'pt-44' : 'pt-32'}`}>
          <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-12rem)]">
            {/* Left Panel: Problem Description */}
            <div className="lg:w-2/5 overflow-y-auto bg-white rounded-lg border shadow-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Code
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Q{currentIndex + 1}/{shuffledQuestions.length}</span>
                    {currentQuestion.mandatory && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-4 leading-tight">
                  {currentQuestion.questionText}
                </h2>

                {currentQuestion.mediaFiles && currentQuestion.mediaFiles.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {currentQuestion.mediaFiles.map((media) => (
                      <img key={media.id} src={media.fileUrl} alt="Attachment" className="max-h-40 rounded border" />
                    ))}
                  </div>
                )}

                {/* Navigation inside left panel */}
                <div className="flex gap-2 mt-6 pt-4 border-t">
                  <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentIndex <= 0}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  {!isPreviewMode && (
                    <Button variant="ghost" size="sm" onClick={() => saveDraft()} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                  <Button size="sm" onClick={handleNext} disabled={!canProceed()} className="ml-auto">
                    {isLastQuestion ? "Submit" : "Next"} {!isLastQuestion && <ChevronRight className="h-4 w-4 ml-1" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Panel: Code Editor */}
            <div className="lg:w-3/5 overflow-hidden bg-white rounded-lg border shadow-sm">
              <div className="h-full">
                <QuestionRenderer
                  question={currentQuestion}
                  value={answers[currentQuestion.id]}
                  onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  sessionId={sessionData?.session.id}
                  reason={reasons[currentQuestion.id]}
                  onReasonChange={(r) => handleReasonChange(currentQuestion.id, r)}
                  optionReasons={optionReasons[currentQuestion.id]}
                  onOptionReasonChange={(optId, r) => handleOptionReasonChange(currentQuestion.id, optId, r)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Standard card layout for non-code questions */
        <div className={`container mx-auto max-w-4xl px-4 pb-12 ${isPreviewMode ? 'pt-44' : 'pt-32'}`}>
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
                      {currentQuestion.questionType === "image-upload" && "Image Upload"}
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

                {/* Question Media */}
                {currentQuestion.mediaFiles && currentQuestion.mediaFiles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {currentQuestion.mediaFiles.map((media) => (
                      <div key={media.id} className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        <img
                          src={media.fileUrl}
                          alt="Question attachment"
                          className="max-h-64 w-auto object-contain rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Question Content */}
              <div className="mt-8">
                <QuestionRenderer
                  question={currentQuestion}
                  value={answers[currentQuestion.id]}
                  onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  sessionId={sessionData?.session.id}
                  reason={reasons[currentQuestion.id]}
                  onReasonChange={(r) => handleReasonChange(currentQuestion.id, r)}
                  optionReasons={optionReasons[currentQuestion.id]}
                  onOptionReasonChange={(optId, r) => handleOptionReasonChange(currentQuestion.id, optId, r)}
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
            disabled={currentIndex <= 0}
            className="sm:w-40 border-2 hover:bg-gray-50"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Previous
          </Button>

          {!isPreviewMode && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => saveDraft()}
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
          )}

          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed()}
            className="sm:w-40 shadow-md hover:shadow-lg transition-shadow"
          >
            {isLastQuestion ? (sessionData.survey.isQuiz ? "Submit Quiz" : "Submit Survey") : "Next"}
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
      ))}

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit {sessionData.survey.isQuiz ? "Quiz" : "Survey"}?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to submit your responses. Once submitted, you cannot change your answers.
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                sessionData.survey.isQuiz ? "Submit Quiz" : "Submit Survey"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Description Dialog */}
      <Dialog open={showDescriptionDialog} onOpenChange={setShowDescriptionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              {sessionData.survey.title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="mt-4">
                {sessionData.survey.description ? (
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {sessionData.survey.description}
                  </p>
                ) : (
                  <p className="text-gray-500 italic">
                    No description available for this {sessionData.survey.isQuiz ? 'quiz' : 'survey'}.
                  </p>
                )}

                {/* Additional info */}
                <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                  <p>Total questions: {shuffledQuestions.length}</p>
                  {sessionData.survey.isQuiz && sessionData.survey.timeLimitMinutes && (
                    <p>Time limit: {sessionData.survey.timeLimitMinutes} minutes</p>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

