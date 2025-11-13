"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Award, Clock, ArrowRight } from "lucide-react";

export default function SurveyCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-lg">
        <CardContent className="pt-8 pb-6">
          {/* Success Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Thank You!</h1>
            <p className="text-gray-600 text-lg">
              Your survey has been submitted successfully
            </p>
          </div>

          {/* Stats */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Award className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-2xl font-bold text-gray-900">50</span>
                </div>
                <p className="text-sm text-gray-600">Points Earned</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-2xl font-bold text-gray-900">
                    {sessionId ? "5-15" : "~10"}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Minutes Spent</p>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="text-center mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-900">
              Your feedback is valuable and helps improve services. Thank you for participating!
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push("/surveys/browse")}
            >
              Take Another Survey
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </div>

          {/* Session Info */}
          {sessionId && (
            <p className="text-center text-xs text-gray-500 mt-6">
              Session ID: {sessionId}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

