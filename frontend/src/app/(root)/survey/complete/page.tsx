"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Award, Clock, ArrowRight } from "lucide-react";

function SurveyCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Card className="shadow-2xl border-0 overflow-hidden">
          <CardContent className="pt-12 pb-8 px-8">
            {/* Success Icon with Animation */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-6 animate-in zoom-in duration-500 shadow-lg">
                <CheckCircle className="h-14 w-14 text-white" strokeWidth={2.5} />
              </div>
              <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Thank You!
              </h1>
              <p className="text-gray-600 text-lg">
                Your responses have been submitted successfully
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 text-center border border-yellow-200 shadow-sm">
                <Award className="h-8 w-8 text-yellow-600 mx-auto mb-3" />
                <span className="block text-3xl font-bold text-yellow-900 mb-1">50</span>
                <p className="text-sm text-yellow-700 font-medium">Points Earned</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 text-center border border-blue-200 shadow-sm">
                <Clock className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                <span className="block text-3xl font-bold text-blue-900 mb-1">
                  {sessionId ? "12" : "~10"}
                </span>
                <p className="text-sm text-blue-700 font-medium">Minutes</p>
              </div>
            </div>

            {/* Thank You Message */}
            <div className="text-center mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
              <p className="text-blue-900 font-medium leading-relaxed">
                Your feedback is invaluable and will help improve our services. We truly appreciate your time and thoughtful responses!
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full shadow-md hover:shadow-lg transition-all"
                onClick={() => router.push("/surveys/browse")}
              >
                Take Another Survey
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-2"
                onClick={() => router.push("/dashboard")}
              >
                Back to Dashboard
              </Button>
            </div>

            {/* Session Info */}
            {sessionId && (
              <div className="text-center mt-8 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Session ID: <span className="font-mono">{sessionId}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SurveyCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-lg">
          <CardContent className="pt-8 pb-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <Clock className="h-12 w-12 text-gray-400 animate-pulse" />
              </div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <SurveyCompleteContent />
    </Suspense>
  );
}
