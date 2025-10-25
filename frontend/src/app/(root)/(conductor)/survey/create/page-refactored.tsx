"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BasicInfoSection } from "@/components/survey/BasicInfoSection";
import { QuestionsSection } from "@/components/survey/QuestionsSection";
import { useDraftManager } from "@/hooks/useDraftManager";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useAuth } from "@/context/AuthContext";
import { surveyApi } from "@/services/surveyApi";
import { PROGRESS_VALUES, DEFAULTS } from "@/constants/survey";
import type { Question, SurveySection, DraftQuestion } from "@/types/survey";

export default function SurveyCreatePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentSection, setCurrentSection] = useState<SurveySection>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conductorInfo, setConductorInfo] = useState<{ conductorId: number } | null>(null);

  // Initialize draft manager with conductor ID
  const draftManager = useDraftManager(conductorInfo?.conductorId || 0);
  const mediaUpload = useMediaUpload();

  // Authorization and conductor data loading
  useEffect(() => {
    const loadConductorInfo = async () => {
      if (!loading && isAuthenticated && user) {
        if (!user.roles?.includes("Conducting")) {
          toast.error("Access denied. Conducting role required.");
          router.push("/role-selection");
          return;
        }

        try {
          const conductorData = await surveyApi.getCurrentConductor();
          setConductorInfo({ conductorId: conductorData.conductorId });
        } catch (error) {
          console.error("Error loading conductor info:", error);
          toast.error("Failed to load conductor information");
          router.push("/role-selection");
        }
      }
    };

    loadConductorInfo();
  }, [user, isAuthenticated, loading, router]);

  // Load draft and sync questions when conductor info is available
  useEffect(() => {
    if (conductorInfo) {
      const loadedDraft = draftManager.loadDraft();
      if (loadedDraft && loadedDraft.draftContent.questions.length > 0) {
        const uiQuestions = draftManager.transformQuestionsForUI(
          loadedDraft.draftContent.questions,
          loadedDraft.draftContent.options
        );
        setQuestions(uiQuestions);
      }
    }
  }, [conductorInfo, draftManager]);

  // Basic info handlers
  const handleBasicInfoUpdate = useCallback((updates: Partial<typeof draftManager.draft.draftContent.basicInfo>) => {
    draftManager.updateDraft({
      basicInfo: { ...draftManager.draft.draftContent.basicInfo, ...updates }
    });
  }, [draftManager]);

  // Question management handlers
  const handleAddQuestion = useCallback(() => {
    const nextQuestionId = draftManager.draft.draftContent.questions.length > 0 
      ? Math.max(...draftManager.draft.draftContent.questions.map(q => q.question_id).filter(id => id !== undefined)) + 1
      : DEFAULTS.INITIAL_QUESTION_ID;
    
    const optionId = `${nextQuestionId}-opt-0`;
    
    const newQuestion: Question = {
      id: nextQuestionId.toString(),
      text: "",
      type: DEFAULTS.QUESTION_TYPE,
      options: [{ id: optionId, text: "" }],
      mediaFiles: [],
      mandatory: false,
      correctAnswers: ""
    };
    
    setQuestions(prev => [...prev, newQuestion]);
    
    const newDraftQuestion: DraftQuestion = {
      question_id: nextQuestionId,
      question_text: "",
      question_type: DEFAULTS.QUESTION_TYPE,
      mandatory: false,
      branching_logic: "",
      correct_answers: "",
      mediaFiles: []
    };
    
    const newOption = {
      optionId: optionId,
      question_id: nextQuestionId,
      option_text: ""
    };
    
    draftManager.updateDraft({
      questions: [...draftManager.draft.draftContent.questions, newDraftQuestion],
      options: [...draftManager.draft.draftContent.options, newOption]
    });
  }, [draftManager, questions]);

  const handleDeleteQuestion = useCallback((questionId: string) => {
    const questionIdNum = parseInt(questionId);
    
    setQuestions(prev => prev.filter(q => q.id !== questionId));
    
    draftManager.updateDraft({
      questions: draftManager.draft.draftContent.questions.filter(q => q.question_id !== questionIdNum),
      options: draftManager.draft.draftContent.options.filter(opt => opt.question_id !== questionIdNum)
    });
  }, [draftManager]);

  const handleUpdateQuestion = useCallback((questionId: string, updates: Partial<Question>) => {
    const questionIdNum = parseInt(questionId);
    
    setQuestions(prev => 
      prev.map(q => q.id === questionId ? { ...q, ...updates } : q)
    );
    
    draftManager.updateDraft({
      questions: draftManager.draft.draftContent.questions.map(q => 
        q.question_id === questionIdNum ? { 
          ...q, 
          ...(updates.text && { question_text: updates.text }),
          ...(updates.type && { question_type: updates.type }),
          ...(updates.mandatory !== undefined && { mandatory: updates.mandatory }),
          ...(updates.correctAnswers !== undefined && { correct_answers: updates.correctAnswers })
        } : q
      )
    });
  }, [draftManager]);

  // Option management
  const handleAddOption = useCallback((questionId: string) => {
    const questionIdNum = parseInt(questionId);
    const optionCount = draftManager.draft.draftContent.options.filter(
      opt => opt.question_id === questionIdNum
    ).length;
    const optionId = `${questionIdNum}-opt-${optionCount}`;
    
    setQuestions(prev =>
      prev.map(q =>
        q.id === questionId
          ? { ...q, options: [...q.options, { id: optionId, text: "" }] }
          : q
      )
    );
    
    const newOption = {
      optionId: optionId,
      question_id: questionIdNum,
      option_text: ""
    };
    
    draftManager.updateDraft({
      options: [...draftManager.draft.draftContent.options, newOption]
    });
  }, [draftManager]);

  const handleDeleteOption = useCallback((questionId: string, optionId: string) => {
    const questionIdNum = parseInt(questionId);
    
    setQuestions(prev =>
      prev.map(q =>
        q.id === questionId
          ? { ...q, options: q.options.filter(opt => opt.id !== optionId) }
          : q
      )
    );
    
    draftManager.updateDraft({
      options: draftManager.draft.draftContent.options.filter(opt => 
        !(opt.question_id === questionIdNum && opt.optionId === optionId)
      )
    });
  }, [draftManager]);

  // Media handlers
  const handleMediaUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, questionId: string) => {
    const updateQuestion = (qId: string, updateFn: (q: Question) => Question) => {
      setQuestions(prev => prev.map(q => q.id === qId ? updateFn(q) : q));
    };
    
    const updateDraftQuestion = (qId: number, updateFn: (q: DraftQuestion) => DraftQuestion) => {
      draftManager.updateDraft({
        questions: draftManager.draft.draftContent.questions.map(q => 
          q.question_id === qId ? updateFn(q) : q
        )
      });
    };
    
    mediaUpload.handleFileInputChange(
      e, 
      questionId, 
      updateQuestion, 
      updateDraftQuestion, 
      draftManager.draft.draftId
    );
  }, [draftManager, mediaUpload]);

  const handleRemoveMedia = useCallback((questionId: string, mediaId: string) => {
    const updateQuestion = (qId: string, updateFn: (q: Question) => Question) => {
      setQuestions(prev => prev.map(q => q.id === qId ? updateFn(q) : q));
    };
    
    const updateDraftQuestion = (qId: number, updateFn: (q: DraftQuestion) => DraftQuestion) => {
      draftManager.updateDraft({
        questions: draftManager.draft.draftContent.questions.map(q => 
          q.question_id === qId ? updateFn(q) : q
        )
      });
    };
    
    mediaUpload.removeMedia(questionId, mediaId, updateQuestion, updateDraftQuestion);
  }, [draftManager, mediaUpload]);

  // Manual save
  const handleManualSave = useCallback(async () => {
    try {
      setIsLoading(true);
      await draftManager.manualSave();
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsLoading(false);
    }
  }, [draftManager]);

  // Publish
  const handlePublish = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await draftManager.publishDraft();
      toast.success("Survey published successfully!");
      router.push('/surveys');
    } catch (error) {
      console.error('Publishing failed:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to publish survey: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [draftManager, router]);

  // Navigation
  const handleNext = useCallback(async () => {
    if (currentSection === 'basic') {
      setCurrentSection('questions');
    } else if (currentSection === 'questions') {
      setCurrentSection('branching');
      
      // Auto-save when reaching the branching section
      if (!draftManager.draft.draftId) {
        await handleManualSave();
      }
    } else if (currentSection === 'branching') {
      await handlePublish();
    }
  }, [currentSection, draftManager.draft.draftId, handleManualSave, handlePublish]);

  const handlePrevious = useCallback(() => {
    setCurrentSection(prev => 
      prev === 'branching' ? 'questions' :
      prev === 'questions' ? 'basic' : 'basic'
    );
  }, []);

  const getProgressValue = () => {
    switch (currentSection) {
      case 'basic': return PROGRESS_VALUES.BASIC;
      case 'questions': return PROGRESS_VALUES.QUESTIONS;
      case 'branching': return PROGRESS_VALUES.BRANCHING;
      default: return PROGRESS_VALUES.BASIC;
    }
  };

  // Early return for authorization (after all hooks)
  if (loading || !isAuthenticated || !user?.roles?.includes("Conducting") || !conductorInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
          {!loading && !isAuthenticated && (
            <p className="text-sm text-gray-500 mt-2">Please log in to continue</p>
          )}
          {!loading && isAuthenticated && !user?.roles?.includes("Conducting") && (
            <p className="text-sm text-red-500 mt-2">Conducting role required</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Create Survey</h1>
        <div className="flex items-center gap-2">
          {draftManager.lastSynced && (
            <span className="text-sm text-muted-foreground">
              Last synced: {draftManager.lastSynced.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleManualSave}
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Draft
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Progress value={getProgressValue()} className="w-full" />

      {/* Main Content */}
      <Card className="w-full">
        {currentSection === 'basic' && (
          <BasicInfoSection 
            basicInfo={draftManager.draft.draftContent.basicInfo}
            onUpdate={handleBasicInfoUpdate}
          />
        )}

        {currentSection === 'questions' && (
          <QuestionsSection
            questions={questions}
            onAddQuestion={handleAddQuestion}
            onUpdateQuestion={handleUpdateQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onAddOption={handleAddOption}
            onDeleteOption={handleDeleteOption}
            onMediaUpload={handleMediaUpload}
            onRemoveMedia={handleRemoveMedia}
          />
        )}

        {currentSection === 'branching' && (
          <>
            <CardHeader>
              <CardTitle>Branching Logic</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add branching logic section content here */}
            </CardContent>
          </>
        )}

        {/* Footer */}
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentSection === 'basic'}
          >
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentSection === 'branching' ? 'Publish' : 'Next'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 