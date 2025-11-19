'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { surveySharingService } from '@/services/surveySharing.service';

export default function PublicSurveyLandingPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params.shareToken as string;

  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveyInfo, setSurveyInfo] = useState<{ surveyId: number; title: string } | null>(null);

  useEffect(() => {
    // Validate access immediately without authentication check
    validateAccess();
  }, [shareToken]);

  const validateAccess = async () => {
    try {
      setValidating(true);
      setError(null);

      const data = await surveySharingService.validateAccess(shareToken);
      setSurveyInfo(data);

      // Validation successful - redirect to take survey
      setTimeout(() => {
        router.push(`/survey/take-shared/${shareToken}`);
      }, 1500);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Access denied';
      const denialReason = err.response?.data?.reason;

      let userFriendlyError = errorMessage;
      if (denialReason === 'INVALID_EMAIL_DOMAIN') {
        userFriendlyError = 'Your email domain is not authorized to access this survey.';
      } else if (denialReason === 'LINK_INACTIVE') {
        userFriendlyError = 'This share link is no longer active.';
      } else if (denialReason === 'LINK_EXPIRED') {
        userFriendlyError = 'This share link has expired.';
      } else if (denialReason === 'SURVEY_NOT_PUBLISHED') {
        userFriendlyError = 'This survey is not currently available.';
      }

      setError(userFriendlyError);
    } finally {
      setValidating(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Validating access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-red-500"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="text-sm text-gray-500 mb-4">
            If you believe this is an error, please contact the survey administrator.
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (surveyInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-green-500"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Granted</h2>
          <p className="text-gray-600 mb-6">
            You have access to: <strong>{surveyInfo.title}</strong>
          </p>
          <p className="text-sm text-gray-500">Redirecting to survey...</p>
        </div>
      </div>
    );
  }

  return null;
}
