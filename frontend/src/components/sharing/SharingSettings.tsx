'use client';

import { useState, useEffect } from 'react';
import { surveySharingService, SharingSettings as SharingSettingsType } from '@/services/surveySharing.service';

interface SharingSettingsProps {
  surveyId: number;
}

export default function SharingSettings({ surveyId }: SharingSettingsProps) {
  const [settings, setSettings] = useState<SharingSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [accessType, setAccessType] = useState<'PUBLIC' | 'ORGANIZATION'>('PUBLIC');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [surveyId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await surveySharingService.getSharingInfo(surveyId);
      setSettings(data);

      if (data) {
        setAccessType(data.accessType);
        setAllowedDomains(data.allowedDomains?.join(', ') || '');
        setIsActive(data.isActive);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sharing settings');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableSharing = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const domains = accessType === 'ORGANIZATION'
        ? allowedDomains.split(',').map(d => d.trim()).filter(d => d)
        : [];

      const data = await surveySharingService.enableSharing(surveyId, {
        accessType,
        allowedDomains: domains,
      });

      setSettings(data);
      setSuccess('Sharing enabled successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to enable sharing');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSharing = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const domains = accessType === 'ORGANIZATION'
        ? allowedDomains.split(',').map(d => d.trim()).filter(d => d)
        : [];

      const data = await surveySharingService.updateSharing(surveyId, {
        accessType,
        allowedDomains: domains,
        isActive,
      });

      setSettings(data);
      setSuccess('Sharing settings updated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update sharing');
    } finally {
      setSaving(false);
    }
  };

  const handleDisableSharing = async () => {
    if (!confirm('Are you sure you want to disable sharing? This will invalidate the share link.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await surveySharingService.disableSharing(surveyId);
      setSettings(null);
      setSuccess('Sharing disabled successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to disable sharing');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Share link copied to clipboard!');
    setTimeout(() => setSuccess(null), 3000);
  };

  if (loading) {
    return <div className="p-6 text-center">Loading sharing settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Survey Sharing</h2>
        <p className="mt-1 text-sm text-gray-600">
          Share your survey with participants via a unique link
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Share Link Display (if enabled) */}
      {settings && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Share Link</h3>
              <p className="text-sm text-blue-700 mt-1 break-all">
                {settings.shareUrl}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded ${
                  settings.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {settings.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                  {settings.accessType}
                </span>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(settings.shareUrl)}
              className="ml-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Copy Link
            </button>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Access Type
          </label>
          <select
            value={accessType}
            onChange={(e) => setAccessType(e.target.value as 'PUBLIC' | 'ORGANIZATION')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={saving}
          >
            <option value="PUBLIC">Public - Anyone with the link</option>
            <option value="ORGANIZATION">Organization - Specific email domains only</option>
          </select>
        </div>

        {accessType === 'ORGANIZATION' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed Email Domains
            </label>
            <input
              type="text"
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              placeholder="e.g., company.com, organization.org"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
            <p className="mt-1 text-xs text-gray-500">
              Separate multiple domains with commas. Only users with these email domains can access.
            </p>
          </div>
        )}

        {settings && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={saving}
            />
            <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
              Link is active
            </label>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!settings ? (
          <button
            onClick={handleEnableSharing}
            disabled={saving || (accessType === 'ORGANIZATION' && !allowedDomains.trim())}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Enabling...' : 'Enable Sharing'}
          </button>
        ) : (
          <>
            <button
              onClick={handleUpdateSharing}
              disabled={saving || (accessType === 'ORGANIZATION' && !allowedDomains.trim())}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Updating...' : 'Update Settings'}
            </button>
            <button
              onClick={handleDisableSharing}
              disabled={saving}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Disabling...' : 'Disable Sharing'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
