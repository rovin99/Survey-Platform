"use client";

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { surveyConfig } from '@/lib/api-config';
import * as XLSX from 'xlsx';
import { 
    Upload, 
    Send, 
    Users, 
    Link2, 
    Copy, 
    CheckCircle, 
    XCircle, 
    Clock,
    FileSpreadsheet,
    ArrowLeft,
    Loader2,
    Settings,
    Mail,
    Globe,
    Building2,
    Eye,
    EyeOff,
    Trash2,
    Lock,
    Calendar,
    ShieldCheck,
    UserCheck
} from 'lucide-react';

const SURVEY_URL = surveyConfig.baseUrl;

interface InvitationStats {
    total_invited: number;
    total_sent: number;
    total_failed: number;
    total_pending: number;
}

interface SurveyInfo {
    id: number;
    title: string;
    status: string;
    allow_anonymous: boolean;
    is_shareable: boolean;
    is_quiz?: boolean;
    max_attempts?: number;
}

interface ShareInfo {
    share_url: string;
    share_token: string;
    access_type: 'PUBLIC' | 'ORGANIZATION' | 'INVITED_ONLY';
    is_active: boolean;
    allowed_domains?: string[];
    has_password?: boolean;
    expires_at?: string;
    max_responses?: number;
}

export default function SurveyDistributePage() {
    const params = useParams();
    const router = useRouter();
    const surveyId = params.id as string;

    // State
    const [survey, setSurvey] = useState<SurveyInfo | null>(null);
    const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
    const [stats, setStats] = useState<InvitationStats | null>(null);
    const [emails, setEmails] = useState<string[]>([]);
    const [emailInput, setEmailInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [allowAnonymous, setAllowAnonymous] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Sharing settings state
    const [accessType, setAccessType] = useState<'PUBLIC' | 'ORGANIZATION' | 'INVITED_ONLY'>('PUBLIC');
    const [allowedDomains, setAllowedDomains] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [activeTab, setActiveTab] = useState<'share' | 'invite' | 'stats' | 'logs'>('share');
    
    // Security settings state
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [expiresAt, setExpiresAt] = useState('');
    const [maxResponses, setMaxResponses] = useState<string>('');

    // Pre-fill recipient emails when arriving from the Students page ("Assign to survey").
    useEffect(() => {
        try {
            const stashed = sessionStorage.getItem('prefillEmails');
            if (stashed) {
                const list = JSON.parse(stashed);
                if (Array.isArray(list) && list.length > 0) {
                    const cleaned = [...new Set(
                        list.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean)
                    )] as string[];
                    setEmails(cleaned);
                    setActiveTab('invite');
                    toast.success(`Loaded ${cleaned.length} recipient(s) from your selection`);
                }
                sessionStorage.removeItem('prefillEmails');
            }
        } catch {
            /* ignore malformed sessionStorage */
        }
    }, []);

    // Load survey data
    useEffect(() => {
        const loadSurvey = async () => {
            try {
                const response = await fetch(`${SURVEY_URL}/api/v1/surveys/${surveyId}`, {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        setError('You do not have permission to access this survey.');
                        return;
                    }
                    throw new Error('Failed to load survey');
                }
                
                const data = await response.json();
                setSurvey(data.data);
                setAllowAnonymous(data.data.allow_anonymous || false);
            } catch (error) {
                console.error('Error loading survey:', error);
                setError('Failed to load survey. Please try again.');
            }
        };

        const loadShareInfo = async () => {
            try {
                const response = await fetch(`${SURVEY_URL}/api/v1/surveys/${surveyId}/sharing`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const info = data.data;
                    // Normalize camelCase from backend to snake_case for frontend
                    const normalizedInfo: ShareInfo = {
                        share_url: info.shareUrl || info.share_url || '',
                        share_token: info.shareToken || info.share_token || '',
                        access_type: info.accessType || info.access_type || 'PUBLIC',
                        is_active: info.isActive ?? info.is_active ?? true,
                        allowed_domains: info.allowedDomains || info.allowed_domains || [],
                        has_password: info.hasPassword || info.has_password || false,
                        expires_at: info.expiresAt || info.expires_at,
                        max_responses: info.maxResponses || info.max_responses,
                    };
                    setShareInfo(normalizedInfo);
                    setAccessType(normalizedInfo.access_type);
                    setAllowedDomains(normalizedInfo.allowed_domains?.join(', ') || '');
                    setIsActive(normalizedInfo.is_active);
                }
            } catch (error) {
                console.error('Error loading share info:', error);
            }
        };

        const loadStats = async () => {
            try {
                const response = await fetch(`${SURVEY_URL}/api/v1/surveys/${surveyId}/invitations/stats`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setStats(data.data);
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        };

        Promise.all([loadSurvey(), loadShareInfo(), loadStats()]).finally(() => {
            setLoading(false);
        });
    }, [surveyId]);

    // Enable sharing
    const enableSharing = async () => {
        try {
            const domains = accessType === 'ORGANIZATION'
                ? allowedDomains.split(',').map(d => d.trim()).filter(d => d)
                : [];

            const requestBody: Record<string, unknown> = {
                accessType,
                allowedDomains: domains
            };

            // Add optional security settings
            if (password) {
                requestBody.password = password;
            }
            if (expiresAt) {
                requestBody.expiresAt = new Date(expiresAt).toISOString();
            }
            if (maxResponses) {
                requestBody.maxResponses = parseInt(maxResponses);
            }

            const response = await fetch(`${SURVEY_URL}/api/v1/surveys/${surveyId}/sharing/enable`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401 || response.status === 403) {
                    toast.error('You do not own this survey.');
                    return;
                }
                throw new Error(errorData.error || 'Failed to enable sharing');
            }

            const data = await response.json();
            const info = data.data || data;
            setShareInfo({
                share_url: info.share_url || info.shareUrl,
                share_token: info.share_token || info.shareToken,
                access_type: info.access_type || info.accessType || accessType,
                is_active: true,
                allowed_domains: domains,
                has_password: !!password,
                expires_at: expiresAt || undefined,
                max_responses: maxResponses ? parseInt(maxResponses) : undefined
            });
            setPassword(''); // Clear password after setting
            toast.success('Sharing enabled with security settings!');
        } catch (error) {
            console.error('Error enabling sharing:', error);
            toast.error('Failed to enable sharing');
        }
    };

    // Update sharing settings
    const updateSharing = async () => {
        try {
            const domains = accessType === 'ORGANIZATION'
                ? allowedDomains.split(',').map(d => d.trim()).filter(d => d)
                : [];

            const requestBody: Record<string, unknown> = {
                accessType,
                allowedDomains: domains,
                isActive
            };

            // Add optional security settings
            if (password) {
                requestBody.password = password;
            }
            if (expiresAt) {
                requestBody.expiresAt = new Date(expiresAt).toISOString();
            }
            if (maxResponses) {
                requestBody.maxResponses = parseInt(maxResponses);
            }

            const response = await fetch(`${SURVEY_URL}/api/v1/surveys/${surveyId}/sharing`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error('Failed to update sharing');

            const data = await response.json();
            const info = data.data || data;
            setShareInfo({
                share_url: info.shareUrl || info.share_url || shareInfo?.share_url || '',
                share_token: info.shareToken || info.share_token || shareInfo?.share_token || '',
                access_type: info.accessType || info.access_type || accessType,
                is_active: info.isActive ?? info.is_active ?? isActive,
                allowed_domains: domains,
                has_password: info.hasPassword || info.has_password || shareInfo?.has_password || !!password,
                expires_at: info.expiresAt || info.expires_at || expiresAt || shareInfo?.expires_at,
                max_responses: info.maxResponses || info.max_responses || (maxResponses ? parseInt(maxResponses) : shareInfo?.max_responses)
            });
            setPassword(''); // Clear password after updating
            toast.success('Settings updated!');
        } catch (error) {
            console.error('Error updating sharing:', error);
            toast.error('Failed to update settings');
        }
    };

    // Disable sharing
    const disableSharing = async () => {
        if (!confirm('Are you sure? This will invalidate the share link.')) return;

        try {
            const response = await fetch(`${SURVEY_URL}/api/v1/surveys/${surveyId}/sharing`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to disable sharing');

            setShareInfo(null);
            setEmails([]);
            toast.success('Sharing disabled');
        } catch (error) {
            console.error('Error disabling sharing:', error);
            toast.error('Failed to disable sharing');
        }
    };

    // Update anonymous setting
    const updateAnonymousSetting = async (value: boolean) => {
        try {
            const response = await fetch(`${SURVEY_URL}/api/v1/surveys/${surveyId}/anonymous`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ allow_anonymous: value })
            });

            if (!response.ok) throw new Error('Failed to update setting');

            setAllowAnonymous(value);
            toast.success(value ? 'Anonymous participation enabled' : 'Registration required');
        } catch (error) {
            console.error('Error updating setting:', error);
            toast.error('Failed to update setting');
        }
    };

    // Excel file upload
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const extractedEmails: string[] = [];
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

                json.forEach((row) => {
                    const cell = row[0]?.toString()?.trim();
                    if (cell && emailRegex.test(cell)) {
                        extractedEmails.push(cell.toLowerCase());
                    }
                });

                const uniqueEmails = [...new Set(extractedEmails)];
                setEmails(uniqueEmails);
                toast.success(`Loaded ${uniqueEmails.length} email addresses`);
            } catch (error) {
                console.error('Error parsing file:', error);
                toast.error('Failed to parse Excel file');
            }
        };
        reader.readAsBinaryString(file);
    }, []);

    // Add email manually
    const addEmail = () => {
        const email = emailInput.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(email)) {
            toast.error('Invalid email format');
            return;
        }

        if (emails.includes(email)) {
            toast.error('Email already in list');
            return;
        }

        setEmails([...emails, email]);
        setEmailInput('');
    };

    // Remove email
    const removeEmail = (email: string) => {
        setEmails(emails.filter(e => e !== email));
    };

    // Send invitations
    const sendInvitations = async () => {
        if (emails.length === 0) {
            toast.error('Add at least one email address');
            return;
        }

        if (!shareInfo?.share_url) {
            toast.error('Please enable sharing first');
            return;
        }

        setSending(true);
        try {
            const response = await fetch(`${SURVEY_URL}/api/v1/surveys/${surveyId}/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    emails: emails,
                    share_url: shareInfo.share_url
                })
            });

            if (!response.ok) throw new Error('Failed to send invitations');

            const data = await response.json();
            setStats(data.data.stats);
            setEmails([]);
            toast.success(`Sent ${data.data.stats.total_sent} invitations!`);
        } catch (error) {
            console.error('Error sending invitations:', error);
            toast.error('Failed to send invitations');
        } finally {
            setSending(false);
        }
    };

    // Copy share link
    const copyShareLink = () => {
        if (shareInfo?.share_url) {
            navigator.clipboard.writeText(shareInfo.share_url);
            toast.success('Link copied to clipboard!');
        }
    };

    // Download template
    const downloadTemplate = () => {
        const ws_data = [
            ["Email"],
            ["participant1@example.com"],
            ["participant2@example.com"],
            ["participant3@example.com"],
        ];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Emails");
        XLSX.writeFile(wb, "invitation_emails_template.xlsx");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (error || !survey) {
        return (
            <div className="container mx-auto p-6 max-w-4xl">
                <Card className="p-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-red-100 rounded-full">
                            <XCircle className="h-8 w-8 text-red-600" />
                        </div>
                        <h2 className="text-xl font-semibold">Access Denied</h2>
                        <p className="text-muted-foreground max-w-md">{error || 'Survey not found'}</p>
                        <Button variant="outline" onClick={() => router.push('/dashboard')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Share & Distribute Survey</h1>
                    <p className="text-muted-foreground">{survey.title}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={survey.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {survey.status}
                    </Badge>
                    {survey.is_quiz && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            Quiz
                        </Badge>
                    )}
                    {survey.max_attempts && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            Max {survey.max_attempts} attempt{survey.max_attempts > 1 ? 's' : ''}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6">
                <div className="flex gap-2 border-b">
                    <button
                        onClick={() => setActiveTab('share')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'share'
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Settings className="inline h-4 w-4 mr-2" />
                        Share Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('invite')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'invite'
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Mail className="inline h-4 w-4 mr-2" />
                        Email Invitations
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'logs'
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Eye className="inline h-4 w-4 mr-2" />
                        Access Logs
                    </button>
                </div>
            </div>

            {/* Share Settings Tab */}
            {activeTab === 'share' && (
                <div className="space-y-6">
                    {/* Share Link Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Link2 className="h-5 w-5" />
                                Public Share Link
                            </CardTitle>
                            <CardDescription>
                                Generate a unique link for participants to access your survey
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {shareInfo ? (
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input 
                                            value={shareInfo.share_url} 
                                            readOnly 
                                            className="font-mono text-sm"
                                        />
                                        <Button onClick={copyShareLink}>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={shareInfo.is_active ? 'default' : 'secondary'}>
                                            {shareInfo.is_active ? (
                                                <><Eye className="h-3 w-3 mr-1" /> Active</>
                                            ) : (
                                                <><EyeOff className="h-3 w-3 mr-1" /> Inactive</>
                                            )}
                                        </Badge>
                                        <Badge variant="outline">
                                            {shareInfo.access_type === 'PUBLIC' ? (
                                                <><Globe className="h-3 w-3 mr-1" /> Public</>
                                            ) : shareInfo.access_type === 'ORGANIZATION' ? (
                                                <><Building2 className="h-3 w-3 mr-1" /> Organization</>
                                            ) : (
                                                <><UserCheck className="h-3 w-3 mr-1" /> Invitation Only</>
                                            )}
                                        </Badge>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground mb-4">No share link generated yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Access Control */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Access Control</CardTitle>
                            <CardDescription>
                                Configure who can access your survey
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Access Type */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Access Type</label>
                                <div className="grid grid-cols-3 gap-4">
                                    <button
                                        onClick={() => setAccessType('PUBLIC')}
                                        className={`p-4 border-2 rounded-lg text-left transition-colors ${
                                            accessType === 'PUBLIC'
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <Globe className="h-5 w-5 mb-2" />
                                        <div className="font-medium">Public</div>
                                        <div className="text-sm text-muted-foreground">Anyone with the link</div>
                                    </button>
                                    <button
                                        onClick={() => setAccessType('ORGANIZATION')}
                                        className={`p-4 border-2 rounded-lg text-left transition-colors ${
                                            accessType === 'ORGANIZATION'
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <Building2 className="h-5 w-5 mb-2" />
                                        <div className="font-medium">Organization</div>
                                        <div className="text-sm text-muted-foreground">Specific email domains</div>
                                    </button>
                                    <button
                                        onClick={() => setAccessType('INVITED_ONLY')}
                                        className={`p-4 border-2 rounded-lg text-left transition-colors ${
                                            accessType === 'INVITED_ONLY'
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <UserCheck className="h-5 w-5 mb-2" />
                                        <div className="font-medium">Invitation Only</div>
                                        <div className="text-sm text-muted-foreground">Only invited emails</div>
                                    </button>
                                </div>
                            </div>

                            {/* Allowed Domains */}
                            {accessType === 'ORGANIZATION' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Allowed Email Domains</label>
                                    <Input
                                        placeholder="example.com, company.org"
                                        value={allowedDomains}
                                        onChange={(e) => setAllowedDomains(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Comma-separated list of allowed email domains
                                    </p>
                                </div>
                            )}

                            {/* Invitation Only Info */}
                            {accessType === 'INVITED_ONLY' && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <UserCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-blue-800">Invitation Only Mode</p>
                                            <p className="text-xs text-blue-700 mt-1">
                                                Only participants who receive a personal invitation email can access this survey. 
                                                The share link will be disabled - use the &quot;Email Invitations&quot; tab to invite participants.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Active Toggle */}
                            {shareInfo && (
                                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                                    <div>
                                        <p className="font-medium">Link Status</p>
                                        <p className="text-sm text-muted-foreground">
                                            {isActive ? 'Link is active' : 'Link is disabled'}
                                        </p>
                                    </div>
                                    <Checkbox
                                        checked={isActive}
                                        onCheckedChange={(checked) => setIsActive(checked === true)}
                                    />
                                </div>
                            )}

                            {/* Anonymous Participation */}
                            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                                <div>
                                    <p className="font-medium">Allow Anonymous Participation</p>
                                    <p className="text-sm text-muted-foreground">
                                        Participants can take the survey without registering
                                    </p>
                                </div>
                                <Checkbox
                                    checked={allowAnonymous}
                                    onCheckedChange={(checked) => updateAnonymousSetting(checked === true)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Security Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5" />
                                Security Settings
                            </CardTitle>
                            <CardDescription>
                                Add extra protection to your survey
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Password Protection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Lock className="h-4 w-4" />
                                    Password Protection
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder={shareInfo?.has_password ? '••••••• (already set)' : 'Set a password (optional)'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {shareInfo?.has_password 
                                        ? 'Password is set. Enter a new password to change it.'
                                        : 'Participants will need to enter this password to access the survey'}
                                </p>
                            </div>

                            {/* Expiration Date */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Link Expiration
                                </label>
                                <Input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {shareInfo?.expires_at 
                                        ? `Currently expires: ${new Date(shareInfo.expires_at).toLocaleString()}`
                                        : 'Set a date after which the link will no longer work'}
                                </p>
                            </div>

                            {/* Max Responses */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Maximum Responses
                                </label>
                                <Input
                                    type="number"
                                    placeholder={shareInfo?.max_responses ? `Currently: ${shareInfo.max_responses}` : 'No limit'}
                                    value={maxResponses}
                                    onChange={(e) => setMaxResponses(e.target.value)}
                                    min="1"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Limit the number of responses (leave empty for unlimited)
                                </p>
                            </div>

                            {/* Security Status Badges */}
                            {shareInfo && (
                                <div className="flex flex-wrap gap-2 p-4 bg-muted rounded-lg">
                                    <Badge variant={shareInfo.has_password ? 'default' : 'secondary'}>
                                        <Lock className="h-3 w-3 mr-1" />
                                        {shareInfo.has_password ? 'Password Protected' : 'No Password'}
                                    </Badge>
                                    <Badge variant={shareInfo.expires_at ? 'default' : 'secondary'}>
                                        <Clock className="h-3 w-3 mr-1" />
                                        {shareInfo.expires_at ? 'Has Expiration' : 'No Expiration'}
                                    </Badge>
                                    {shareInfo.max_responses && (
                                        <Badge variant="default">
                                            <Users className="h-3 w-3 mr-1" />
                                            Max: {shareInfo.max_responses}
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Action Buttons Card */}
                    <Card>
                        <CardContent className="pt-6">
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                {!shareInfo ? (
                                    <Button onClick={enableSharing} className="w-full">
                                        <Link2 className="h-4 w-4 mr-2" />
                                        Enable Sharing
                                    </Button>
                                ) : (
                                    <>
                                        <Button onClick={updateSharing} className="flex-1">
                                            <Settings className="h-4 w-4 mr-2" />
                                            Update Settings
                                        </Button>
                                        <Button onClick={disableSharing} variant="destructive">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Disable
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Email Invitations Tab */}
            {activeTab === 'invite' && (
                <div className="space-y-6">
                    {!shareInfo && (
                        <Card className="bg-yellow-50 border-yellow-200">
                            <CardContent className="pt-6">
                                <p className="text-yellow-800">
                                    <strong>Note:</strong> Please enable sharing in the "Share Settings" tab first before sending invitations.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Email Invitations
                            </CardTitle>
                            <CardDescription>
                                Upload an Excel file or manually add email addresses
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* File Upload */}
                            <div className="flex gap-2">
                                <Input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="flex-1"
                                />
                                <Button variant="outline" onClick={downloadTemplate}>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Template
                                </Button>
                            </div>

                            {/* Manual Email Input */}
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter email address"
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && addEmail()}
                                />
                                <Button onClick={addEmail}>
                                    Add
                                </Button>
                            </div>

                            {/* Email List */}
                            {emails.length > 0 && (
                                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-medium">{emails.length} email(s) added</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEmails([])}
                                        >
                                            Clear All
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {emails.map((email, index) => (
                                            <Badge key={index} variant="secondary" className="gap-1">
                                                {email}
                                                <button
                                                    onClick={() => removeEmail(email)}
                                                    className="ml-1 hover:text-red-600"
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Send Button */}
                            <Button
                                onClick={sendInvitations}
                                disabled={emails.length === 0 || !shareInfo || sending}
                                className="w-full"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Send {emails.length} Invitation{emails.length !== 1 ? 's' : ''}
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Access Logs Tab */}
            {activeTab === 'logs' && (
                <AccessLogsSection surveyId={surveyId} />
            )}
        </div>
    );
}

// Access Logs Section Component
function AccessLogsSection({ surveyId }: { surveyId: string }) {
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'granted' | 'denied'>('all');
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    interface AccessLog {
        id: number;
        survey_id: number;
        user_email: string;
        access_granted: boolean;
        denial_reason?: string;
        ip_address?: string;
        user_agent?: string;
        browser_name?: string;
        device_type?: string;
        invitation_id?: number;
        participant_id?: number;
        accessed_at: string;
    }

    useEffect(() => {
        loadLogs();
    }, [surveyId]);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${surveyConfig.baseUrl}/api/v1/surveys/${surveyId}/sharing/logs?limit=100`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setLogs(data.data || []);
            }
        } catch (error) {
            console.error('Error loading access logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        if (filter === 'granted') return log.access_granted;
        if (filter === 'denied') return !log.access_granted;
        return true;
    });

    const exportToCSV = () => {
        const headers = ['Date', 'Email', 'Status', 'IP Address', 'Browser', 'Device', 'User Agent', 'Denial Reason'];
        const rows = filteredLogs.map(log => [
            new Date(log.accessed_at).toLocaleString(),
            log.user_email,
            log.access_granted ? 'Granted' : 'Denied',
            log.ip_address || '',
            log.browser_name || '',
            log.device_type || '',
            log.user_agent || '',
            log.denial_reason || ''
        ]);

        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `access_logs_survey_${surveyId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getDeviceIcon = (deviceType?: string) => {
        switch (deviceType?.toLowerCase()) {
            case 'mobile':
                return <span title="Mobile">📱</span>;
            case 'tablet':
                return <span title="Tablet">📱</span>;
            case 'desktop':
                return <span title="Desktop">🖥️</span>;
            default:
                return <span title="Unknown">💻</span>;
        }
    };

    const toggleExpand = (logId: number) => {
        setExpandedLogId(expandedLogId === logId ? null : logId);
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="text-muted-foreground mt-4">Loading access logs...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="h-5 w-5" />
                                Access Logs
                            </CardTitle>
                            <CardDescription>
                                Track who accessed your shared survey with device and browser info
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={loadLogs}>
                                Refresh
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportToCSV}>
                                Export CSV
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filter */}
                    <div className="flex gap-2 mb-4">
                        <Button
                            variant={filter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('all')}
                        >
                            All ({logs.length})
                        </Button>
                        <Button
                            variant={filter === 'granted' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('granted')}
                        >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Granted ({logs.filter(l => l.access_granted).length})
                        </Button>
                        <Button
                            variant={filter === 'denied' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('denied')}
                        >
                            <XCircle className="h-3 w-3 mr-1" />
                            Denied ({logs.filter(l => !l.access_granted).length})
                        </Button>
                    </div>

                    {/* Logs Table */}
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No access logs yet
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Browser</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredLogs.map((log) => (
                                        <Fragment key={log.id}>
                                            <tr
                                                className="hover:bg-gray-50 cursor-pointer"
                                                onClick={() => toggleExpand(log.id)}
                                            >
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {new Date(log.accessed_at).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {log.user_email}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={log.access_granted ? 'default' : 'destructive'}>
                                                        {log.access_granted ? 'Granted' : 'Denied'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className="flex items-center gap-1">
                                                        {getDeviceIcon(log.device_type)}
                                                        <span className="text-gray-600 capitalize">{log.device_type || '-'}</span>
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {log.browser_name || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                                                    {log.ip_address || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {log.denial_reason ? (
                                                        <span className="text-red-600">{log.denial_reason}</span>
                                                    ) : (
                                                        <span className="text-blue-600 hover:underline">
                                                            {expandedLogId === log.id ? 'Hide details' : 'View details'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                            {expandedLogId === log.id && (
                                                <tr key={`${log.id}-details`} className="bg-gray-50">
                                                    <td colSpan={7} className="px-4 py-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                                            <div className="bg-white p-3 rounded-lg border">
                                                                <div className="text-xs text-gray-500 uppercase font-medium mb-1">Device Type</div>
                                                                <div className="flex items-center gap-2">
                                                                    {getDeviceIcon(log.device_type)}
                                                                    <span className="capitalize">{log.device_type || 'Unknown'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-white p-3 rounded-lg border">
                                                                <div className="text-xs text-gray-500 uppercase font-medium mb-1">Browser</div>
                                                                <div>{log.browser_name || 'Unknown'}</div>
                                                            </div>
                                                            <div className="bg-white p-3 rounded-lg border">
                                                                <div className="text-xs text-gray-500 uppercase font-medium mb-1">IP Address</div>
                                                                <div className="font-mono">{log.ip_address || 'Unknown'}</div>
                                                            </div>
                                                            <div className="bg-white p-3 rounded-lg border">
                                                                <div className="text-xs text-gray-500 uppercase font-medium mb-1">Access Time</div>
                                                                <div>{new Date(log.accessed_at).toLocaleString()}</div>
                                                            </div>
                                                            {log.user_agent && (
                                                                <div className="bg-white p-3 rounded-lg border md:col-span-2 lg:col-span-4">
                                                                    <div className="text-xs text-gray-500 uppercase font-medium mb-1">User Agent</div>
                                                                    <div className="font-mono text-xs break-all text-gray-600">{log.user_agent}</div>
                                                                </div>
                                                            )}
                                                            {log.denial_reason && (
                                                                <div className="bg-red-50 p-3 rounded-lg border border-red-200 md:col-span-2 lg:col-span-4">
                                                                    <div className="text-xs text-red-500 uppercase font-medium mb-1">Denial Reason</div>
                                                                    <div className="text-red-700">{log.denial_reason}</div>
                                                                </div>
                                                            )}
                                                            {log.invitation_id && (
                                                                <div className="bg-white p-3 rounded-lg border">
                                                                    <div className="text-xs text-gray-500 uppercase font-medium mb-1">Invitation ID</div>
                                                                    <div>#{log.invitation_id}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
