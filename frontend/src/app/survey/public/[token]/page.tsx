"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Turnstile } from '@marsidev/react-turnstile';
import { surveyConfig, TURNSTILE_SITE_KEY } from '@/lib/api-config';
import { 
    Loader2, 
    Lock, 
    Mail, 
    AlertCircle, 
    CheckCircle,
    FileQuestion,
    ArrowRight,
    Eye,
    EyeOff,
    Building2
} from 'lucide-react';

const SURVEY_URL = surveyConfig.baseUrl;

interface ValidationResult {
    success: boolean;
    requiresPassword?: boolean;
    requiresLogin?: boolean;
    accessType?: string;
    allowedDomains?: string;
    data?: {
        surveyId: number;
        title: string;
        allowAnonymous: boolean;
        invitedEmail?: string; // Email the invitation was sent to (for invitation tokens)
    };
    error?: string;
    message?: string;
    reason?: string;
}

type ValidationStep = 'loading' | 'captcha' | 'email' | 'password' | 'org_email' | 'org_otp' | 'ready' | 'error';

export default function PublicSurveyPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const token = params.token as string;

    // State
    const [step, setStep] = useState<ValidationStep>('loading');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [surveyInfo, setSurveyInfo] = useState<{
        surveyId: number;
        title: string;
        allowAnonymous: boolean;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [allowedDomains, setAllowedDomains] = useState<string>('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    
    // Ref to prevent re-validation after successful OTP verification or access grant
    const hasValidatedRef = useRef(false);

    // Initial token validation - wait for auth to load first
    useEffect(() => {
        if (authLoading) return; // Wait for auth check to complete

        // Don't re-validate if we've already successfully validated (OTP verified or access granted)
        if (hasValidatedRef.current) return;

        // For initial validation, don't pass user email automatically
        // This ensures ORGANIZATION surveys always require email verification (OTP)
        // The user will enter their email and verify via OTP even if logged in
        // This is more secure as it confirms the user controls the email address
        validateToken(undefined, undefined);
    }, [token, authLoading]);

    const validateToken = async (passwordAttempt?: string, emailAttempt?: string) => {
        try {
            setLoading(true);
            
            const requestBody: Record<string, string> = {};
            if (emailAttempt) requestBody.email = emailAttempt;
            if (passwordAttempt) requestBody.password = passwordAttempt;

            // Check if this is an invitation token or a share token
            const urlParams = new URLSearchParams(window.location.search);
            const tokenType = urlParams.get('type');
            
            const endpoint = tokenType === 'invitation'
                ? `${SURVEY_URL}/api/v1/surveys/public/validate-invitation?token=${encodeURIComponent(token)}`
                : `${SURVEY_URL}/api/v1/surveys/public/validate-access?token=${encodeURIComponent(token)}`;

            const response = await fetch(
                endpoint,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(requestBody)
                }
            );

            const result: ValidationResult = await response.json();

            // Handle ORGANIZATION access - requires OTP email verification
            if (result.requiresLogin && !result.success) {
                setSurveyInfo(result.data || null);
                setAllowedDomains(result.allowedDomains || '');
                setRequiresPassword(result.requiresPassword || false);
                setStep('org_email');
                return;
            }

            if (result.requiresPassword && !result.success && !passwordAttempt) {
                // Password is required but not provided yet
                setRequiresPassword(true);
                setSurveyInfo(result.data || null);
                setStep('password');
                return;
            }

            if (!response.ok || !result.success) {
                if (result.reason === 'INVALID_PASSWORD') {
                    setPasswordError('Incorrect password. Please check and try again.');
                    toast.error('Incorrect password. Please try again.');
                    return;
                }
                if (result.reason === 'INVALID_EMAIL_DOMAIN') {
                    toast.error(result.message || 'Your email domain is not authorized for this survey.');
                    setStep('org_email');
                    return;
                }
                setError(result.message || result.error || 'Invalid or expired link');
                setStep('error');
                return;
            }

            // Success - store survey info
            setSurveyInfo(result.data || null);

            // IMPORTANT: Store the validated email in state and sessionStorage
            // This handles the case where a logged-in user's email auto-validates
            // OR when an invitation token contains the invited email
            const effectiveEmail = emailAttempt || result.data?.invitedEmail;
            if (effectiveEmail) {
                console.log('[DEBUG] validateToken success - storing email:', effectiveEmail, '(from:', emailAttempt ? 'user input' : 'invitation', ')');
                setEmail(effectiveEmail);
                sessionStorage.setItem('survey_participant_email', effectiveEmail);
            }

            if (result.data?.allowAnonymous && !effectiveEmail) {
                // Anonymous access — check if already submitted (cookie), then show CAPTCHA
                const cookieKey = `survey_submitted_${result.data?.surveyId}`;
                if (document.cookie.includes(cookieKey)) {
                    setError('You have already submitted this survey.');
                    setStep('error');
                    return;
                }
                setStep('captcha');
            } else {
                // Ready to proceed - mark as validated to prevent re-validation
                hasValidatedRef.current = true;
                setStep('ready');
            }
        } catch (err) {
            console.error('Token validation error:', err);
            setError('Failed to validate access. Please try again.');
            setStep('error');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError(null);
        if (!password.trim()) {
            toast.error('Please enter a password');
            return;
        }
        await validateToken(password, email || undefined);
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        // Re-validate with email
        if (requiresPassword) {
            await validateToken(password, email);
        } else {
            await validateToken(undefined, email);
        }
    };

    const handleStartSurvey = () => {
        if (!surveyInfo) return;

        // Set dedup cookie (7 days) — soft prevents re-submission for anonymous surveys
        const cookieKey = `survey_submitted_${surveyInfo.surveyId}`;
        document.cookie = `${cookieKey}=1; max-age=${7 * 24 * 60 * 60}; path=/; SameSite=Lax`;

        // Get email from state OR sessionStorage (state may be lost during re-renders)
        const participantEmail = email || sessionStorage.getItem('survey_participant_email') || '';
        console.log('[DEBUG] handleStartSurvey - email from state:', email, 'from sessionStorage:', sessionStorage.getItem('survey_participant_email'), 'using:', participantEmail);

        // Store email in session storage for the survey taking page
        if (participantEmail) {
            sessionStorage.setItem('survey_participant_email', participantEmail);
        }

        // Store password if it was used (for password-protected surveys)
        if (password && requiresPassword) {
            sessionStorage.setItem('survey_access_password', password);
        }

        // Check if this is an invitation token (from URL query params)
        const urlParams = new URLSearchParams(window.location.search);
        const tokenType = urlParams.get('type');

        // Navigate to survey taking page, preserving token type if present
        // Also pass email as URL parameter as backup (in case sessionStorage doesn't persist)
        let navigateUrl = `/survey/take/${surveyInfo.surveyId}?token=${token}`;
        if (tokenType === 'invitation') {
            navigateUrl += '&type=invitation';
        }
        if (participantEmail) {
            navigateUrl += `&email=${encodeURIComponent(participantEmail)}`;
        }
        console.log('[DEBUG] handleStartSurvey - navigating to:', navigateUrl);
        router.push(navigateUrl);
    };

    // Send OTP for organization email verification
    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        // Store email in sessionStorage early (in case it's lost during state transitions)
        console.log('[DEBUG] handleSendOTP - storing email in sessionStorage:', email);
        sessionStorage.setItem('survey_participant_email', email);

        try {
            setSendingOtp(true);
            const response = await fetch(`${SURVEY_URL}/api/v1/surveys/public/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, shareToken: token })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                toast.error(result.error || result.message || 'Failed to send verification code');
                return;
            }

            toast.success('Verification code sent to your email');
            setOtpSent(true);
            setStep('org_otp');
        } catch (err) {
            console.error('Send OTP error:', err);
            toast.error('Failed to send verification code. Please try again.');
        } finally {
            setSendingOtp(false);
        }
    };

    // Verify OTP
    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();

        if (otp.length !== 6) {
            toast.error('Please enter a 6-digit verification code');
            return;
        }

        // Get email from state, or fallback to sessionStorage if state was lost
        const verifiedEmail = email || sessionStorage.getItem('survey_participant_email') || '';
        console.log('[DEBUG] handleVerifyOTP - email from state:', email, 'from sessionStorage:', sessionStorage.getItem('survey_participant_email'));

        if (!verifiedEmail) {
            toast.error('Email not found. Please start over.');
            setStep('org_email');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${SURVEY_URL}/api/v1/surveys/public/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: verifiedEmail, otp })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                toast.error(result.error || 'Invalid verification code');
                return;
            }

            toast.success('Email verified successfully!');

            // Mark as validated to prevent useEffect from re-running validation
            hasValidatedRef.current = true;

            // Store verified email (ensure it's in sessionStorage)
            console.log('[DEBUG] handleVerifyOTP success - storing email:', verifiedEmail);
            sessionStorage.setItem('survey_participant_email', verifiedEmail);

            // Also update state if it was lost
            if (!email && verifiedEmail) {
                setEmail(verifiedEmail);
            }

            // Now validate access with verified email
            if (requiresPassword) {
                setStep('password');
            } else {
                // Re-validate with verified email
                await validateToken(undefined, verifiedEmail);
            }
        } catch (err) {
            console.error('Verify OTP error:', err);
            toast.error('Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResendOTP = async () => {
        setOtp('');
        await handleSendOTP({ preventDefault: () => {} } as React.FormEvent);
    };

    // Loading state
    if (step === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <Card className="w-full max-w-md mx-4">
                    <CardContent className="py-12 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
                        <p className="text-muted-foreground mt-4">Validating your access...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state
    if (step === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
                <Card className="w-full max-w-md mx-4">
                    <CardContent className="py-12 text-center">
                        <div className="bg-red-100 rounded-full p-4 w-fit mx-auto mb-4">
                            <AlertCircle className="h-12 w-12 text-red-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
                        <p className="text-muted-foreground mb-6">{error}</p>
                        <Button onClick={() => router.push('/')} variant="outline">
                            Go to Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Email verification - Step 1: Enter email (used for both org and anonymous surveys)
    if (step === 'org_email') {
        const isOrgSurvey = allowedDomains && allowedDomains.trim() !== '';
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-4">
                            {isOrgSurvey ? <Building2 className="h-8 w-8 text-blue-600" /> : <Mail className="h-8 w-8 text-blue-600" />}
                        </div>
                        <CardTitle>{isOrgSurvey ? 'Organization Access' : 'Verify Your Email'}</CardTitle>
                        <CardDescription>
                            {surveyInfo?.title ? (
                                <>Verify your email to access &quot;{surveyInfo.title}&quot;</>
                            ) : (
                                <>This survey requires email verification</>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isOrgSurvey && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800 mb-2">
                                <strong>Allowed email domains:</strong>
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {allowedDomains.split(',').map((domain, idx) => (
                                    <span
                                        key={idx}
                                        className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm font-mono"
                                    >
                                        @{domain.trim()}
                                    </span>
                                ))}
                            </div>
                        </div>
                        )}
                        
                        {requiresPassword && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                                <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-amber-800 font-medium">Password Protected</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        After email verification, you&apos;ll need to enter the survey password.
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        <form onSubmit={handleSendOTP} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="org-email">Your Organization Email</Label>
                                <Input
                                    id="org-email"
                                    type="email"
                                    placeholder="name@organization.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={sendingOtp}>
                                {sendingOtp ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Sending Code...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="h-4 w-4 mr-2" />
                                        Send Verification Code
                                    </>
                                )}
                            </Button>
                        </form>
                        
                        <p className="text-xs text-muted-foreground text-center">
                            We&apos;ll send a 6-digit code to verify your email. Your email is not stored — only a hash is used to track attempts.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Organization email verification - Step 2: Enter OTP
    if (step === 'org_otp') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="bg-green-100 rounded-full p-4 w-fit mx-auto mb-4">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle>Enter Verification Code</CardTitle>
                        <CardDescription>
                            We sent a 6-digit code to <strong>{email}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleVerifyOTP} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="otp">Verification Code</Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="text-center text-2xl tracking-widest font-mono"
                                    autoComplete="one-time-code"
                                    autoFocus
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        <ArrowRight className="h-4 w-4 mr-2" />
                                        Verify & Continue
                                    </>
                                )}
                            </Button>
                        </form>
                        
                        <div className="flex items-center justify-between text-sm">
                            <button 
                                onClick={() => setStep('org_email')}
                                className="text-muted-foreground hover:text-gray-900"
                            >
                                ← Change email
                            </button>
                            <button 
                                onClick={handleResendOTP}
                                className="text-blue-600 hover:underline"
                                disabled={sendingOtp}
                            >
                                {sendingOtp ? 'Sending...' : 'Resend code'}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Password required state
    if (step === 'password') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="bg-amber-100 rounded-full p-4 w-fit mx-auto mb-4">
                            <Lock className="h-8 w-8 text-amber-600" />
                        </div>
                        <CardTitle>Password Protected</CardTitle>
                        <CardDescription>
                            {surveyInfo?.title ? (
                                <>This survey &quot;{surveyInfo.title}&quot; requires a password to access</>
                            ) : (
                                <>This survey requires a password to access</>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            {passwordError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                    <p className="text-sm text-red-700">{passwordError}</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter survey password"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setPasswordError(null);
                                        }}
                                        autoComplete="current-password"
                                        autoFocus
                                        className={passwordError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Enter the password that was set when sharing was enabled for this survey.
                                </p>
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // CAPTCHA step for anonymous access (no email required)
    if (step === 'captcha') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-4">
                            <FileQuestion className="h-8 w-8 text-blue-600" />
                        </div>
                        <CardTitle>{surveyInfo?.title || 'Survey'}</CardTitle>
                        <CardDescription>
                            Please verify you're human to continue. No personal data is collected.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-center">
                            <Turnstile
                                siteKey={TURNSTILE_SITE_KEY}
                                onSuccess={(token) => {
                                    setCaptchaToken(token);
                                }}
                                onError={() => {
                                    toast.error('Verification failed. Please try again.');
                                }}
                            />
                        </div>

                        <Button
                            className="w-full"
                            size="lg"
                            disabled={!captchaToken}
                            onClick={() => {
                                hasValidatedRef.current = true;
                                setStep('ready');
                            }}
                        >
                            {captchaToken ? (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Continue to Survey
                                </>
                            ) : (
                                'Complete verification above'
                            )}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                            This survey is completely anonymous. We do not collect your email, device info, or IP address.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Email input state (for anonymous access — legacy, kept for backwards compat)
    if (step === 'email') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-4">
                            <Mail className="h-8 w-8 text-blue-600" />
                        </div>
                        <CardTitle>Enter Your Email</CardTitle>
                        <CardDescription>
                            {surveyInfo?.title && (
                                <span className="block font-medium text-gray-700 mb-2">"{surveyInfo.title}"</span>
                            )}
                            Please provide your email address to continue. No registration required.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="your.email@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs text-muted-foreground">
                                    Your email will only be used to track your response.
                                </p>
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Validating...
                                    </>
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Ready to start state
    // Get display email from state or sessionStorage
    const displayEmail = email || sessionStorage.getItem('survey_participant_email') || '';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="bg-green-100 rounded-full p-4 w-fit mx-auto mb-4">
                        <FileQuestion className="h-8 w-8 text-green-600" />
                    </div>
                    <CardTitle>{surveyInfo?.title || 'Survey'}</CardTitle>
                    <CardDescription>
                        You're ready to take this survey
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <p className="text-sm text-green-800">
                            Access verified! Click below to start.
                        </p>
                    </div>

                    {displayEmail && (
                        <div className="text-center text-sm text-muted-foreground">
                            Participating as: <span className="font-medium">{displayEmail}</span>
                        </div>
                    )}

                    <Button onClick={handleStartSurvey} className="w-full" size="lg">
                        Start Survey
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

