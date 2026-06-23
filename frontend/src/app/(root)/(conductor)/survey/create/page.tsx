// app/survey_create/page.tsx

"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { Loader2, Save, X, Upload, FileImage, Plus, Trash2, User, Mail, Hash, Phone } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { debounce } from 'perfect-debounce';
import { useAuth } from "@/context/AuthContext";
import { QuizTemplateUploader } from "@/components/survey/QuizTemplateUploader";
import { CodeQuestionEditor } from "@/components/survey/CodeQuestionEditor";
import { surveyApi } from "@/services/surveyApi";
import { authConfig, surveyConfig } from '@/lib/api-config';

// Code test case type
interface CodeTestCase {
    id: string;
    input: string;
    expectedOutput: string;
    hidden: boolean;
}

// Code settings for code questions
interface CodeSettings {
    defaultLanguage: string;
    allowedLanguages: string[];
    testCases: CodeTestCase[];
    starterCode: Record<string, string>;
}

// Type definitions
interface Question {
    id: string;
    text: string;
    type: "multiple-choice" | "single-choice" | "text" | "rating" | "code" | "image-upload";
    options: Option[];
    mandatory: boolean;
    correctAnswers?: string;
    points?: number;
    explanation?: string;
    requiresJustification?: boolean;
    justificationRequired?: boolean;
    codeSettings?: CodeSettings;
    mediaFiles?: Array<{
        id: string;
        url: string;
        type: string;
        status: 'UPLOADING' | 'READY' | 'ERROR';
    }>;
}

interface Option {
    id: string;
    text: string;
}

// Custom participant field definition
interface ParticipantField {
    id: string;
    label: string;
    type: 'text' | 'email' | 'number' | 'tel';
    required: boolean;
    placeholder?: string;
}

interface DraftQuestion {
    question_id: number;
    tempId?: string;
    question_text: string;
    question_type: string;
    mandatory: boolean;
    correct_answers?: string;
    points?: number;
    explanation?: string;
    requires_justification?: boolean;
    justification_required?: boolean;
    mediaFiles?: Array<{
        mediaId: number;
        fileUrl: string;
        fileType: string;
        status: 'UPLOADING' | 'READY' | 'ERROR';
    }>;
}

interface DraftOption {
    optionId: string;
    question_id: number;
    questionTempId?: string;
    option_text: string;
}

interface SurveyDraft {
    draftId?: number;
    surveyId?: number;
    draftContent: {
        basicInfo: {
            title: string;
            description: string;
            is_self_recruitment: boolean;
            conductor_id: number;
            status: string;
            question_display_mode?: 'one_by_one' | 'all_at_once';
            is_quiz?: boolean;
            time_limit_minutes?: number;
            passing_score_percentage?: number;
            show_correct_answers?: boolean;
            shuffle_questions?: boolean;
            shuffle_options?: boolean;
            max_attempts?: number; // Max times a participant can take this quiz (null = unlimited)
            requires_manual_evaluation?: boolean; // If true, conductor must manually grade submissions
            allow_anonymous?: boolean; // If true, participants don't need to register
            participant_fields?: ParticipantField[]; // Custom fields to collect from participants
        };
        questions: Array<DraftQuestion>;
        options: Array<DraftOption>;
    };
    lastSaved: string;
    lastEditedQuestion?: string;
}

// Type for parsed draft data from localStorage
interface ParsedDraftQuestion {
    question_id?: number;
    tempId?: string;
    question_text: string;
    question_type: string;
    mandatory: boolean;
    correct_answers?: string;
    points?: number;
    explanation?: string;
    requires_justification?: boolean;
    justification_required?: boolean;
    options?: string[];
    mediaFiles?: Array<{
        mediaId: number;
        fileUrl: string;
        fileType: string;
        status: 'UPLOADING' | 'READY' | 'ERROR';
    }>;
}

interface ParsedDraftOption {
    optionId: string;
    question_id?: number;
    questionTempId?: string;
    option_text: string;
}

// Type for server response
interface ServerResponse {
    data?: {
        draftId?: number;
        surveyId?: number;
    };
    draftId?: number;
    surveyId?: number;
    [key: string]: unknown;
}

const STORAGE_KEY = 'currentSurveyDraft';
const BACKUP_KEY = `${STORAGE_KEY}-backup`;

// Direct service URLs - no proxies
const AUTH_URL = authConfig.baseUrl;
const SURVEY_URL = surveyConfig.baseUrl;

// Type for window with requestIdleCallback support
type WindowWithIdleCallback = Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

export default function SurveyCreatePageWrapper() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
            <SurveyCreatePage />
        </Suspense>
    );
}

function SurveyCreatePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isAuthenticated, loading } = useAuth();
    const editSurveyId = searchParams.get("editSurveyId");
    const draftIdParam = searchParams.get("draftId");
    const isNewSurvey = searchParams.get("new") === "true";

    const [isLoading, setIsLoading] = useState(false);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentSection, setCurrentSection] = useState<'basic' | 'questions' | 'publish'>('basic');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [conductorInfo, setConductorInfo] = useState<{ conductorId: number } | null>(null);
    
    // Initialize draft state
    const [draft, setDraft] = useState<SurveyDraft>({
        draftContent: {
            basicInfo: {
                title: '',
                description: '',
                is_self_recruitment: false,
                status: 'DRAFT',
                conductor_id: 0, // Will be set after loading conductor info
                question_display_mode: 'one_by_one',
                is_quiz: false,
                time_limit_minutes: undefined,
                passing_score_percentage: undefined,
                allow_anonymous: false, // Default: require registration
                show_correct_answers: true,
                shuffle_questions: false,
                shuffle_options: false,
                max_attempts: undefined, // Unlimited by default
                requires_manual_evaluation: false, // Auto-evaluate by default
                participant_fields: [] // Custom fields to collect from participants
            },
            questions: [],
            options: []
        },
        lastSaved: new Date().toISOString()
    });

    // Track if a sync is in progress
    const isSyncingRef = useRef(false);
    // Track the latest draft that needs to be synced
    const pendingDraftRef = useRef<SurveyDraft | null>(null);
    // Always keep a ref to the latest draft state (avoids stale closures in async handlers)
    const draftRef = useRef(draft);
    useEffect(() => { draftRef.current = draft; }, [draft]);

    // Utility function to save to localStorage without triggering sync
    const saveToLocalStorage = (draftToSave: SurveyDraft, key = STORAGE_KEY) => {
        try {
            // Use requestIdleCallback for non-critical operations when browser is idle
            // Fall back to setTimeout with zero delay if requestIdleCallback isn't available
            const saveOperation = () => {
                const serialized = JSON.stringify(draftToSave);
                
                // Check size before saving
                if (serialized.length > 4 * 1024 * 1024) { // 4MB safety threshold
                    toast.warning("Draft is getting large, consider publishing soon");
                }
                
                localStorage.setItem(key, serialized);
            };
            
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                (window as WindowWithIdleCallback).requestIdleCallback?.(saveOperation, { timeout: 1000 });
            } else {
                setTimeout(saveOperation, 0);
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            toast.error("Failed to save draft locally");
        }
    };


    // Function to find draft ID in server response
    const findDraftIdInResponse = (obj: ServerResponse): number | null => {
        if (!obj || typeof obj !== 'object') return null;
        
        // Direct check for draftId (case sensitive and insensitive)
        if ('draftId' in obj && typeof obj.draftId === 'number') return obj.draftId;
        if ('draft_id' in obj && typeof obj.draft_id === 'number') return obj.draft_id as number;
        
        // Search for any property containing 'draft' and 'id'
        for (const key in obj) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('draft') && lowerKey.includes('id') && typeof obj[key] === 'number') {
                return obj[key] as number;
            }
            
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                const found = findDraftIdInResponse(obj[key] as ServerResponse);
                if (found) return found;
            }
        }
        return null;
    };

    // Sync with backend
    const syncWithBackend = async (draftData: SurveyDraft) => {
        // Don't sync if there's no meaningful content
        if (!draftData.draftContent.basicInfo.title && draftData.draftContent.questions.length === 0) {
            return;
        }
        
        // Check localStorage for draftId if not present in current data
        let validDraftId = null;
        if (!draftData.draftId) {
            const savedDraft = localStorage.getItem(STORAGE_KEY);
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    if (parsed.draftId) {
                        console.log(`Retrieved draftId ${parsed.draftId} from localStorage`);
                        validDraftId = parsed.draftId;
                        draftData.draftId = validDraftId;
                    }
                } catch (e) {
                    console.error('Error parsing localStorage draft:', e);
                }
            }
        } else {
            validDraftId = draftData.draftId;
        }
        
        // Create a question ID mapping for normalization (only non-blank questions)
        const questionIdMap = new Map<number, number>();
        let normalizedIdx = 1;
        draftData.draftContent.questions.forEach((question) => {
            if ((question.question_text || "").trim() === "") return;
            const originalId = question.question_id;
            if (originalId !== undefined) {
                questionIdMap.set(originalId, normalizedIdx);
                normalizedIdx++;
            }
        });
        
        // Transform data to match backend schema
        const transformedContent = {
            basicInfo: {
                title: draftData.draftContent.basicInfo.title,
                description: draftData.draftContent.basicInfo.description,
                is_self_recruitment: draftData.draftContent.basicInfo.is_self_recruitment,
                status: draftData.draftContent.basicInfo.status,
                conductor_id: draftData.draftContent.basicInfo.conductor_id,
                question_display_mode: draftData.draftContent.basicInfo.question_display_mode || 'one_by_one',
                // Distribution settings
                allow_anonymous: draftData.draftContent.basicInfo.allow_anonymous || false,
                // Quiz-specific fields
                is_quiz: draftData.draftContent.basicInfo.is_quiz || false,
                time_limit_minutes: draftData.draftContent.basicInfo.time_limit_minutes,
                passing_score_percentage: draftData.draftContent.basicInfo.passing_score_percentage,
                show_correct_answers: draftData.draftContent.basicInfo.show_correct_answers,
                shuffle_questions: draftData.draftContent.basicInfo.shuffle_questions,
                shuffle_options: draftData.draftContent.basicInfo.shuffle_options,
                max_attempts: draftData.draftContent.basicInfo.max_attempts,
                // Custom participant fields
                participant_fields: draftData.draftContent.basicInfo.participant_fields || []
            },
            questions: draftData.draftContent.questions
                .filter(q => (q.question_text || "").trim() !== "")
                .map((q, index) => ({
                    question_id: index + 1,
                    question_text: q.question_text,
                    question_type: q.question_type,
                    mandatory: q.mandatory,
                    correct_answers: q.correct_answers || "",
                    points: q.points || 1,
                    explanation: q.explanation || "",
                    requires_justification: q.requires_justification || false,
                    justification_required: q.justification_required || false
                })),
            options: draftData.draftContent.options
                .filter(opt => questionIdMap.has(opt.question_id))
                .map(opt => ({
                    option_text: opt.option_text,
                    question_id: questionIdMap.get(opt.question_id) || 1
                })),
            mediaFiles: draftData.draftContent.questions
                .filter(q => (q.question_text || "").trim() !== "")
                .flatMap(q => 
                    (q.mediaFiles || []).map(m => ({
                        question_id: questionIdMap.get(q.question_id) || 1,
                        file_url: m.fileUrl,
                        file_type: m.fileType
                    }))
                )
        };

        // Log normalized mappings for debugging
        console.log('Question ID normalization map:', Object.fromEntries(questionIdMap));
        console.log('Normalized options:', transformedContent.options);

        try {
            // Verify if the draft actually exists on the backend before deciding on PUT vs POST
            let method = 'POST';
            let endpoint = `${SURVEY_URL}/api/v1/drafts`;
            
            // Only use PUT if we have a valid draft ID that was previously saved
            if (validDraftId) {
                try {
                    // First try with HEAD request (lightweight)
                    // Auth is handled automatically via HTTP-only cookies
                    let checkResponse = await fetch(`${SURVEY_URL}/api/v1/drafts/${validDraftId}`, {
                        method: 'HEAD',
                        credentials: 'include'
                    });
                    
                    // If HEAD method is not supported, fall back to GET
                    if (checkResponse.status === 405) { // Method Not Allowed
                        console.log('HEAD method not supported, falling back to GET');
                        checkResponse = await fetch(`${SURVEY_URL}/api/v1/drafts/${validDraftId}`, {
                            method: 'GET',
                            credentials: 'include'
                        });
                    }
                    
                    if (checkResponse.ok) {
                        method = 'PUT';
                        endpoint = `${SURVEY_URL}/api/v1/drafts/${validDraftId}`;
                        console.log(`Draft with ID ${validDraftId} exists, using PUT method`);
                    } else {
                        console.log(`Draft with ID ${validDraftId} does not exist (status: ${checkResponse.status}), using POST method`);
                        // Reset the draftId since it doesn't exist on the server
                        draftData.draftId = undefined;
                    }
                } catch (error) {
                    console.error('Error checking if draft exists:', error);
                    console.log('Falling back to POST method');
                    // Reset the draftId since we couldn't verify it
                    draftData.draftId = undefined;
                }
            } else {
                console.log('No valid draft ID found, using POST method');
            }
            
            console.log(`Syncing with method: ${method}, endpoint: ${endpoint}`);
            console.log('Draft data being sent:', JSON.stringify(transformedContent, null, 2));
            
            const requestBody = {
                survey_id: draftData.surveyId || 0, // 0 = new survey, >0 = updating existing
                draft_content: transformedContent,
                last_edited_question: draftData.lastEditedQuestion ? parseInt(draftData.lastEditedQuestion) : 0,
                draft_id: validDraftId || undefined // Initialize with value or undefined
            };
            
            // Auth token is in HTTP-only cookie, sent automatically with credentials: 'include'
            const headers: Record<string, string> = { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            };
            
            console.log('Request headers:', headers);
            console.log('Full request body:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch(endpoint, {
                method: method,
                headers: headers,
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.error('Response not OK:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: response.url
                });
                
                // Try to get the error response body
                let errorBody = '';
                try {
                    errorBody = await response.text();
                    console.error('Error response body:', errorBody);
                } catch (e) {
                    console.error('Could not read error response body:', e);
                }
                
                throw new Error(`Failed to sync with server: ${response.status} ${response.statusText} - ${errorBody}`);
            }

            const result: ServerResponse = await response.json();
            console.log('Server response:', result);
            console.log('Response data.draftId:', result.data?.draftId);
            
            // Deep debug the server response structure
            console.log('Response structure:', {
                hasDataProperty: 'data' in result,
                dataType: typeof result.data,
                dataKeys: result.data ? Object.keys(result.data) : 'no data object',
                draftIdInData: result.data && 'draftId' in result.data
            });
            
            // Simplified draftId detection - directly access the expected path first
            let draftIdFromResponse = null;
            
            // Direct access to the expected structure based on your server response
            if (result.data && typeof result.data === 'object' && result.data.draftId) {
                draftIdFromResponse = result.data.draftId;
                console.log('Found draftId in result.data:', draftIdFromResponse);
            } 
            // Fallback to top level
            else if (result.draftId) {
                draftIdFromResponse = result.draftId;
                console.log('Found draftId in top level result:', draftIdFromResponse);
            }
            // Fallback to deep search only if needed
            else {
                console.log('Searching for draftId in response...');
                draftIdFromResponse = findDraftIdInResponse(result);
                if (draftIdFromResponse) {
                    console.log('Found draftId in nested structure:', draftIdFromResponse);
                }
            }
            
            // If we found a draftId, use it - this is executed regardless of finding method
            if (draftIdFromResponse) {
                const updatedDraft = {
                    ...draftData,
                    draftId: draftIdFromResponse,
                    lastSaved: new Date().toISOString()
                };
                
                console.log('Updated draft with draftId:', updatedDraft.draftId);
                
                // Save to localStorage immediately to ensure draftId persistence
                saveToLocalStorage(updatedDraft);
                
                // Update state
                setDraft(updatedDraft);
                setLastSynced(new Date());
                
                return updatedDraft;
            }
            
            // If this was a POST request and we still don't have a draftId, that's an error
            if (method === 'POST' && !draftIdFromResponse) {
                console.error('Server did not return draftId for POST request');
                console.error('Full server response:', JSON.stringify(result, null, 2));
                console.error('Response status:', response.status);
                console.error('Response has draftId in expected location:', !!result.data?.draftId);
                throw new Error('Server did not return draftId for POST request');
            }

            // This code only executes for PUT requests that didn't return a new draftId
            // It's a fallback to use the existing draftId and still update the lastSaved timestamp
            const updatedDraft = {
                ...draftData,
                draftId: draftIdFromResponse || draftData.draftId,
                lastSaved: new Date().toISOString()
            };
            
            console.log('Updated draft with server response:', updatedDraft);
            
            // Save to localStorage immediately to ensure draftId persistence
            saveToLocalStorage(updatedDraft);
            
            // Update state
            setDraft(updatedDraft);
            setLastSynced(new Date());
            
            return updatedDraft;
        } catch (error) {
            console.error('Sync failed:', error);
            toast.error("Failed to sync with server. Will retry automatically.");
            
            // Simple retry logic (up to 2 retries with exponential backoff)
            for (let i = 0; i < 2; i++) {
                await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, i)));
                
                try {
                    const retryMethod = draftData.draftId ? 'PUT' : 'POST';
                    const retryEndpoint = draftData.draftId 
                        ? `${SURVEY_URL}/api/v1/drafts/${draftData.draftId}`
                        : `${SURVEY_URL}/api/v1/drafts`;
                        
                    const retryResponse = await fetch(retryEndpoint, {
                        method: retryMethod,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            survey_id: draftData.surveyId || 0, // 0 = new survey, >0 = updating existing
                            draft_content: transformedContent,
                            last_edited_question: draftData.lastEditedQuestion ? parseInt(draftData.lastEditedQuestion) : 0
                        })
                    });

                    if (retryResponse.ok) {
                        const retryResult: ServerResponse = await retryResponse.json();
                        console.log('Retry result:', retryResult);
                        
                        // Find draftId using the same robust approach as the main function
                        let retryDraftId = null;
                        
                        // Direct access to the expected structure
                        if (retryResult.data && typeof retryResult.data === 'object' && retryResult.data.draftId) {
                            retryDraftId = retryResult.data.draftId;
                            console.log('Found retry draftId in result.data:', retryDraftId);
                        } 
                        // Fallback to top level
                        else if (retryResult.draftId) {
                            retryDraftId = retryResult.draftId;
                            console.log('Found retry draftId at top level:', retryDraftId);
                        }
                        // Deep search as last resort
                        else {
                            retryDraftId = findDraftIdInResponse(retryResult);
                        }
                        
                        if (!retryDraftId && retryMethod === 'POST') {
                            console.error('Server did not return draftId for retry POST request');
                            continue; // Try next retry
                        }
                        
                        // Update draft with the returned draftId and immediately save to localStorage
                        const updatedDraft = {
                            ...draftData,
                            draftId: retryDraftId || draftData.draftId,
                            lastSaved: new Date().toISOString()
                        };
                        
                        // Save to localStorage immediately to ensure draftId persistence
                        saveToLocalStorage(updatedDraft);
                        
                        // Update state
                        setDraft(updatedDraft);
                        setLastSynced(new Date());
                        
                        toast.success("Sync succeeded after retry");
                        return updatedDraft;
                    }
                } catch (retryError) {
                    console.error(`Retry ${i + 1} failed:`, retryError);
                }
            }
            
            toast.error("Sync failed after retries. Changes saved locally only.");
            throw error;
        }
    };

    // Function to process any pending drafts
    const processPendingDraft = useCallback(async () => {
        if (pendingDraftRef.current && !isSyncingRef.current) {
            isSyncingRef.current = true;
            try {
                // Ensure we use the latest draftId from state or localStorage
                const latestDraft = {
                    ...pendingDraftRef.current,
                    draftId: pendingDraftRef.current.draftId || draft.draftId
                };
                
                await syncWithBackend(latestDraft);
                pendingDraftRef.current = null;
            } finally {
                isSyncingRef.current = false;
                // Check if another draft was queued while we were syncing
                if (pendingDraftRef.current) {
                    processPendingDraft();
                }
            }
        }
    }, [draft.draftId]);

    // Create a stable debounced function that will queue drafts for syncing
    const queueDraftForSync = useRef(
        debounce((draftData: SurveyDraft) => {
            // Use requestAnimationFrame to schedule intensive work during idle time
            requestAnimationFrame(() => {
                // Make a deep copy to ensure we use the latest data
                pendingDraftRef.current = { ...draftData };
                processPendingDraft();
            });
        }, 5000)
    ).current;
    
    // Clean up debounced function on unmount
    useEffect(() => {
        return () => {
            // The perfect-debounce library doesn't expose a cancel method directly on the type
            // but it does exist at runtime, so we need to use this approach
            const debouncedFn = queueDraftForSync as { cancel?: () => void };
            if (debouncedFn && typeof debouncedFn.cancel === 'function') {
                debouncedFn.cancel();
            }
        };
    }, [queueDraftForSync]);

    // Create a backup of the draft periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (draft.draftId) {
                saveToLocalStorage(draft, BACKUP_KEY);
            }
        }, 5 * 60 * 1000); // Every 5 minutes
        
        return () => clearInterval(interval);
    }, [draft]);

    // Load published survey for editing (if ?editSurveyId= is present)
    useEffect(() => {
        if (!editSurveyId) return;

        const loadSurveyForEditing = async () => {
            try {
                setIsLoading(true);
                const survey = await surveyApi.getSurvey(parseInt(editSurveyId));
                console.log("Loading published survey for editing:", survey);

                // Convert survey → draft format
                const draftQuestions: DraftQuestion[] = (survey.questions || []).map((q: any, idx: number) => ({
                    question_id: idx + 1,
                    question_text: q.question_text,
                    question_type: q.question_type,
                    mandatory: q.mandatory,
                    correct_answers: q.correct_answers || "",
                    points: q.points,
                    explanation: q.explanation,
                    requires_justification: q.requires_justification || false,
                    justification_required: q.justification_required || false,
                }));

                const draftOptions: DraftOption[] = (survey.questions || []).flatMap((q: any, qIdx: number) =>
                    (q.options || []).map((opt: any, optIdx: number) => ({
                        optionId: `${qIdx + 1}-opt-${optIdx}`,
                        question_id: qIdx + 1,
                        option_text: opt.option_text,
                    }))
                );

                const editDraft: SurveyDraft = {
                    surveyId: survey.id, // Critical: tells backend to UPDATE not CREATE
                    draftContent: {
                        basicInfo: {
                            title: survey.title,
                            description: survey.description,
                            is_self_recruitment: survey.is_self_recruitment,
                            conductor_id: survey.conductor_id,
                            status: survey.status,
                            question_display_mode: survey.question_display_mode || 'one_by_one',
                            is_quiz: survey.is_quiz,
                            time_limit_minutes: survey.time_limit_minutes,
                            passing_score_percentage: survey.passing_score_percentage,
                            show_correct_answers: survey.show_correct_answers,
                            shuffle_questions: survey.shuffle_questions,
                            shuffle_options: survey.shuffle_options,
                            max_attempts: survey.max_attempts,
                            requires_manual_evaluation: survey.requires_manual_evaluation,
                            allow_anonymous: survey.allow_anonymous,
                            participant_fields: survey.participant_fields || [],
                        },
                        questions: draftQuestions,
                        options: draftOptions,
                    },
                    lastSaved: new Date().toISOString(),
                };

                setDraft(editDraft);

                // Also set UI questions state
                const uiQuestions: Question[] = (survey.questions || []).map((q: any, idx: number) => ({
                    id: (idx + 1).toString(),
                    text: q.question_text,
                    type: q.question_type as Question['type'],
                    mandatory: q.mandatory || false,
                    correctAnswers: q.correct_answers || "",
                    points: q.points,
                    explanation: q.explanation,
                    requiresJustification: q.requires_justification || false,
                    justificationRequired: q.justification_required || false,
                    options: (q.options || []).map((opt: any, optIdx: number) => ({
                        id: `${idx + 1}-opt-${optIdx}`,
                        text: opt.option_text,
                    })),
                    mediaFiles: (q.media_files || []).map((m: any) => ({
                        id: m.id.toString(),
                        url: m.file_url,
                        type: m.file_type,
                        status: 'READY' as const,
                    })),
                }));
                setQuestions(uiQuestions);

                toast.success(`Loaded "${survey.title}" for editing`);
            } catch (error: any) {
                console.error("Failed to load survey for editing:", error);
                toast.error("Failed to load survey. Make sure you own it.");
                router.push("/dashboard");
            } finally {
                setIsLoading(false);
            }
        };

        // Clear localStorage draft to avoid confusion
        localStorage.removeItem(STORAGE_KEY);
        loadSurveyForEditing();
    }, [editSurveyId]);

    // Resume an existing server-side draft (?draftId=). Hydrates the editor from the survey_drafts row
    // so "Continue Draft" from the dashboard works, and subsequent autosaves update the SAME draft.
    useEffect(() => {
        if (!draftIdParam || editSurveyId) return;

        const loadDraftForEditing = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`${SURVEY_URL}/api/v1/drafts/${draftIdParam}`, { credentials: 'include' });
                if (!res.ok) throw new Error(`Failed to load draft: ${res.status}`);
                const json = await res.json();
                const data = json.data || json;
                const content = data.draft_content || {};
                const basicInfo = content.basicInfo || {};
                const rawQuestions: ParsedDraftQuestion[] = content.questions || [];
                const rawOptions: Array<{ option_text: string; question_id: number }> = content.options || [];
                const rawMedia: Array<{ question_id: number; file_url: string; file_type: string }> = content.mediaFiles || [];

                // Draft-format questions (with their media)
                const draftQuestions: DraftQuestion[] = rawQuestions.map((q) => ({
                    question_id: q.question_id as number,
                    question_text: q.question_text || "",
                    question_type: q.question_type || "multiple-choice",
                    mandatory: q.mandatory || false,
                    correct_answers: q.correct_answers || "",
                    points: q.points,
                    explanation: q.explanation,
                    requires_justification: q.requires_justification || false,
                    justification_required: q.justification_required || false,
                    mediaFiles: rawMedia.filter((m) => m.question_id === q.question_id).map((m) => ({
                        mediaId: 0, fileUrl: m.file_url, fileType: m.file_type, status: 'READY' as const,
                    })),
                }));

                // Draft-format options (synthesize a stable optionId per question)
                const draftOptions: DraftOption[] = [];
                rawQuestions.forEach((q) => {
                    rawOptions.filter((o) => o.question_id === q.question_id).forEach((o, idx) => {
                        draftOptions.push({ optionId: `${q.question_id}-opt-${idx}`, question_id: q.question_id as number, option_text: o.option_text });
                    });
                });

                const loadedDraft: SurveyDraft = {
                    draftId: data.id,
                    surveyId: data.survey_id || undefined,
                    draftContent: {
                        basicInfo: {
                            title: basicInfo.title || "",
                            description: basicInfo.description || "",
                            is_self_recruitment: basicInfo.is_self_recruitment || false,
                            conductor_id: basicInfo.conductor_id || 0,
                            status: basicInfo.status || "DRAFT",
                            question_display_mode: basicInfo.question_display_mode || 'one_by_one',
                            is_quiz: basicInfo.is_quiz || false,
                            time_limit_minutes: basicInfo.time_limit_minutes,
                            passing_score_percentage: basicInfo.passing_score_percentage,
                            show_correct_answers: basicInfo.show_correct_answers,
                            shuffle_questions: basicInfo.shuffle_questions,
                            shuffle_options: basicInfo.shuffle_options,
                            max_attempts: basicInfo.max_attempts,
                            requires_manual_evaluation: basicInfo.requires_manual_evaluation,
                            allow_anonymous: basicInfo.allow_anonymous,
                            participant_fields: basicInfo.participant_fields || [],
                        },
                        questions: draftQuestions,
                        options: draftOptions,
                    },
                    lastSaved: data.last_saved || new Date().toISOString(),
                };
                setDraft(loadedDraft);

                // UI questions state
                const uiQuestions: Question[] = rawQuestions.map((q) => ({
                    id: (q.question_id ?? 1).toString(),
                    text: q.question_text || "",
                    type: (q.question_type || "multiple-choice") as Question['type'],
                    mandatory: q.mandatory || false,
                    correctAnswers: q.correct_answers || "",
                    points: q.points,
                    explanation: q.explanation,
                    requiresJustification: q.requires_justification || false,
                    justificationRequired: q.justification_required || false,
                    options: rawOptions.filter((o) => o.question_id === q.question_id).map((o, idx) => ({
                        id: `${q.question_id}-opt-${idx}`, text: o.option_text,
                    })),
                    mediaFiles: rawMedia.filter((m) => m.question_id === q.question_id).map((m, idx) => ({
                        id: `${q.question_id}-media-${idx}`, url: m.file_url, type: m.file_type, status: 'READY' as const,
                    })),
                }));
                setQuestions(uiQuestions);

                toast.success("Loaded draft for editing");
            } catch (e) {
                console.error("Failed to load draft:", e);
                toast.error("Failed to load draft. It may have been deleted.");
                router.push("/dashboard");
            } finally {
                setIsLoading(false);
            }
        };

        // Avoid a stale localStorage copy clobbering the server draft
        localStorage.removeItem(STORAGE_KEY);
        loadDraftForEditing();
    }, [draftIdParam, editSurveyId]);

    // Load draft from localStorage on mount (skip if editing a published survey, resuming a server draft, or creating new)
    useEffect(() => {
        if (editSurveyId || draftIdParam) return; // Skip — survey/draft loaded from API above

        // Clear old draft when creating a brand new survey
        if (isNewSurvey) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(BACKUP_KEY);
            console.log("New survey — cleared old draft from localStorage");
            return;
        }

        try {
            // Try to load from localStorage
            const savedDraft = localStorage.getItem(STORAGE_KEY);
            if (savedDraft) {
                const parsed = JSON.parse(savedDraft);
                console.log("Loaded draft from localStorage:", parsed);
                if (parsed.draftId) {
                    console.log("Draft ID from localStorage:", parsed.draftId);
                }
                
                // If the old format doesn't have options array, create it
                if (!parsed.draftContent.options) {
                    parsed.draftContent.options = [];
                    
                    // Move options from questions to the separate array
                    parsed.draftContent.questions.forEach((q: ParsedDraftQuestion) => {
                        if (q.options) {
                            // Handle both old format (tempId) and new format (question_id)
                            const questionId = q.question_id || parseInt(q.tempId || "0");
                            q.options.forEach((optText: string, idx: number) => {
                                parsed.draftContent.options.push({
                                    optionId: `${questionId}-opt-${idx}`,
                                    question_id: questionId,
                                    option_text: optText
                                });
                            });
                            // Remove options from question object
                            delete q.options;
                        }
                        
                        // Convert any tempId to question_id if needed
                        if (q.tempId && !q.question_id) {
                            q.question_id = parseInt(q.tempId) || q.question_id;
                            delete q.tempId;
                        }
                    });
                }
                
                // Convert any remaining tempId to question_id in questions array
                if (parsed.draftContent.questions.length > 0) {
                    parsed.draftContent.questions = parsed.draftContent.questions.map((q: ParsedDraftQuestion, index: number) => {
                        if (q.tempId && !q.question_id) {
                            return {
                                ...q,
                                question_id: parseInt(q.tempId) || index + 1,
                                tempId: undefined
                            };
                        }
                        return q;
                    });
                }
                
                // Convert any questionTempId to question_id in options array
                if (parsed.draftContent.options.length > 0) {
                    parsed.draftContent.options = parsed.draftContent.options.map((opt: ParsedDraftOption) => {
                        if (opt.questionTempId && !opt.question_id) {
                            return {
                                ...opt,
                                question_id: parseInt(opt.questionTempId) || 0,
                                questionTempId: undefined
                            };
                        }
                        return opt;
                    });
                }
                
                setDraft(parsed);
                
                // Also sync questions state
                if (parsed.draftContent.questions.length > 0) {
                    // Transform draft questions to Question interface
                    const loadedQuestions = parsed.draftContent.questions.map((q: ParsedDraftQuestion) => {
                        // Find options for this question
                        const questionOptions = parsed.draftContent.options
                            .filter((opt: ParsedDraftOption) => opt.question_id === q.question_id)
                            .map((opt: ParsedDraftOption, idx: number) => ({
                                id: opt.optionId || `${q.question_id}-opt-${idx}`,
                                text: opt.option_text
                            }));

                        return {
                            id: (q.question_id || 1).toString(),
                            text: q.question_text,
                            type: q.question_type as Question['type'],
                            mandatory: q.mandatory || false,
                            correctAnswers: q.correct_answers || "",
                            points: q.points,
                            explanation: q.explanation,
                            requiresJustification: q.requires_justification || false,
                            justificationRequired: q.justification_required || false,
                            options: questionOptions,
                            mediaFiles: q.mediaFiles?.map((m) => ({
                                id: m.mediaId.toString(),
                                url: m.fileUrl,
                                type: m.fileType,
                                status: m.status
                            }))
                        };
                    });
                    setQuestions(loadedQuestions);
                }
            }
        } catch (error) {
            console.error('Error loading draft:', error);
            toast.error("Failed to load saved draft");
            
            // Try to recover by checking if there's a backup
            const backupDraft = localStorage.getItem(BACKUP_KEY);
            if (backupDraft) {
                try {
                    setDraft(JSON.parse(backupDraft));
                    toast.success("Recovered from backup draft");
                } catch {
                    // If backup also fails, just continue with new draft
                }
            }
        }
    }, []);

    // Authorization and conductor data loading
    useEffect(() => {
        const loadConductorInfo = async () => {
            if (!loading && isAuthenticated && user) {
                // Check if user has Conducting role
                if (!user.roles?.includes("Conducting")) {
                    toast.error("Access denied. Conducting role required.");
                    router.push("/role-selection");
                    return;
                }

                try {
                    // Get current conductor information (uses auth service via proxy)
                    const response = await fetch(`${AUTH_URL}/api/Conductor/current`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                    });

                    if (response.ok) {
                        const conductorData = await response.json();
                        setConductorInfo({ conductorId: conductorData.conductorId });
                        
                        // Update draft with correct conductor_id
                        setDraft(prevDraft => ({
                            ...prevDraft,
                            draftContent: {
                                ...prevDraft.draftContent,
                                basicInfo: {
                                    ...prevDraft.draftContent.basicInfo,
                                    conductor_id: conductorData.conductorId
                                }
                            }
                        }));
                    } else {
                        toast.error("Failed to load conductor information");
                        router.push("/role-selection");
                    }
                } catch (error) {
                    console.error("Error loading conductor info:", error);
                    toast.error("Failed to load conductor information");
                    router.push("/role-selection");
                }
            }
        };

        loadConductorInfo();
    }, [user, isAuthenticated, loading, router]);

    // Debug whenever draft state changes
    useEffect(() => {
        console.log('Draft state updated:', { 
            draftId: draft.draftId, 
            questionsCount: draft.draftContent.questions.length,
            hasTitle: !!draft.draftContent.basicInfo.title
        });
    }, [draft]);

    // Don't render if not authorized or still loading conductor info
    if (loading || !isAuthenticated || !user?.roles?.includes("Conducting") || !conductorInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg">Loading...</p>
                    {!loading && !isAuthenticated && (
                        <p className="text-sm text-gray-500 mt-2">Please log in to continue</p>
                    )}
                    {!loading && isAuthenticated && !user?.roles?.includes("Conducting") && (
                        <p className="text-sm text-red-500 mt-2">Conducting role required</p>
                    )}
                </div>
            </div>
        );
    }

    // Save to localStorage and trigger backend sync
    const saveDraft = (updatedDraft: SurveyDraft) => {
        try {
            // Save to localStorage
            saveToLocalStorage(updatedDraft);
            
            // Queue the draft for syncing - this will be debounced
            queueDraftForSync(updatedDraft);
        } catch (error) {
            console.error('Error in saveDraft:', error);
            toast.error("Failed to save draft");
        }
    };

    // Update draft content with throttling for rapid changes
    const updateDraft = (updates: Partial<SurveyDraft['draftContent']>, lastEditedQuestionId?: string) => {
        // Batch state updates using a function update to avoid stale state issues
        setDraft(prevDraft => {
            const updatedDraft = {
                ...prevDraft,
                draftContent: {
                    ...prevDraft.draftContent,
                    ...updates
                },
                lastEditedQuestion: lastEditedQuestionId || prevDraft.lastEditedQuestion,
                lastSaved: new Date().toISOString()
            };
            
            // Save to localStorage and trigger debounced backend sync in the next frame
            requestAnimationFrame(() => {
                saveDraft(updatedDraft);
            });
            
            return updatedDraft;
        });
    };

    // Handle media upload
    const handleMediaUpload = async (file: File, questionId: string) => {
        const questionIdNum = parseInt(questionId);
        const tempMediaId = Date.now().toString();
        const blobUrl = URL.createObjectURL(file);
        const detectedType = file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';
        
        // Update UI state with uploading status
        setQuestions(prev =>
            prev.map((q) =>
                q.id === questionId
                    ? {
                          ...q,
                          mediaFiles: [
                              ...(q.mediaFiles || []),
                              { id: tempMediaId, url: blobUrl, type: detectedType, status: 'UPLOADING' }
                          ]
                      }
                    : q
            )
        );
        
        // Update draft state with uploading status (use functional updater to avoid stale closure)
        setDraft(prevDraft => {
            const updated = {
                ...prevDraft,
                draftContent: {
                    ...prevDraft.draftContent,
                    questions: prevDraft.draftContent.questions.map(q =>
                        q.question_id === questionIdNum ? {
                            ...q,
                            mediaFiles: [
                                ...(q.mediaFiles || []),
                                { mediaId: parseInt(tempMediaId), fileUrl: blobUrl, fileType: detectedType, status: 'UPLOADING' as const }
                            ]
                        } : q
                    )
                },
                lastSaved: new Date().toISOString()
            };
            return updated;
        });

        const formData = new FormData();
        formData.append('file', file);
        if (draft.draftId) {
            formData.append('draftId', draft.draftId.toString());
        }

        try {
            const response = await fetch(`${SURVEY_URL}/api/v1/media/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const { mediaId, fileUrl, fileType } = await response.json();
            
            // Update UI state with success (functional updater for latest state)
            setQuestions(prev =>
                prev.map((q) =>
                    q.id === questionId
                        ? {
                              ...q,
                              mediaFiles: (q.mediaFiles || []).map(m => 
                                  m.id === tempMediaId 
                                      ? { ...m, id: mediaId.toString(), url: fileUrl, type: fileType, status: 'READY' }
                                      : m
                              )
                          }
                        : q
                )
            );

            // Update draft state with success (functional updater for latest state)
            setDraft(prevDraft => {
                const updated = {
                    ...prevDraft,
                    draftContent: {
                        ...prevDraft.draftContent,
                        questions: prevDraft.draftContent.questions.map(q =>
                            q.question_id === questionIdNum ? {
                                ...q,
                                mediaFiles: (q.mediaFiles || []).map(m => 
                                    m.mediaId === parseInt(tempMediaId)
                                        ? { mediaId, fileUrl, fileType, status: 'READY' as const }
                                        : m
                                )
                            } : q
                        )
                    },
                    lastEditedQuestion: questionId,
                    lastSaved: new Date().toISOString()
                };
                requestAnimationFrame(() => { saveDraft(updated); });
                return updated;
            });
            toast.success('Media uploaded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            
            // Update UI state with error
            setQuestions(prev =>
                prev.map((q) =>
                    q.id === questionId
                        ? {
                              ...q,
                              mediaFiles: (q.mediaFiles || []).map(m => 
                                  m.id === tempMediaId 
                                      ? { ...m, status: 'ERROR' }
                                      : m
                              )
                          }
                        : q
                )
            );
            
            // Update draft state with error (functional updater)
            setDraft(prevDraft => {
                const updated = {
                    ...prevDraft,
                    draftContent: {
                        ...prevDraft.draftContent,
                        questions: prevDraft.draftContent.questions.map(q =>
                            q.question_id === questionIdNum ? {
                                ...q,
                                mediaFiles: (q.mediaFiles || []).map(m => 
                                    m.mediaId === parseInt(tempMediaId)
                                        ? { ...m, status: 'ERROR' as const }
                                        : m
                                )
                            } : q
                        )
                    },
                    lastSaved: new Date().toISOString()
                };
                requestAnimationFrame(() => { saveDraft(updated); });
                return updated;
            });
            toast.error('Failed to upload media');
        }
    };
    
    // Handle file input change
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, questionId: string) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleMediaUpload(files[0], questionId);
            // Reset the input
            e.target.value = '';
        }
    };
    
    // Remove media from question
    const removeMedia = (questionId: string, mediaId: string) => {
        // Update UI state
        setQuestions(
            questions.map((q) =>
                q.id === questionId
                    ? {
                          ...q,
                          mediaFiles: (q.mediaFiles || []).filter(m => m.id !== mediaId)
                      }
                    : q
            )
        );
        
        // Update draft state
        const updatedQuestions = draft.draftContent.questions.map(q =>
            q.question_id === parseInt(questionId) ? {
                ...q,
                mediaFiles: (q.mediaFiles || []).filter(m => m.mediaId.toString() !== mediaId)
            } : q
        );
        
        updateDraft({ questions: updatedQuestions });
    };

    // Publish survey
    const handlePublish = async () => {
        setIsSubmitting(true);
        try {
            // Use ref to get the absolute latest draft state (avoids stale closures)
            const latestDraft = draftRef.current;
            
            console.log("Starting publish process. Current draft:", {
                draftId: latestDraft.draftId,
                hasTitle: !!latestDraft.draftContent.basicInfo.title,
                questionsCount: latestDraft.draftContent.questions.length,
                mediaFilesCount: latestDraft.draftContent.questions.reduce((sum, q) => sum + (q.mediaFiles?.length || 0), 0)
            });
            
            // Double-check if draftId is available in localStorage even if not in state
            if (!latestDraft.draftId) {
                console.log("No draft ID in current state, checking localStorage");
                try {
                    const savedDraft = localStorage.getItem(STORAGE_KEY);
                    if (savedDraft) {
                        const parsed = JSON.parse(savedDraft);
                        if (parsed.draftId) {
                            console.log("Found draftId in localStorage that's not in state:", parsed.draftId);
                            const draftId = parsed.draftId;
                            const draftWithId = { ...latestDraft, draftId };
                            setDraft(draftWithId);
                            
                            // Re-sync latest content before publishing
                            const reSyncedDraft = await syncWithBackend(draftWithId);
                            if (reSyncedDraft && reSyncedDraft.draftId) {
                                setDraft(reSyncedDraft);
                            }
                            
                            const publishUrl = `${SURVEY_URL}/api/v1/drafts/${draftId}/publish`;
                            console.log(`Publishing draft to: ${publishUrl}`);
                            
                            const response = await fetch(publishUrl, {
                                method: 'POST',
                                headers: { 
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json'
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                    normalizeQuestionIds: true // Add flag to tell backend to normalize question IDs
                                })
                            });
                            
                            if (!response.ok) {
                                const errorText = await response.text();
                                console.error('Publishing error response:', errorText);
                                throw new Error(`Failed to publish survey: ${response.status} ${errorText}`);
                            }
                            
                            const result = await response.json();
                            console.log('Publish response:', result);
                            
                            // Check if surveyId is in the data object
                            const surveyId = result.data?.surveyId;
                            if (!surveyId) {
                                console.warn('No surveyId returned in publish response');
                            }
                            
                            localStorage.removeItem(STORAGE_KEY);
                            localStorage.removeItem(BACKUP_KEY);
                            toast.success("Survey published successfully!");
                            router.push('/dashboard');
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Error checking localStorage for draftId:", e);
                }
                
                // If we got here, we didn't find a draftId in localStorage
                toast.info("Saving draft before publishing...");
                
                // Check if we have a valid draft to save
                if (!latestDraft.draftContent.basicInfo.title && latestDraft.draftContent.questions.length === 0) {
                    toast.warning("Please add a title or questions before publishing");
                    setIsSubmitting(false);
                    return;
                }
                
                // Save the draft first
                const savedDraft = await syncWithBackend(latestDraft);
                if (!savedDraft || !savedDraft.draftId) {
                    toast.error("Failed to save draft before publishing");
                    setIsSubmitting(false);
                    return;
                }
                
                // Update the draft state with the saved draft
                setDraft(savedDraft);
                toast.success("Draft saved successfully");
                console.log("Draft saved. New draftId:", savedDraft.draftId);
            } else {
                console.log("Using existing draftId:", latestDraft.draftId);
                // Always re-sync the latest draft content before publishing
                const reSyncedDraft = await syncWithBackend(draftRef.current);
                if (reSyncedDraft && reSyncedDraft.draftId) {
                    setDraft(reSyncedDraft);
                    console.log("Draft re-synced before publish. draftId:", reSyncedDraft.draftId);
                }
            }

            // Use ref again for the most up-to-date draftId
            const finalDraft = draftRef.current;
            if (!finalDraft.draftId) {
                console.error("Still no draftId after save attempt");
                toast.error("Could not obtain a draft ID. Please try saving manually first.");
                setIsSubmitting(false);
                return;
            }

            // Now publish the saved draft
            const publishUrl = `${SURVEY_URL}/api/v1/drafts/${finalDraft.draftId}/publish`;
            console.log(`Publishing draft to: ${publishUrl}`);
            
            const response = await fetch(publishUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    normalizeQuestionIds: true // Add flag to tell backend to normalize question IDs
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Publishing error response:', errorText);
                throw new Error(`Failed to publish survey: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            console.log('Publish response:', result);
            
            // Check if surveyId is in the data object
            const surveyId = result.data?.surveyId;
            if (!surveyId) {
                console.warn('No surveyId returned in publish response');
            }
            
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(BACKUP_KEY);
            toast.success("Survey published successfully!");
            router.push('/dashboard');
        } catch (error: unknown) {
            console.error('Publishing failed:', error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Failed to publish survey: ${errorMessage}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const addQuestion = () => {
        // Get the next sequential question ID
        const nextQuestionId = draft.draftContent.questions.length > 0
            ? Math.max(...draft.draftContent.questions.map(q => q.question_id).filter(id => id !== undefined)) + 1
            : 1;

        const optionId = `${nextQuestionId}-opt-0`;

        // Create question for UI state
        const newQuestion: Question = {
            id: nextQuestionId.toString(),
            text: "",
            type: "multiple-choice",
            options: [{ id: optionId, text: "" }],
            mediaFiles: [],
            mandatory: false,
            correctAnswers: "",
            points: draft.draftContent.basicInfo.is_quiz ? 1 : undefined,
            explanation: draft.draftContent.basicInfo.is_quiz ? "" : undefined,
            requiresJustification: false,
            justificationRequired: false
        };

        // Update UI state
        setQuestions([...questions, newQuestion]);

        // Also update draft state for localStorage
        const newDraftQuestion = {
            question_id: nextQuestionId,
            question_text: "",
            question_type: "multiple-choice",
            mandatory: false,
            correct_answers: "",
            points: draft.draftContent.basicInfo.is_quiz ? 1 : undefined,
            explanation: draft.draftContent.basicInfo.is_quiz ? "" : undefined,
            requires_justification: false,
            justification_required: false,
            mediaFiles: []
        };
        
        // Add a default option to the options array
        const newOption = {
            optionId: optionId,
            question_id: nextQuestionId,
            option_text: ""
        };
        
        // Update draft content
        updateDraft({
            questions: [...draft.draftContent.questions, newDraftQuestion],
            options: [...draft.draftContent.options, newOption]
        });
    };

    const deleteQuestion = (questionId: string) => {
        // Parse question ID to number
        const questionIdNum = parseInt(questionId);
        
        // Update UI state
        setQuestions(questions.filter((q) => q.id !== questionId));
        
        // Also update draft state for localStorage
        updateDraft({
            questions: draft.draftContent.questions.filter(q => q.question_id !== questionIdNum),
            options: draft.draftContent.options.filter(opt => opt.question_id !== questionIdNum)
        });
    };

    const addOption = (questionId: string) => {
        // Parse question ID to number
        const questionIdNum = parseInt(questionId);
        
        // Count existing options for this question to generate a unique option ID
        const optionCount = draft.draftContent.options.filter(
            opt => opt.question_id === questionIdNum
        ).length;
        
        const optionId = `${questionIdNum}-opt-${optionCount}`;
        
        // Update UI state
        setQuestions(
            questions.map((q) =>
                q.id === questionId
                    ? {
                          ...q,
                          options: [...q.options, { id: optionId, text: "" }],
                      }
                    : q,
            ),
        );
        
        // Also update draft state for localStorage
        const newOption = {
            optionId: optionId,
            question_id: questionIdNum,
            option_text: ""
        };
        
        updateDraft({
            options: [...draft.draftContent.options, newOption]
        });
    };

    const deleteOption = (questionId: string, optionId: string) => {
        // Parse question ID to number
        const questionIdNum = parseInt(questionId);
        
        // Update UI state
        setQuestions(
            questions.map((q) =>
                q.id === questionId
                    ? {
                          ...q,
                          options: q.options.filter((opt) => opt.id !== optionId),
                      }
                    : q,
            ),
        );
        
        // Also update draft state for localStorage
        updateDraft({
            options: draft.draftContent.options.filter(opt => 
                !(opt.question_id === questionIdNum && opt.optionId === optionId)
            )
        });
    };

    // Manual save handler (skips debounce)
    const handleManualSave = async () => {
        try {
            // Cancel any pending debounced saves
            const debouncedFn = queueDraftForSync as { cancel?: () => void };
            if (debouncedFn && typeof debouncedFn.cancel === 'function') {
                debouncedFn.cancel();
            }
            
            // Clear any pending draft
            pendingDraftRef.current = null;
            
            // Wait for any in-progress sync to complete
            if (isSyncingRef.current) {
                toast.info("Waiting for in-progress sync to complete...");
                // Use a more efficient waiting approach
                await new Promise<void>((resolve) => {
                    // Check sync status every 100ms instead of blocking for long periods
                    const checkSync = () => {
                        if (!isSyncingRef.current) {
                            resolve();
                        } else {
                            setTimeout(checkSync, 100);
                        }
                    };
                    
                    // First check after 500ms
                    setTimeout(checkSync, 500);
                });
            }
            
            setIsLoading(true);
            
            // Check if we have a valid draft to save
            if (!draft.draftContent.basicInfo.title && draft.draftContent.questions.length === 0) {
                toast.warning("Please add a title or questions before saving");
                setIsLoading(false);
                return;
            }
            
            console.log("Manual save - draft before sync:", {
                draftId: draft.draftId,
                title: draft.draftContent.basicInfo.title,
                questionsCount: draft.draftContent.questions.length
            });
            
            try {
                const savedDraft = await syncWithBackend(draft);
                console.log("Manual save - draft after sync:", {
                    draftId: savedDraft?.draftId,
                    wasSuccessful: !!savedDraft
                });
                
                if (savedDraft) {
                    // Explicitly update the state with the saved draft
                    setDraft(savedDraft);
                    
                    // Also save directly to localStorage for redundancy
                    console.log("Saving draft to localStorage with ID:", savedDraft.draftId);
                    saveToLocalStorage(savedDraft);
                    
                    console.log("Draft state explicitly updated with ID:", savedDraft.draftId);
                    toast.success("Draft saved successfully");
                    
                    // Verify the state update
                    setTimeout(() => {
                        console.log("Verifying draft state after update, current draftId:", draft.draftId);
                    }, 100);
                }
            } catch (error) {
                console.error("Inner manual save error:", error);
                throw error;
            } finally {
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Manual save failed:", error);
            toast.error("Failed to save draft");
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Create Survey</h1>
                <div className="flex items-center gap-2">
                    {lastSynced && (
                        <span className="text-sm text-muted-foreground">
                            Last synced: {lastSynced.toLocaleTimeString()}
                        </span>
                    )}
                    <Button
                        variant="outline"
                        onClick={handleManualSave}
                        className="flex items-center gap-2"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Save Draft
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <Progress
                value={
                    currentSection === 'basic' ? 33 :
                    currentSection === 'questions' ? 66 : 100
                }
                className="w-full"
            />

            <Card className="w-full">
                {currentSection === 'basic' && (
                    <>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                placeholder="Survey Title"
                                value={draft.draftContent.basicInfo.title}
                                onChange={(e) => updateDraft({
                                    basicInfo: { ...draft.draftContent.basicInfo, title: e.target.value }
                                })}
                            />
                            <Textarea
                                placeholder="Survey Description"
                                value={draft.draftContent.basicInfo.description}
                                onChange={(e) => updateDraft({
                                    basicInfo: { ...draft.draftContent.basicInfo, description: e.target.value }
                                })}
                            />

                            {/* Question Display Mode — applies to all surveys */}
                            <div className="border-t pt-4 space-y-2">
                                <label className="text-sm font-medium">How should questions be shown to participants?</label>
                                <p className="text-xs text-gray-500">Use the Preview button to see your choice live.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                    {([
                                        { mode: 'one_by_one' as const, title: 'One at a time', desc: 'Participants see a single question per screen with Next/Previous.', bars: 1 },
                                        { mode: 'all_at_once' as const, title: 'All on one page', desc: 'All questions on one scrollable page with a single Submit (Google Form style).', bars: 3 },
                                    ]).map(({ mode, title, desc, bars }) => {
                                        const selected = (draft.draftContent.basicInfo.question_display_mode || 'one_by_one') === mode;
                                        return (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => updateDraft({
                                                    basicInfo: { ...draft.draftContent.basicInfo, question_display_mode: mode }
                                                })}
                                                className={`text-left p-3 rounded-lg border-2 transition-all ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}
                                            >
                                                {/* mini mockup */}
                                                <div className="flex flex-col gap-1 mb-2 bg-white rounded border border-gray-200 p-2 h-16 justify-center">
                                                    {Array.from({ length: bars }).map((_, i) => (
                                                        <div key={i} className="space-y-1">
                                                            <div className="h-1.5 w-3/4 rounded bg-gray-300" />
                                                            <div className="h-1 w-1/2 rounded bg-gray-200" />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                                                        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{title}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">{desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Quiz Mode Toggle */}
                            <div className="border-t pt-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="quiz-mode"
                                        checked={draft.draftContent.basicInfo.is_quiz || false}
                                        onCheckedChange={(checked: CheckedState) => {
                                            const isQuiz = checked === true;
                                            updateDraft({
                                                basicInfo: {
                                                    ...draft.draftContent.basicInfo,
                                                    is_quiz: isQuiz,
                                                    // Set defaults when enabling quiz mode
                                                    show_correct_answers: isQuiz ? true : undefined,
                                                    shuffle_questions: isQuiz ? false : undefined,
                                                    shuffle_options: isQuiz ? false : undefined
                                                }
                                            });
                                        }}
                                    />
                                    <label htmlFor="quiz-mode" className="text-sm font-medium cursor-pointer">
                                        Create as Quiz
                                    </label>
                                </div>

                                {/* Quiz-specific fields */}
                                {draft.draftContent.basicInfo.is_quiz && (
                                    <div className="ml-6 space-y-3 border-l-2 border-primary pl-4">
                                        <div className="space-y-2">
                                            <label htmlFor="time-limit" className="text-sm font-medium">
                                                Time Limit (minutes) - Optional
                                            </label>
                                            <Input
                                                id="time-limit"
                                                type="number"
                                                min="1"
                                                placeholder="e.g., 30"
                                                value={draft.draftContent.basicInfo.time_limit_minutes || ''}
                                                onChange={(e) => updateDraft({
                                                    basicInfo: {
                                                        ...draft.draftContent.basicInfo,
                                                        time_limit_minutes: e.target.value ? parseInt(e.target.value) : undefined
                                                    }
                                                })}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="passing-score" className="text-sm font-medium">
                                                Passing Score (%) - Optional
                                            </label>
                                            <Input
                                                id="passing-score"
                                                type="number"
                                                min="0"
                                                max="100"
                                                placeholder="e.g., 70"
                                                value={draft.draftContent.basicInfo.passing_score_percentage || ''}
                                                onChange={(e) => updateDraft({
                                                    basicInfo: {
                                                        ...draft.draftContent.basicInfo,
                                                        passing_score_percentage: e.target.value ? parseInt(e.target.value) : undefined
                                                    }
                                                })}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="max-attempts" className="text-sm font-medium">
                                                Maximum Attempts - Optional
                                            </label>
                                            <Input
                                                id="max-attempts"
                                                type="number"
                                                min="1"
                                                placeholder="Leave empty for unlimited"
                                                value={draft.draftContent.basicInfo.max_attempts || ''}
                                                onChange={(e) => updateDraft({
                                                    basicInfo: {
                                                        ...draft.draftContent.basicInfo,
                                                        max_attempts: e.target.value ? parseInt(e.target.value) : undefined
                                                    }
                                                })}
                                            />
                                            <p className="text-xs text-gray-500">
                                                Limit how many times each participant can take this quiz
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="show-correct"
                                                checked={draft.draftContent.basicInfo.show_correct_answers !== false}
                                                onCheckedChange={(checked: CheckedState) => {
                                                    updateDraft({
                                                        basicInfo: {
                                                            ...draft.draftContent.basicInfo,
                                                            show_correct_answers: checked === true
                                                        }
                                                    });
                                                }}
                                            />
                                            <label htmlFor="show-correct" className="text-sm">
                                                Show correct answers after completion
                                            </label>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="shuffle-questions"
                                                checked={draft.draftContent.basicInfo.shuffle_questions || false}
                                                onCheckedChange={(checked: CheckedState) => {
                                                    updateDraft({
                                                        basicInfo: {
                                                            ...draft.draftContent.basicInfo,
                                                            shuffle_questions: checked === true
                                                        }
                                                    });
                                                }}
                                            />
                                            <label htmlFor="shuffle-questions" className="text-sm">
                                                Shuffle questions for each participant
                                            </label>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="shuffle-options"
                                                checked={draft.draftContent.basicInfo.shuffle_options || false}
                                                onCheckedChange={(checked: CheckedState) => {
                                                    updateDraft({
                                                        basicInfo: {
                                                            ...draft.draftContent.basicInfo,
                                                            shuffle_options: checked === true
                                                        }
                                                    });
                                                }}
                                            />
                                            <label htmlFor="shuffle-options" className="text-sm">
                                                Shuffle answer options for each question
                                            </label>
                                        </div>

                                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-200">
                                            <Checkbox
                                                id="manual-evaluation"
                                                checked={draft.draftContent.basicInfo.requires_manual_evaluation || false}
                                                onCheckedChange={(checked: CheckedState) => {
                                                    updateDraft({
                                                        basicInfo: {
                                                            ...draft.draftContent.basicInfo,
                                                            requires_manual_evaluation: checked === true
                                                        }
                                                    });
                                                }}
                                            />
                                            <div>
                                                <label htmlFor="manual-evaluation" className="text-sm font-medium cursor-pointer">
                                                    Enable Manual Evaluation
                                                </label>
                                                <p className="text-xs text-gray-500">
                                                    Review and grade each submission manually. Required if you have text, rating, image upload, or code questions.
                                                </p>
                                            </div>
                                        </div>
                                        {!draft.draftContent.basicInfo.requires_manual_evaluation &&
                                          questions.some(q => ["text", "rating", "image-upload", "code"].includes(q.type)) && (
                                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2 flex items-center gap-2">
                                                <span>⚠️</span>
                                                <span>You have questions that need manual grading (text, rating, image upload, or code). Consider enabling Manual Evaluation above so participants see "Pending Evaluation" instead of 0 points.</span>
                                            </div>
                                        )}

                                        {/* Excel Template Upload */}
                                        <div className="mt-4 pt-4 border-t border-blue-200">
                                            <QuizTemplateUploader
                                                existingQuestionCount={questions.length}
                                                onQuestionsLoaded={(parsedQuestions, draftQuestions, draftOptions) => {
                                                    // Add parsed questions to existing questions
                                                    setQuestions(prev => [...prev, ...parsedQuestions]);
                                                    
                                                    // Update draft with new questions and options
                                                    updateDraft({
                                                        questions: [...draft.draftContent.questions, ...draftQuestions],
                                                        options: [...draft.draftContent.options, ...draftOptions]
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Anonymous Participation Toggle */}
                            <div className="border-t pt-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="allow-anonymous"
                                        checked={draft.draftContent.basicInfo.allow_anonymous || false}
                                        onCheckedChange={(checked: CheckedState) => {
                                            updateDraft({
                                                basicInfo: {
                                                    ...draft.draftContent.basicInfo,
                                                    allow_anonymous: checked === true
                                                }
                                            });
                                        }}
                                    />
                                    <label htmlFor="allow-anonymous" className="text-sm font-medium cursor-pointer">
                                        Allow Anonymous Participation
                                    </label>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 ml-6">
                                    When enabled, participants can take the survey without registering an account.
                                </p>
                            </div>

                            {/* Custom Participant Fields */}
                            <div className="border-t pt-4 mt-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-medium">Collect Participant Information</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Add custom fields to collect additional info from participants before they start.
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Add Preset Fields */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const existingFields = draft.draftContent.basicInfo.participant_fields || [];
                                            if (!existingFields.find(f => f.id === 'name')) {
                                                updateDraft({
                                                    basicInfo: {
                                                        ...draft.draftContent.basicInfo,
                                                        participant_fields: [...existingFields, {
                                                            id: 'name',
                                                            label: 'Full Name',
                                                            type: 'text' as const,
                                                            required: true,
                                                            placeholder: 'Enter your full name'
                                                        }]
                                                    }
                                                });
                                            }
                                        }}
                                        disabled={(draft.draftContent.basicInfo.participant_fields || []).some(f => f.id === 'name')}
                                    >
                                        <User className="h-3 w-3 mr-1" />
                                        + Name
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const existingFields = draft.draftContent.basicInfo.participant_fields || [];
                                            if (!existingFields.find(f => f.id === 'email')) {
                                                updateDraft({
                                                    basicInfo: {
                                                        ...draft.draftContent.basicInfo,
                                                        participant_fields: [...existingFields, {
                                                            id: 'email',
                                                            label: 'Email Address',
                                                            type: 'email' as const,
                                                            required: true,
                                                            placeholder: 'Enter your email'
                                                        }]
                                                    }
                                                });
                                            }
                                        }}
                                        disabled={(draft.draftContent.basicInfo.participant_fields || []).some(f => f.id === 'email')}
                                    >
                                        <Mail className="h-3 w-3 mr-1" />
                                        + Email
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const existingFields = draft.draftContent.basicInfo.participant_fields || [];
                                            if (!existingFields.find(f => f.id === 'roll_no')) {
                                                updateDraft({
                                                    basicInfo: {
                                                        ...draft.draftContent.basicInfo,
                                                        participant_fields: [...existingFields, {
                                                            id: 'roll_no',
                                                            label: 'Roll Number',
                                                            type: 'text' as const,
                                                            required: false,
                                                            placeholder: 'Enter your roll number'
                                                        }]
                                                    }
                                                });
                                            }
                                        }}
                                        disabled={(draft.draftContent.basicInfo.participant_fields || []).some(f => f.id === 'roll_no')}
                                    >
                                        <Hash className="h-3 w-3 mr-1" />
                                        + Roll No
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const existingFields = draft.draftContent.basicInfo.participant_fields || [];
                                            if (!existingFields.find(f => f.id === 'phone')) {
                                                updateDraft({
                                                    basicInfo: {
                                                        ...draft.draftContent.basicInfo,
                                                        participant_fields: [...existingFields, {
                                                            id: 'phone',
                                                            label: 'Phone Number',
                                                            type: 'tel' as const,
                                                            required: false,
                                                            placeholder: 'Enter your phone number'
                                                        }]
                                                    }
                                                });
                                            }
                                        }}
                                        disabled={(draft.draftContent.basicInfo.participant_fields || []).some(f => f.id === 'phone')}
                                    >
                                        <Phone className="h-3 w-3 mr-1" />
                                        + Phone
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const existingFields = draft.draftContent.basicInfo.participant_fields || [];
                                            const newId = `custom_${Date.now()}`;
                                            updateDraft({
                                                basicInfo: {
                                                    ...draft.draftContent.basicInfo,
                                                    participant_fields: [...existingFields, {
                                                        id: newId,
                                                        label: 'Custom Field',
                                                        type: 'text' as const,
                                                        required: false,
                                                        placeholder: ''
                                                    }]
                                                }
                                            });
                                        }}
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Custom Field
                                    </Button>
                                </div>

                                {/* Display Added Fields */}
                                {(draft.draftContent.basicInfo.participant_fields || []).length > 0 && (
                                    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                                        {(draft.draftContent.basicInfo.participant_fields || []).map((field, index) => (
                                            <div key={field.id} className="flex items-center gap-2 bg-background p-2 rounded border">
                                                <div className="flex-1 grid grid-cols-4 gap-2">
                                                    <Input
                                                        placeholder="Field Label"
                                                        value={field.label}
                                                        onChange={(e) => {
                                                            const fields = [...(draft.draftContent.basicInfo.participant_fields || [])];
                                                            fields[index] = { ...fields[index], label: e.target.value };
                                                            updateDraft({
                                                                basicInfo: {
                                                                    ...draft.draftContent.basicInfo,
                                                                    participant_fields: fields
                                                                }
                                                            });
                                                        }}
                                                        className="text-sm"
                                                    />
                                                    <Select
                                                        value={field.type}
                                                        onValueChange={(value: 'text' | 'email' | 'number' | 'tel') => {
                                                            const fields = [...(draft.draftContent.basicInfo.participant_fields || [])];
                                                            fields[index] = { ...fields[index], type: value };
                                                            updateDraft({
                                                                basicInfo: {
                                                                    ...draft.draftContent.basicInfo,
                                                                    participant_fields: fields
                                                                }
                                                            });
                                                        }}
                                                    >
                                                        <SelectTrigger className="text-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="text">Text</SelectItem>
                                                            <SelectItem value="email">Email</SelectItem>
                                                            <SelectItem value="number">Number</SelectItem>
                                                            <SelectItem value="tel">Phone</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        placeholder="Placeholder text"
                                                        value={field.placeholder || ''}
                                                        onChange={(e) => {
                                                            const fields = [...(draft.draftContent.basicInfo.participant_fields || [])];
                                                            fields[index] = { ...fields[index], placeholder: e.target.value };
                                                            updateDraft({
                                                                basicInfo: {
                                                                    ...draft.draftContent.basicInfo,
                                                                    participant_fields: fields
                                                                }
                                                            });
                                                        }}
                                                        className="text-sm"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id={`required-${field.id}`}
                                                            checked={field.required}
                                                            onCheckedChange={(checked: CheckedState) => {
                                                                const fields = [...(draft.draftContent.basicInfo.participant_fields || [])];
                                                                fields[index] = { ...fields[index], required: checked === true };
                                                                updateDraft({
                                                                    basicInfo: {
                                                                        ...draft.draftContent.basicInfo,
                                                                        participant_fields: fields
                                                                    }
                                                                });
                                                            }}
                                                        />
                                                        <label htmlFor={`required-${field.id}`} className="text-xs">Required</label>
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => {
                                                        const fields = (draft.draftContent.basicInfo.participant_fields || []).filter(f => f.id !== field.id);
                                                        updateDraft({
                                                            basicInfo: {
                                                                ...draft.draftContent.basicInfo,
                                                                participant_fields: fields
                                                            }
                                                        });
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </>
                )}

                {currentSection === 'questions' && (
                    <>
                        <CardHeader>
                            <CardTitle>Questions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {questions.map((question) => (
                                <div
                                    key={question.id}
                                    className="border rounded-lg p-4 space-y-4"
                                >
                                    <div className="flex justify-between items-center">
                                        <Select 
                                            defaultValue={question.type}
                                            onValueChange={(value: Question['type']) => {
                                                // Update UI state
                                                setQuestions(
                                                    questions.map((q) =>
                                                        q.id === question.id
                                                            ? { ...q, type: value }
                                                            : q,
                                                    )
                                                );
                                                
                                                // Also update draft state for localStorage
                                                updateDraft({
                                                    questions: draft.draftContent.questions.map(q => 
                                                        q.question_id === parseInt(question.id)
                                                            ? { ...q, question_type: value }
                                                            : q
                                                    )
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Question type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="multiple-choice">
                                                    Multiple Choice
                                                </SelectItem>
                                                <SelectItem value="single-choice">
                                                    Single Choice
                                                </SelectItem>
                                                <SelectItem value="text">Text Input</SelectItem>
                                                <SelectItem value="rating">Rating Scale</SelectItem>
                                                <SelectItem value="code">Code Editor</SelectItem>
                                                <SelectItem value="image-upload">Image Upload</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`mandatory-${question.id}`}
                                                    checked={question.mandatory}
                                                    onCheckedChange={(checked: CheckedState) => {
                                                        const isChecked = checked === true;
                                                        
                                                        // Update UI state
                                                        setQuestions(
                                                            questions.map((q) =>
                                                                q.id === question.id
                                                                    ? { ...q, mandatory: isChecked }
                                                                    : q,
                                                            ),
                                                        );
                                                        
                                                        // Also update draft state for localStorage
                                                        updateDraft({
                                                            questions: draft.draftContent.questions.map(q => 
                                                                q.question_id === parseInt(question.id)
                                                                    ? { ...q, mandatory: isChecked }
                                                                    : q
                                                            )
                                                        });
                                                    }}
                                                />
                                                <label htmlFor={`mandatory-${question.id}`} className="text-sm font-medium">
                                                    Required
                                                </label>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteQuestion(question.id)}
                                                className="text-destructive"
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <Input
                                            value={question.text}
                                            placeholder="Enter question text"
                                            className={question.mandatory ? "pr-8" : ""}
                                            onChange={(e) => {
                                                // Update UI state
                                                setQuestions(
                                                    questions.map((q) =>
                                                        q.id === question.id
                                                            ? { ...q, text: e.target.value }
                                                            : q,
                                                    ),
                                                );
                                                
                                                // Also update draft state for localStorage
                                                updateDraft({
                                                    questions: draft.draftContent.questions.map(q => 
                                                        q.question_id === parseInt(question.id)
                                                            ? { ...q, question_text: e.target.value }
                                                            : q
                                                    )
                                                });
                                            }}
                                        />
                                        {question.mandatory && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-lg">*</span>
                                        )}
                                    </div>

                                    {/* Quiz-specific fields */}
                                    {draft.draftContent.basicInfo.is_quiz && (
                                        <div className="space-y-3 mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                                            <div className="text-sm font-medium text-blue-900">Quiz Settings</div>

                                            {/* Correct Answer - only for auto-gradable types (single/multiple choice) */}
                                            {(question.type === "single-choice" || question.type === "multiple-choice") && (
                                            <div className="space-y-2">
                                                <label htmlFor={`correct-answers-${question.id}`} className="text-sm font-medium flex items-center gap-2">
                                                    Correct Answer(s) <span className="text-red-500">*</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {question.type === "multiple-choice"
                                                            ? "(Comma-separated option numbers, e.g. 1,3,4)"
                                                            : "(Enter the correct option number, e.g. 2)"}
                                                    </span>
                                                </label>
                                                <Input
                                                    id={`correct-answers-${question.id}`}
                                                    value={question.correctAnswers || ""}
                                                    placeholder="Enter correct answer(s)"
                                                    className="bg-white"
                                                    onChange={(e) => {
                                                        setQuestions(
                                                            questions.map((q) =>
                                                                q.id === question.id
                                                                    ? { ...q, correctAnswers: e.target.value }
                                                                    : q
                                                            )
                                                        );
                                                        updateDraft({
                                                            questions: draft.draftContent.questions.map(q =>
                                                                q.question_id === parseInt(question.id)
                                                                    ? { ...q, correct_answers: e.target.value }
                                                                    : q
                                                            )
                                                        });
                                                    }}
                                                />
                                            </div>
                                            )}

                                            {/* Manual grading note for non-auto-gradable types */}
                                            {(question.type === "text" || question.type === "rating" || question.type === "image-upload") && (
                                                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                                    This question type requires manual evaluation by the conductor.
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label htmlFor={`points-${question.id}`} className="text-sm font-medium">
                                                    Points (default: 1)
                                                </label>
                                                <Input
                                                    id={`points-${question.id}`}
                                                    type="number"
                                                    min="0"
                                                    value={question.points || 1}
                                                    placeholder="1"
                                                    className="bg-white"
                                                    onChange={(e) => {
                                                        const points = e.target.value ? parseInt(e.target.value) : 1;
                                                        // Update UI state
                                                        setQuestions(
                                                            questions.map((q) =>
                                                                q.id === question.id
                                                                    ? { ...q, points }
                                                                    : q
                                                            )
                                                        );

                                                        // Also update draft state for localStorage
                                                        updateDraft({
                                                            questions: draft.draftContent.questions.map(q =>
                                                                q.question_id === parseInt(question.id)
                                                                    ? { ...q, points }
                                                                    : q
                                                            )
                                                        });
                                                    }}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor={`explanation-${question.id}`} className="text-sm font-medium">
                                                    Explanation (shown after quiz completion)
                                                </label>
                                                <Textarea
                                                    id={`explanation-${question.id}`}
                                                    value={question.explanation || ""}
                                                    placeholder="Explain why this is the correct answer..."
                                                    className="bg-white"
                                                    rows={2}
                                                    onChange={(e) => {
                                                        // Update UI state
                                                        setQuestions(
                                                            questions.map((q) =>
                                                                q.id === question.id
                                                                    ? { ...q, explanation: e.target.value }
                                                                    : q
                                                            )
                                                        );

                                                        // Also update draft state for localStorage
                                                        updateDraft({
                                                            questions: draft.draftContent.questions.map(q =>
                                                                q.question_id === parseInt(question.id)
                                                                    ? { ...q, explanation: e.target.value }
                                                                    : q
                                                            )
                                                        });
                                                    }}
                                                />
                                            </div>

                                            {/* Participant justification - only for choice questions (anti-cheating) */}
                                            {(question.type === "single-choice" || question.type === "multiple-choice") && (
                                            <div className="space-y-2 pt-2 border-t border-blue-200">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`requires-justification-${question.id}`}
                                                        checked={question.requiresJustification || false}
                                                        onCheckedChange={(checked: CheckedState) => {
                                                            const requiresJustification = checked === true;
                                                            // When turning off, also clear the mandatory flag
                                                            const justificationRequired = requiresJustification ? (question.justificationRequired || false) : false;
                                                            setQuestions(
                                                                questions.map((q) =>
                                                                    q.id === question.id
                                                                        ? { ...q, requiresJustification, justificationRequired }
                                                                        : q
                                                                )
                                                            );
                                                            updateDraft({
                                                                questions: draft.draftContent.questions.map(q =>
                                                                    q.question_id === parseInt(question.id)
                                                                        ? { ...q, requires_justification: requiresJustification, justification_required: justificationRequired }
                                                                        : q
                                                                )
                                                            });
                                                        }}
                                                    />
                                                    <label htmlFor={`requires-justification-${question.id}`} className="text-sm font-medium cursor-pointer">
                                                        Ask participants to justify their answer
                                                    </label>
                                                </div>
                                                {question.requiresJustification && (
                                                    <div className="flex items-center gap-2 ml-6">
                                                        <Checkbox
                                                            id={`justification-required-${question.id}`}
                                                            checked={question.justificationRequired || false}
                                                            onCheckedChange={(checked: CheckedState) => {
                                                                const justificationRequired = checked === true;
                                                                setQuestions(
                                                                    questions.map((q) =>
                                                                        q.id === question.id
                                                                            ? { ...q, justificationRequired }
                                                                            : q
                                                                    )
                                                                );
                                                                updateDraft({
                                                                    questions: draft.draftContent.questions.map(q =>
                                                                        q.question_id === parseInt(question.id)
                                                                            ? { ...q, justification_required: justificationRequired }
                                                                            : q
                                                                    )
                                                                });
                                                            }}
                                                        />
                                                        <label htmlFor={`justification-required-${question.id}`} className="text-sm cursor-pointer">
                                                            Make justification mandatory
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Media upload and display section */}
                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium">Media Attachments</div>
                                            <label 
                                                htmlFor={`media-upload-${question.id}`}
                                                className="flex items-center gap-1 text-sm cursor-pointer text-primary hover:underline"
                                            >
                                                <Upload className="h-4 w-4" />
                                                Add Media
                                            </label>
                                            <input
                                                id={`media-upload-${question.id}`}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileInputChange(e, question.id)}
                                            />
                                        </div>
                                        
                                        {/* Display uploaded media */}
                                        {question.mediaFiles && question.mediaFiles.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {question.mediaFiles.map((media) => (
                                                    <div 
                                                        key={media.id} 
                                                        className="relative border rounded-md overflow-hidden group"
                                                    >
                                                        {media.status === 'UPLOADING' && (
                                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                                                            </div>
                                                        )}
                                                        
                                                        {media.status === 'ERROR' && (
                                                            <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                                                                <div className="text-white text-sm">Upload Failed</div>
                                                            </div>
                                                        )}
                                                        
                                                        {media.type === 'IMAGE' || media.url?.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                                                            <img 
                                                                src={media.url} 
                                                                alt="Question media" 
                                                                className="w-full h-40 object-contain bg-gray-50 p-1"
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                                                                <FileImage className="h-10 w-10 text-gray-400" />
                                                            </div>
                                                        )}
                                                        
                                                        <button
                                                            onClick={() => removeMedia(question.id, media.id)}
                                                            className="absolute top-1 right-1 bg-white/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            aria-label="Remove media"
                                                        >
                                                            <X className="h-4 w-4 text-red-500" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Options for multiple/single choice and rating */}
                                    {question.type !== "text" && question.type !== "code" && question.type !== "image-upload" && (
                                        <div className="space-y-2 ml-4">
                                            {question.options.map((option) => (
                                                <div key={option.id} className="flex gap-2 items-center">
                                                    <Input
                                                        value={option.text}
                                                        placeholder="Option text"
                                                        className="flex-1"
                                                        onChange={(e) => {
                                                            // Update UI state
                                                            setQuestions(
                                                                questions.map((q) =>
                                                                    q.id === question.id
                                                                        ? {
                                                                                ...q,
                                                                                options: q.options.map((opt) =>
                                                                                    opt.id === option.id
                                                                                        ? { ...opt, text: e.target.value }
                                                                                        : opt,
                                                                                ),
                                                                            }
                                                                        : q,
                                                                ),
                                                            );

                                                            // Also update draft state for localStorage
                                                            updateDraft({
                                                                options: draft.draftContent.options.map(opt =>
                                                                    (opt.question_id === parseInt(question.id) && opt.optionId === option.id)
                                                                        ? { ...opt, option_text: e.target.value }
                                                                        : opt
                                                                )
                                                            });
                                                        }}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => deleteOption(question.id, option.id)}
                                                        className="text-destructive"
                                                    >
                                                        ×
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addOption(question.id)}
                                                className="mt-2"
                                            >
                                                + Add Option
                                            </Button>
                                        </div>
                                    )}

                                    {/* Code Question Editor */}
                                    {question.type === "code" && (
                                        <div className="mt-4">
                                            <CodeQuestionEditor
                                                settings={question.codeSettings || {
                                                    defaultLanguage: "python",
                                                    allowedLanguages: ["python", "javascript"],
                                                    testCases: [],
                                                    starterCode: {}
                                                }}
                                                onChange={(settings) => {
                                                    // Update UI state
                                                    setQuestions(
                                                        questions.map((q) =>
                                                            q.id === question.id
                                                                ? { ...q, codeSettings: settings }
                                                                : q
                                                        )
                                                    );

                                                    // Update draft state - store code settings as JSON in correct_answers field
                                                    updateDraft({
                                                        questions: draft.draftContent.questions.map(q =>
                                                            q.question_id === parseInt(question.id)
                                                                ? { ...q, correct_answers: JSON.stringify(settings) }
                                                                : q
                                                        )
                                                    });
                                                }}
                                            />
                                        </div>
                                    )}

                                </div>
                            ))}

                            <Button variant="outline" onClick={addQuestion} className="w-full">
                                + Add Question
                            </Button>
                        </CardContent>
                    </>
                )}

                <CardFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentSection(prev =>
                            prev === 'publish' ? 'questions' :
                            prev === 'questions' ? 'basic' : 'basic'
                        )}
                        disabled={currentSection === 'basic'}
                    >
                        Previous
                    </Button>
                    <Button
                        onClick={async () => {
                            if (currentSection === 'basic') {
                                setCurrentSection('questions');
                            } else if (currentSection === 'questions') {
                                setCurrentSection('publish');

                                // Auto-save when reaching the publish section
                                if (!draft.draftId) {
                                    console.log("Auto-saving when reaching publish section");
                                    await handleManualSave();
                                    // Force reload the draft ID from localStorage as a fallback
                                    try {
                                        const savedDraft = localStorage.getItem(STORAGE_KEY);
                                        if (savedDraft) {
                                            const parsed = JSON.parse(savedDraft);
                                            if (parsed.draftId) {
                                                console.log("Forced loading of draft ID from localStorage:", parsed.draftId);
                                                setDraft(prevDraft => ({
                                                    ...prevDraft,
                                                    draftId: parsed.draftId
                                                }));
                                            }
                                        }
                                    } catch (e) {
                                        console.error("Error loading draft ID from localStorage", e);
                                    }
                                }
                            } else if (currentSection === 'publish') {
                                console.log('Publish button clicked! Current draft state:', {
                                    draftId: draft.draftId,
                                    hasTitle: !!draft.draftContent.basicInfo.title,
                                    questionsCount: draft.draftContent.questions.length
                                });

                                // Double check draft ID exists before publishing
                                if (!draft.draftId) {
                                    console.log("No draft ID found, attempting emergency save");
                                    await handleManualSave();
                                }

                                handlePublish();
                            }
                        }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {currentSection === 'publish' ? 'Publish' : 'Next'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

