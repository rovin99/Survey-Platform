"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, BarChart3, Clock, LogOut, TrendingUp, Users, Share2, Send, Eye, Edit, ClipboardCheck, Trash2 } from "lucide-react";
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
import { surveyConfig, participantsConfig } from "@/lib/api-config";
import { toast } from "sonner";

interface Survey {
  id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  responseCount?: number;
  requires_manual_evaluation?: boolean;
  is_quiz?: boolean;
  pendingEvaluations?: number;
}

interface Draft {
  draftId: number;
  surveyId: number;
  title: string;
  questionCount: number;
  lastSaved: string;
  updatedAt: string;
}

interface ConductorDashboardProps {
  showParticipantButton?: boolean;
  onSwitchToParticipant?: () => void;
}

export default function ConductorDashboard({ showParticipantButton = false, onSwitchToParticipant }: ConductorDashboardProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftDeleteTarget, setDraftDeleteTarget] = useState<Draft | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    published: 0,
    responses: 0
  });
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      // SECURITY: Use /surveys/my endpoint which scopes to authenticated conductor via JWT
      // No need to fetch conductor ID separately - the backend extracts it from JWT
      const response = await fetch(`${surveyConfig.baseUrl}/api/v1/surveys/my`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch surveys' }));
        console.error('Failed to fetch surveys:', response.status, errorData);
        toast.error(`Failed to load surveys: ${errorData.message || errorData.error?.message || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      const surveyList = data.data || [];
      
      console.log('Fetched surveys:', surveyList.length, surveyList);

      // Fetch response counts and pending evaluations for each survey
      const surveysWithCounts = await Promise.all(
        surveyList.map(async (survey: Survey) => {
          const surveyWithStats = { ...survey, responseCount: 0, pendingEvaluations: 0 };

          try {
            // Fetch response count
            const analyticsResponse = await fetch(
              `${participantsConfig.baseUrl}/api/participant/surveys/${survey.id}/results`,
              { credentials: 'include' }
            );

            if (analyticsResponse.ok) {
              const analyticsData = await analyticsResponse.json();
              surveyWithStats.responseCount = analyticsData.data?.responses?.length || 0;
            }
          } catch (err) {
            console.error(`Failed to fetch analytics for survey ${survey.id}:`, err);
          }

          // Fetch pending evaluations count if survey requires manual evaluation
          if (survey.requires_manual_evaluation && survey.status === 'PUBLISHED') {
            try {
              const evalResponse = await fetch(
                `${participantsConfig.baseUrl}/api/participant/surveys/${survey.id}/pending-evaluations`,
                { credentials: 'include' }
              );

              if (evalResponse.ok) {
                const evalData = await evalResponse.json();
                surveyWithStats.pendingEvaluations = evalData.pending_count || 0;
              }
            } catch (err) {
              console.error(`Failed to fetch pending evaluations for survey ${survey.id}:`, err);
            }
          }

          return surveyWithStats;
        })
      );

      setSurveys(surveysWithCounts);

      // Fetch the conductor's in-progress drafts (separate survey_drafts table)
      let draftList: Draft[] = [];
      try {
        const draftsResponse = await fetch(`${surveyConfig.baseUrl}/api/v1/drafts/my`, {
          credentials: 'include',
        });
        if (draftsResponse.ok) {
          const draftsData = await draftsResponse.json();
          draftList = draftsData.data || [];
        } else {
          console.warn('Failed to fetch drafts:', draftsResponse.status);
        }
      } catch (err) {
        console.error('Error fetching drafts:', err);
      }
      setDrafts(draftList);

      // Calculate stats
      const totalResponses = surveysWithCounts.reduce((sum: number, s: Survey) => sum + (s.responseCount || 0), 0);
      setStats({
        total: surveysWithCounts.length + draftList.length,
        draft: draftList.length,
        published: surveysWithCounts.filter((s: Survey) => s.status === 'PUBLISHED').length,
        responses: totalResponses
      });
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!draftDeleteTarget) return;
    try {
      const response = await fetch(`${surveyConfig.baseUrl}/api/v1/drafts/${draftDeleteTarget.draftId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete' }));
        throw new Error(errorData.message || errorData.error?.message || 'Failed to delete draft');
      }
      toast.success(`Draft "${draftDeleteTarget.title}" deleted`);
      setDraftDeleteTarget(null);
      fetchSurveys();
    } catch (error: any) {
      console.error('Delete draft failed:', error);
      toast.error(error.message || 'Failed to delete draft');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleCreateSurvey = () => {
    router.push('/survey/create?new=true');
  };

  const handleSurveyClick = (surveyId: number, status: string) => {
    if (status === 'PUBLISHED') {
      // Go to distribution page for published surveys
      router.push(`/survey/distribute/${surveyId}`);
    } else {
      // Go to edit page for drafts
      router.push(`/survey/create?draftId=${surveyId}`);
    }
  };

  const handleShare = (e: React.MouseEvent, surveyId: number) => {
    e.stopPropagation();
    router.push(`/survey/distribute/${surveyId}`);
  };

  const handleAnalytics = (e: React.MouseEvent, surveyId: number) => {
    e.stopPropagation();
    router.push(`/surveys/results/${surveyId}`);
  };

  const handleDeleteSurvey = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`${surveyConfig.baseUrl}/api/v1/surveys/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete' }));
        throw new Error(errorData.message || errorData.error?.message || 'Failed to delete survey');
      }

      toast.success(`"${deleteTarget.title}" has been deleted`);
      setDeleteTarget(null);
      fetchSurveys();
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast.error(error.message || 'Failed to delete survey');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Conductor Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.username || 'Conductor'}</p>
            </div>
            <div className="flex gap-3">
              {showParticipantButton && (
                <Button variant="outline" onClick={() => {
                  if (onSwitchToParticipant) {
                    onSwitchToParticipant();
                  }
                }}>
                  <Users className="w-4 h-4 mr-2" />
                  Switch to Participant
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push('/students')}>
                <Users className="w-4 h-4 mr-2" />
                Students
              </Button>
              <Button onClick={handleCreateSurvey}>
                <Plus className="w-4 h-4 mr-2" />
                Create Survey
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Surveys</CardTitle>
              <FileText className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Drafts</CardTitle>
              <Clock className="w-4 h-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draft}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Published</CardTitle>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.published}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Responses</CardTitle>
              <BarChart3 className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.responses}</div>
            </CardContent>
          </Card>
        </div>

        {/* Surveys List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Surveys</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading surveys...</div>
            ) : surveys.length === 0 && drafts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No surveys yet. Create your first survey!</p>
                <Button onClick={handleCreateSurvey}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Survey
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Drafts (in-progress, not yet published) — shown first */}
                {drafts.map((draft) => (
                  <div
                    key={`draft-${draft.draftId}`}
                    className="flex items-center justify-between p-4 border border-amber-200 bg-amber-50/40 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/survey/create?draftId=${draft.draftId}`)}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{draft.title}</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                          DRAFT
                        </span>
                        <span className="text-xs text-gray-500">
                          {draft.questionCount} {draft.questionCount === 1 ? 'question' : 'questions'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Last edited: {new Date(draft.updatedAt || draft.lastSaved).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/survey/create?draftId=${draft.draftId}`); }}
                        title="Continue Editing Draft"
                        className="text-amber-600 hover:text-amber-700 gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-xs">Continue Draft</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setDraftDeleteTarget(draft); }}
                        title="Delete Draft"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {surveys.map((survey) => (
                  <div
                    key={survey.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleSurveyClick(survey.id, survey.status)}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{survey.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-1">{survey.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          survey.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {survey.status}
                        </span>
                        {survey.is_quiz && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                            Quiz
                          </span>
                        )}
                        {survey.requires_manual_evaluation && (
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                            Manual Grading
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {survey.responseCount || 0} responses
                        </span>
                        {survey.pendingEvaluations !== undefined && survey.pendingEvaluations > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800">
                            {survey.pendingEvaluations} pending
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Created: {new Date(survey.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {survey.status === 'PUBLISHED' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={(e) => handleShare(e, survey.id)} title="Share & Distribute">
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => handleAnalytics(e, survey.id)} title="View Results">
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          {survey.requires_manual_evaluation && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); router.push(`/surveys/evaluations/${survey.id}`); }}
                              title="Pending Evaluations"
                              className={survey.pendingEvaluations && survey.pendingEvaluations > 0 ? "text-orange-600 hover:text-orange-700" : ""}
                            >
                              <ClipboardCheck className="w-4 h-4" />
                              {survey.pendingEvaluations && survey.pendingEvaluations > 0 && (
                                <span className="ml-1 text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full">
                                  {survey.pendingEvaluations}
                                </span>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); window.open(`/survey/take/${survey.id}?preview=true`, '_blank'); }}
                            title="Preview Survey"
                            className="text-purple-600 hover:text-purple-700"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); router.push(`/survey/create?editSurveyId=${survey.id}`); }}
                            title="Edit Survey"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {survey.status === 'DRAFT' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); router.push(`/survey/create?draftId=${survey.id}`); }}
                          title="Continue Editing Draft"
                          className="text-amber-600 hover:text-amber-700 gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="text-xs">Continue Draft</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(survey); }}
                        title="Delete Survey"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Survey</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete <strong>&quot;{deleteTarget?.title}&quot;</strong>?
              </p>
              <p className="text-red-600 font-medium">
                This will permanently delete everything related to this survey including all questions, responses, sessions, invitations, and analytics data. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSurvey}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Draft Confirmation Dialog */}
      <AlertDialog open={!!draftDeleteTarget} onOpenChange={(open) => { if (!open) setDraftDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the draft <strong>&quot;{draftDeleteTarget?.title}&quot;</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDraft}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
