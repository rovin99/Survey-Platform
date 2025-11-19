'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { surveySharingService } from '@/services/surveySharing.service';
import { surveyTakingService } from '@/services/surveyTaking.service';
import { QuestionRenderer } from '@/components/survey-taking/QuestionRenderer';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import type { SessionResponse } from '@/types/survey-taking';

export default function TakeSharedSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params.shareToken as string;

  const [sessionData, setSessionData] = useState<SessionResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Start session immediately without authentication check
    startSession();
  }, [shareToken]);

  const startSession = async () => {
    try {
      setLoading(true);
      setError(null);

      // Start session via share link
      const data = await surveySharingService.startSessionViaShareLink(shareToken);
      setSessionData(data);

      // Restore draft if exists
      if (data.draft) {
        try {
          let draftData;
          if ((data.draft as any).draft_answers_content) {
            draftData = (data.draft as any).draft_answers_content;
          } else if (data.draft.draftContent) {
            draftData = JSON.parse(data.draft.draftContent);
          }

          if (draftData) {
            if (draftData.answers) {
              setAnswers(draftData.answers);
            } else {
              setAnswers(draftData);
            }
            if (draftData.currentQuestionIndex !== undefined) {
              setCurrentIndex(draftData.currentQuestionIndex);
            }
            toast.info('Resumed your previous session');
          }
        } catch (error) {
          console.error('Error parsing draft:', error);
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to start survey';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    // Backend returns session.id, not session.sessionId
    const sessionId = sessionData?.session?.id || sessionData?.session?.sessionId;
    if (!sessionId) return;

    try {
      setSaving(true);
      const currentQuestion = sessionData.survey.questions[currentIndex];
      const draftData = {
        lastQuestionId: currentQuestion?.id,
        draftAnswers: answers,
      };

      await surveyTakingService.saveDraft(
        sessionId,
        draftData
      );

      toast.success('Progress saved');
    } catch (error: any) {
      toast.error('Failed to save progress');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    await saveDraft();
    if (currentIndex < (sessionData?.survey.questions.length || 0) - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    // Backend returns session.id, not session.sessionId
    const sessionId = sessionData?.session?.id || sessionData?.session?.sessionId;

    if (!sessionId) {
      console.error('No session ID found', sessionData);
      toast.error('Session ID is missing. Please reload the page.');
      return;
    }

    try {
      setSaving(true);
      console.log('Submitting survey with session ID:', sessionId);

      // Prepare answers for submission in the format backend expects
      const finalAnswers = Object.entries(answers).map(([questionId, responseData]) => ({
        questionId: parseInt(questionId),
        responseData,
      }));

      console.log('Final answers prepared:', finalAnswers);

      // Backend expects { answers: [...], completedAt: "..." }
      const submitData = {
        answers: finalAnswers,
        completedAt: new Date().toISOString(),
      };

      console.log('Calling submitSurvey with data:', submitData);
      await surveyTakingService.submitSurvey(sessionId, submitData);
      toast.success('Survey submitted successfully!');
      router.push('/survey/complete');
    } catch (error: any) {
      console.error('Survey submission error:', error);
      toast.error(error.message || 'Failed to submit survey');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (!sessionData) return null;

  const currentQuestion = sessionData.survey.questions[currentIndex];
  const progress = ((currentIndex + 1) / sessionData.survey.questions.length) * 100;
  const isLastQuestion = currentIndex === sessionData.survey.questions.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {sessionData.survey.title}
          </h1>
          <p className="text-gray-600 mb-4">{sessionData.survey.description}</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Question {currentIndex + 1} of {sessionData.survey.questions.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <QuestionRenderer
            question={currentQuestion}
            value={answers[currentQuestion.id]}
            onChange={(value) =>
              setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
            }
          />
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            onClick={handlePrevious}
            disabled={currentIndex === 0 || saving}
            variant="outline"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <Button onClick={saveDraft} disabled={saving} variant="outline">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Progress'}
          </Button>

          {isLastQuestion ? (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Survey'}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={saving}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
