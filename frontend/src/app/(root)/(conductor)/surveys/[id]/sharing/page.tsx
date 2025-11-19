'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import SharingSettings from '@/components/sharing/SharingSettings';
import AccessLogs from '@/components/sharing/AccessLogs';

export default function SurveySharePage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = parseInt(params.id as string);
  const [activeTab, setActiveTab] = useState<'settings' | 'logs'>('settings');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Sharing Settings
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Access Logs
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'settings' && <SharingSettings surveyId={surveyId} />}
            {activeTab === 'logs' && <AccessLogs surveyId={surveyId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
