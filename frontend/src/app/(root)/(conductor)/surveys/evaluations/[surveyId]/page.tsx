"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { evaluationService, type PendingEvaluationSession } from "@/services/evaluationService";
import { surveyService } from "@/services/surveyService";
import { Loader2, ArrowLeft, ClipboardCheck, User, Clock, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function PendingEvaluationsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const surveyId = Number(params.surveyId);

  const [isLoading, setIsLoading] = useState(true);
  const [pendingSessions, setPendingSessions] = useState<PendingEvaluationSession[]>([]);
  const [surveyTitle, setSurveyTitle] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isAuthenticated && surveyId) {
      loadData();
    }
  }, [authLoading, isAuthenticated, surveyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load survey info and pending evaluations in parallel
      const [pendingData, surveyData] = await Promise.all([
        evaluationService.getPendingEvaluations(surveyId),
        surveyService.getSurvey(surveyId)
      ]);

      setPendingSessions(pendingData.sessions || []);
      setSurveyTitle(surveyData.title || `Survey #${surveyId}`);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load pending evaluations");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            Pending Evaluations
          </CardTitle>
          <p className="text-muted-foreground">{surveyTitle}</p>
        </CardHeader>
        <CardContent>
          {pendingSessions.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Pending Evaluations</h3>
              <p className="text-muted-foreground mt-2">
                All submissions have been evaluated or there are no submissions yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                {pendingSessions.length} submission{pendingSessions.length !== 1 ? 's' : ''} pending evaluation
              </p>

              {pendingSessions.map((session) => {
                const participantInfo = parseParticipantInfo(session.participant_info);

                return (
                  <div
                    key={session.session_id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/surveys/evaluations/${surveyId}/grade/${session.session_id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {session.participant_email || "Anonymous Participant"}
                          </p>
                          {participantInfo?.name && (
                            <p className="text-sm text-muted-foreground">
                              {participantInfo.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(session.submitted_at)}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
