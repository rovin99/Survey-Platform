// app/survey_create/page.tsx

"use client";

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
import { Loader2, Save, X, Upload, FileImage } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { debounce } from 'perfect-debounce';

interface Question {
    id: string;
    text: string;
    type: "multiple-choice" | "single-choice" | "text" | "rating";
    options: Option[];
    mandatory: boolean;
    correctAnswers?: string;
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
        };
        questions: Array<{
            question_id: number;
            question_text: string;
            question_type: string;
            mandatory: boolean;
            branching_logic: string;
            correct_answers?: string;
            mediaFiles?: Array<{
                mediaId: number;
                fileUrl: string;
                fileType: string;
                status: 'UPLOADING' | 'READY' | 'ERROR';
            }>;
        }>;
        options: Array<{
            optionId: string;
            question_id: number;
            option_text: string;
        }>;
    };
    lastSaved: string;
    lastEditedQuestion?: string;
}

const STORAGE_KEY = 'currentSurveyDraft';
const BACKUP_KEY = `${STORAGE_KEY}-backup`;

const API_BASE_URL = 'http://localhost:3001'; // Backend API URL

export default function SurveyCreatePage() {
    const router = useRouter();
    
    const [isLoading, setIsLoading] = useState(false);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentSection, setCurrentSection] = useState<'basic' | 'questions' | 'branching'>('basic');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    
    // Initialize draft state
    const [draft, setDraft] = useState<SurveyDraft>({
        draftContent: {
            basicInfo: {
                title: '',
                description: '',
                is_self_recruitment: false,
                status: 'DRAFT',
                conductor_id: 1
            },
            questions: [],
            options: []
        },
        lastSaved: new Date().toISOString()
    });

    // Debug whenever draft state changes
    useEffect(() => {
        console.log('Draft state updated:', { 
            draftId: draft.draftId, 
            questionsCount: draft.draftContent.questions.length,
            hasTitle: !!draft.draftContent.basicInfo.title
        });
    }, [draft]);

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
                (window as any).requestIdleCallback(saveOperation, { timeout: 1000 });
            } else {
                setTimeout(saveOperation, 0);
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            toast.error("Failed to save draft locally");
        }
    };

    // Create a backup of the draft periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (draft.draftId) {
                saveToLocalStorage(draft, BACKUP_KEY);
            }
        }, 5 * 60 * 1000); // Every 5 minutes
        
        return () => clearInterval(interval);
    }, [draft]);

    // Load draft from localStorage on mount
    useEffect(() => {
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
                    parsed.draftContent.questions.forEach((q: {
                        tempId?: string;
                        question_id?: number;
                        options?: string[];
                    }) => {
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
                    parsed.draftContent.questions = parsed.draftContent.questions.map((q: any) => {
                        if (q.tempId && !q.question_id) {
                            return {
                                ...q,
                                question_id: parseInt(q.tempId) || parsed.draftContent.questions.indexOf(q) + 1,
                                tempId: undefined
                            };
                        }
                        return q;
                    });
                }
                
                // Convert any questionTempId to question_id in options array
                if (parsed.draftContent.options.length > 0) {
                    parsed.draftContent.options = parsed.draftContent.options.map((opt: any) => {
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
                    const loadedQuestions = parsed.draftContent.questions.map((q: any) => {
                        // Find options for this question
                        const questionOptions = parsed.draftContent.options
                            .filter((opt: any) => opt.question_id === q.question_id)
                            .map((opt: any, idx: number) => ({
                                id: opt.optionId || `${q.question_id}-opt-${idx}`,
                                text: opt.option_text
                            }));
                        
                        return {
                            id: q.question_id.toString(),
                            text: q.question_text,
                            type: q.question_type as any,
                            mandatory: q.mandatory || false,
                            correctAnswers: q.correct_answers || "",
                            options: questionOptions,
                            mediaFiles: q.mediaFiles?.map((m: any) => ({
                                id: m.mediaId.toString(),
                                url: m.fileUrl,
                                type: m.fileType,
                                status: m.status as any
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
        
        // Create a question ID mapping for normalization
        const questionIdMap = new Map<number, number>();
        
        // Assign sequential IDs to questions
        draftData.draftContent.questions.forEach((question, index) => {
            const originalId = question.question_id;
            const normalizedId = index + 1; // Start with 1
            questionIdMap.set(originalId, normalizedId);
        });
        
        // Transform data to match backend schema
        const transformedContent = {
            basicInfo: {
                title: draftData.draftContent.basicInfo.title,
                description: draftData.draftContent.basicInfo.description,
                is_self_recruitment: draftData.draftContent.basicInfo.is_self_recruitment,
                status: draftData.draftContent.basicInfo.status,
                conductor_id: draftData.draftContent.basicInfo.conductor_id
            },
            questions: draftData.draftContent.questions.map((q, index) => ({
                question_id: index + 1, // Use normalized ID
                question_text: q.question_text,
                question_type: q.question_type,
                mandatory: q.mandatory,
                branching_logic: q.branching_logic,
                correct_answers: q.correct_answers || ""
            })),
            options: draftData.draftContent.options.map(opt => ({
                option_text: opt.option_text,
                question_id: questionIdMap.get(opt.question_id) || 1 // Use normalized question ID
            })),
            mediaFiles: draftData.draftContent.questions.flatMap(q => 
                (q.mediaFiles || []).map(m => ({
                    question_id: questionIdMap.get(q.question_id) || 1, // Use normalized question ID
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
            let endpoint = `${API_BASE_URL}/api/v1/drafts`;
            
            // Only use PUT if we have a valid draft ID that was previously saved
            if (validDraftId) {
                // OPTION 1: Check if draft exists by making a request
                // Uncomment this block if your backend supports draft existence checks
                
                try {
                    // First try with HEAD request (lightweight)
                    let checkResponse = await fetch(`${API_BASE_URL}/api/v1/drafts/${validDraftId}`, {
                        method: 'HEAD'
                    });
                    
                    // If HEAD method is not supported, fall back to GET
                    if (checkResponse.status === 405) { // Method Not Allowed
                        console.log('HEAD method not supported, falling back to GET');
                        checkResponse = await fetch(`${API_BASE_URL}/api/v1/drafts/${validDraftId}`, {
                            method: 'GET'
                        });
                    }
                    
                    if (checkResponse.ok) {
                        method = 'PUT';
                        endpoint = `${API_BASE_URL}/api/v1/drafts/${validDraftId}`;
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
                survey_id: draftData.draftContent.basicInfo.conductor_id,
                draft_content: transformedContent,
                last_edited_question: draftData.lastEditedQuestion ? parseInt(draftData.lastEditedQuestion) : 0,
                draft_id: validDraftId || undefined // Initialize with value or undefined
            };
            
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error('Failed to sync with server');

            const result = await response.json();
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
                const findDraftId = (obj: any): number | null => {
                    if (!obj || typeof obj !== 'object') return null;
                    
                    // Direct check for draftId (case sensitive and insensitive)
                    if ('draftId' in obj) return obj.draftId;
                    if ('draft_id' in obj) return obj.draft_id;
                    
                    // Search for any property containing 'draft' and 'id'
                    for (const key in obj) {
                        const lowerKey = key.toLowerCase();
                        if (lowerKey.includes('draft') && lowerKey.includes('id') && typeof obj[key] === 'number') {
                            return obj[key];
                        }
                        
                        if (typeof obj[key] === 'object') {
                            const found: number | null = findDraftId(obj[key]);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                
                draftIdFromResponse = findDraftId(result);
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
                        ? `${API_BASE_URL}/api/v1/drafts/${draftData.draftId}`
                        : `${API_BASE_URL}/api/v1/drafts`;
                        
                    const retryResponse = await fetch(retryEndpoint, {
                        method: retryMethod,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            survey_id: draftData.draftContent.basicInfo.conductor_id,
                            draft_content: transformedContent,
                            last_edited_question: draftData.lastEditedQuestion ? parseInt(draftData.lastEditedQuestion) : 0
                        })
                    });

                    if (retryResponse.ok) {
                        const retryResult = await retryResponse.json();
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
                            const findDraftId = (obj: any): number | null => {
                                if (!obj || typeof obj !== 'object') return null;
                                if ('draftId' in obj) return obj.draftId;
                                if ('draft_id' in obj) return obj.draft_id;
                                
                                // Search for properties containing 'draft' and 'id'
                                for (const key in obj) {
                                    const lowerKey = key.toLowerCase();
                                    if (lowerKey.includes('draft') && lowerKey.includes('id') && typeof obj[key] === 'number') {
                                        return obj[key];
                                    }
                                    
                                    if (typeof obj[key] === 'object') {
                                        const found: number | null = findDraftId(obj[key]);
                                        if (found) return found;
                                    }
                                }
                                return null;
                            };
                            
                            retryDraftId = findDraftId(retryResult);
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

    // Track if a sync is in progress
    const isSyncingRef = useRef(false);
    // Track the latest draft that needs to be synced
    const pendingDraftRef = useRef<SurveyDraft | null>(null);

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
            const debouncedFn = queueDraftForSync as any;
            if (debouncedFn && typeof debouncedFn.cancel === 'function') {
                debouncedFn.cancel();
            }
        };
    }, []);

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
        // Parse question ID to number
        const questionIdNum = parseInt(questionId);
        
        // Create a temporary ID for the media file
        const tempMediaId = Date.now().toString();
        
        // Update UI state first with uploading status
        setQuestions(
            questions.map((q) =>
                q.id === questionId
                    ? {
                          ...q,
                          mediaFiles: [
                              ...(q.mediaFiles || []),
                              {
                                  id: tempMediaId,
                                  url: URL.createObjectURL(file),
                                  type: file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
                                  status: 'UPLOADING'
                              }
                          ]
                      }
                    : q
            )
        );
        
        // Create form data for upload
        const formData = new FormData();
        formData.append('file', file);
        if (draft.draftId) {
            formData.append('draftId', draft.draftId.toString());
        }

        try {
            // Update draft state with uploading status
            const updatedDraftQuestions = draft.draftContent.questions.map(q =>
                q.question_id === questionIdNum ? {
                    ...q,
                    mediaFiles: [
                        ...(q.mediaFiles || []),
                        { 
                            mediaId: parseInt(tempMediaId), 
                            fileUrl: URL.createObjectURL(file), 
                            fileType: file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
                            status: 'UPLOADING' as const 
                        }
                    ]
                } : q
            );
            
            // Update draft with uploading status
            updateDraft({ questions: updatedDraftQuestions });
            
            // Send to server
            const response = await fetch(`${API_BASE_URL}/api/v1/media/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const { mediaId, fileUrl, fileType } = await response.json();
            
            // Update UI state with success
            setQuestions(
                questions.map((q) =>
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

            // Update draft state with success
            const finalUpdatedQuestions = draft.draftContent.questions.map(q =>
                q.question_id === questionIdNum ? {
                    ...q,
                    mediaFiles: (q.mediaFiles || []).map(m => 
                        m.mediaId === parseInt(tempMediaId)
                            ? { mediaId, fileUrl, fileType, status: 'READY' as const }
                            : m
                    )
                } : q
            );

            updateDraft({ questions: finalUpdatedQuestions }, questionId);
            toast.success('Media uploaded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            
            // Update UI state with error
            setQuestions(
                questions.map((q) =>
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
            
            // Update draft state with error
            const errorUpdatedQuestions = draft.draftContent.questions.map(q =>
                q.question_id === questionIdNum ? {
                    ...q,
                    mediaFiles: (q.mediaFiles || []).map(m => 
                        m.mediaId === parseInt(tempMediaId)
                            ? { ...m, status: 'ERROR' as const }
                            : m
                    )
                } : q
            );
            
            updateDraft({ questions: errorUpdatedQuestions });
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
            console.log("Starting publish process. Current draft:", {
                draftId: draft.draftId,
                hasTitle: !!draft.draftContent.basicInfo.title,
                questionsCount: draft.draftContent.questions.length
            });
            
            // Double-check if draftId is available in localStorage even if not in state
            if (!draft.draftId) {
                console.log("No draft ID in current state, checking localStorage");
                try {
                    const savedDraft = localStorage.getItem(STORAGE_KEY);
                    if (savedDraft) {
                        const parsed = JSON.parse(savedDraft);
                        if (parsed.draftId) {
                            console.log("Found draftId in localStorage that's not in state:", parsed.draftId);
                            // Update the state with the draftId from localStorage
                            const draftId = parsed.draftId;
                            setDraft(prevDraft => ({
                                ...prevDraft,
                                draftId: draftId
                            }));
                            
                            // Now publish the saved draft
                            const publishUrl = `${API_BASE_URL}/api/v1/drafts/${draftId}/publish`;
                            console.log(`Publishing draft to: ${publishUrl}`);
                            
                            const response = await fetch(publishUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
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
                            router.push('/surveys');
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Error checking localStorage for draftId:", e);
                }
                
                // If we got here, we didn't find a draftId in localStorage
                toast.info("Saving draft before publishing...");
                
                // Check if we have a valid draft to save
                if (!draft.draftContent.basicInfo.title && draft.draftContent.questions.length === 0) {
                    toast.warning("Please add a title or questions before publishing");
                    setIsSubmitting(false);
                    return;
                }
                
                // Save the draft first
                const savedDraft = await syncWithBackend(draft);
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
                console.log("Using existing draftId:", draft.draftId);
            }

            // Ensure we have a valid draftId before proceeding
            if (!draft.draftId) {
                console.error("Still no draftId after save attempt");
                toast.error("Could not obtain a draft ID. Please try saving manually first.");
                setIsSubmitting(false);
                return;
            }

            // Now publish the saved draft
            const publishUrl = `${API_BASE_URL}/api/v1/drafts/${draft.draftId}/publish`;
            console.log(`Publishing draft to: ${publishUrl}`);
            
            const response = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            router.push('/surveys');
        } catch (error: any) {
            console.error('Publishing failed:', error);
            toast.error(`Failed to publish survey: ${error.message || "Unknown error"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const addQuestion = () => {
        // Get the next sequential question ID
        const nextQuestionId = draft.draftContent.questions.length > 0 
            ? Math.max(...draft.draftContent.questions.map(q => q.question_id)) + 1
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
            correctAnswers: ""
        };
        
        // Update UI state
        setQuestions([...questions, newQuestion]);
        
        // Also update draft state for localStorage
        const newDraftQuestion = {
            question_id: nextQuestionId,
            question_text: "",
            question_type: "multiple-choice",
            mandatory: false,
            branching_logic: "",
            correct_answers: "",
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
            const debouncedFn = queueDraftForSync as any;
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
                                            onValueChange={(value) => {
                                                // Update UI state
                                                setQuestions(
                                                    questions.map((q) =>
                                                        q.id === question.id
                                                            ? { ...q, type: value as any }
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

                                    <div className="space-y-2 mt-4">
                                        <label htmlFor={`correct-answers-${question.id}`} className="text-sm font-medium flex items-center gap-2">
                                            Correct Answer(s)
                                            <span className="text-xs text-muted-foreground">
                                                {question.type === "multiple-choice" 
                                                    ? "(Comma-separated option numbers, e.g. 1,3,4)" 
                                                    : question.type === "single-choice" 
                                                    ? "(Enter the correct option number, e.g. 2)" 
                                                    : "(Enter the correct answer text)"}
                                            </span>
                                        </label>
                                        <Input
                                            id={`correct-answers-${question.id}`}
                                            value={question.correctAnswers || ""}
                                            placeholder="Enter correct answer(s)"
                                            onChange={(e) => {
                                                // Update UI state
                                                setQuestions(
                                                    questions.map((q) =>
                                                        q.id === question.id
                                                            ? { ...q, correctAnswers: e.target.value }
                                                            : q
                                                    )
                                                );
                                                
                                                // Also update draft state for localStorage
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
                                                        
                                                        {media.type === 'IMAGE' ? (
                                                            <img 
                                                                src={media.url} 
                                                                alt="Question media" 
                                                                className="w-full h-32 object-cover"
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

                                    {question.type !== "text" && (
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
                                </div>
                            ))}

                            <Button variant="outline" onClick={addQuestion} className="w-full">
                                + Add Question
                            </Button>
                        </CardContent>
                    </>
                )}

                {currentSection === 'branching' && (
                    <>
                        <CardHeader>
                            <CardTitle>Branching Logic</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Add branching logic section content here */}
                        </CardContent>
                    </>
                )}

                <CardFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentSection(prev => 
                            prev === 'branching' ? 'questions' :
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
                                setCurrentSection('branching');
                                
                                // Auto-save when reaching the branching (publish) section
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
                            } else if (currentSection === 'branching') {
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
                        {currentSection === 'branching' ? 'Publish' : 'Next'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

