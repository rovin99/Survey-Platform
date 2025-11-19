"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Trophy, Clock, Target, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { participantsConfig } from "@/lib/api-config";

interface QuestionResult {
  questionId: number;
  questionText: string;
  userAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  pointsEarned: number;
  pointsPossible: number;
  explanation?: string;
}

interface QuizResults {
  sessionId: number;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  timeTakenSeconds: number;
  results: QuestionResult[];
}

export default function QuizResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = parseInt(params.sessionId as string);

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, [sessionId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${participantsConfig.baseUrl}/api/participant/sessions/${sessionId}/evaluate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch quiz results");
      }

      const data = await response.json();
      setResults(data.data);
    } catch (err: any) {
      console.error("Error fetching results:", err);
      setError(err.message || "Failed to load quiz results");
      toast.error("Failed to load quiz results");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-600">Evaluating your quiz...</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Results</h2>
          <p className="text-gray-600 mb-4">{error || "Results not found"}</p>
          <Button onClick={() => router.push("/surveys/browse")}>
            Back to Browse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header with Score */}
        <Card className="mb-6 border-2 shadow-lg">
          <CardHeader className={`${results.passed ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'} text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold mb-2">
                  {results.passed ? "🎉 Congratulations!" : "Keep Trying!"}
                </CardTitle>
                <p className="text-lg opacity-90">
                  {results.passed ? "You passed the quiz!" : "You didn't pass this time, but you can try again!"}
                </p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold">{Math.round(results.percentage)}%</div>
                <p className="text-sm opacity-90">Score</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Trophy className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-900">{results.score}</div>
                <p className="text-sm text-blue-700">Points Earned</p>
                <p className="text-xs text-blue-600">out of {results.totalPoints}</p>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-900">{results.correctCount}</div>
                <p className="text-sm text-green-700">Correct</p>
                <p className="text-xs text-green-600">out of {results.totalQuestions}</p>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Target className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold text-orange-900">
                  {results.totalQuestions - results.correctCount}
                </div>
                <p className="text-sm text-orange-700">Incorrect</p>
                <p className="text-xs text-orange-600">questions</p>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Clock className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-900">
                  {formatTime(results.timeTakenSeconds)}
                </div>
                <p className="text-sm text-purple-700">Time Taken</p>
                <p className="text-xs text-purple-600">&nbsp;</p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Performance</span>
                <span className="text-sm font-bold">{Math.round(results.percentage)}%</span>
              </div>
              <Progress value={results.percentage} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Question by Question Results */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Question-by-Question Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.results.map((result, index) => (
              <Card key={result.questionId} className={`border-2 ${result.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {result.isCorrect ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">Question {index + 1}</h3>
                        <Badge variant={result.isCorrect ? "default" : "destructive"}>
                          {result.pointsEarned} / {result.pointsPossible} points
                        </Badge>
                      </div>

                      <p className="text-gray-900 mb-3">{result.questionText}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div className="p-3 bg-white rounded border">
                          <p className="text-xs font-medium text-gray-500 mb-1">Your Answer</p>
                          <p className={`font-medium ${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                            {JSON.stringify(result.userAnswer)}
                          </p>
                        </div>

                        <div className="p-3 bg-white rounded border">
                          <p className="text-xs font-medium text-gray-500 mb-1">Correct Answer</p>
                          <p className="font-medium text-green-700">
                            {JSON.stringify(result.correctAnswer)}
                          </p>
                        </div>
                      </div>

                      {result.explanation && (
                        <div className="p-3 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs font-medium text-blue-700 mb-1">Explanation</p>
                          <p className="text-sm text-blue-900">{result.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/surveys/browse")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Browse
          </Button>
          <Button
            size="lg"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
