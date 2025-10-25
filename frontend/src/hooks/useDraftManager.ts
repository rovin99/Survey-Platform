import { useState, useRef, useCallback, useEffect } from 'react';
import { debounce } from 'perfect-debounce';
import { toast } from 'sonner';
import { STORAGE_KEYS, TIMING, LIMITS } from '@/constants/survey';
import { surveyApi } from '@/services/surveyApi';
import type { 
  SurveyDraft, 
  ParsedDraftQuestion, 
  ParsedDraftOption, 
  Question,
  ServerResponse,
  WindowWithIdleCallback 
} from '@/types/survey';

export function useDraftManager(conductorId: number) {
  const [draft, setDraft] = useState<SurveyDraft>({
    draftContent: {
      basicInfo: {
        title: '',
        description: '',
        is_self_recruitment: false,
        status: 'DRAFT',
        conductor_id: conductorId
      },
      questions: [],
      options: []
    },
    lastSaved: new Date().toISOString()
  });

  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const isSyncingRef = useRef(false);
  const pendingDraftRef = useRef<SurveyDraft | null>(null);

  // Utility function to save to localStorage
  const saveToLocalStorage = useCallback((draftToSave: SurveyDraft, key = STORAGE_KEYS.CURRENT_DRAFT) => {
    try {
      const saveOperation = () => {
        const serialized = JSON.stringify(draftToSave);
        
        if (serialized.length > LIMITS.STORAGE_SIZE_WARNING) {
          toast.warning("Draft is getting large, consider publishing soon");
        }
        
        localStorage.setItem(key, serialized);
      };
      
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as WindowWithIdleCallback).requestIdleCallback?.(saveOperation, { 
          timeout: TIMING.IDLE_CALLBACK_TIMEOUT 
        });
      } else {
        setTimeout(saveOperation, 0);
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      toast.error("Failed to save draft locally");
    }
  }, []);

  // Transform draft for server
  const transformDraftForServer = useCallback((draftData: SurveyDraft) => {
    const questionIdMap = new Map<number, number>();
    
    draftData.draftContent.questions.forEach((question, index) => {
      const originalId = question.question_id;
      const normalizedId = index + 1;
      if (originalId !== undefined) {
        questionIdMap.set(originalId, normalizedId);
      }
    });

    return {
      basicInfo: draftData.draftContent.basicInfo,
      questions: draftData.draftContent.questions.map((q, index) => ({
        question_id: index + 1,
        question_text: q.question_text,
        question_type: q.question_type,
        mandatory: q.mandatory,
        branching_logic: q.branching_logic,
        correct_answers: q.correct_answers || ""
      })),
      options: draftData.draftContent.options.map(opt => ({
        option_text: opt.option_text,
        question_id: questionIdMap.get(opt.question_id) || 1
      })),
      mediaFiles: draftData.draftContent.questions.flatMap(q => 
        (q.mediaFiles || []).map(m => ({
          question_id: questionIdMap.get(q.question_id) || 1,
          file_url: m.fileUrl,
          file_type: m.fileType
        }))
      )
    };
  }, []);

  // Find draft ID in server response
  const findDraftIdInResponse = useCallback((obj: ServerResponse): number | null => {
    if (!obj || typeof obj !== 'object') return null;
    
    if ('draftId' in obj && typeof obj.draftId === 'number') return obj.draftId;
    if ('draft_id' in obj && typeof obj.draft_id === 'number') return obj.draft_id as number;
    
    if (obj.data && typeof obj.data === 'object' && obj.data.draftId) {
      return obj.data.draftId;
    }
    
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
  }, []);

  // Sync with backend
  const syncWithBackend = useCallback(async (draftData: SurveyDraft) => {
    if (!draftData.draftContent.basicInfo.title && draftData.draftContent.questions.length === 0) {
      return;
    }

    try {
      const transformedContent = transformDraftForServer(draftData);
      const result = await surveyApi.saveDraftWithRetry(draftData, transformedContent);
      
      const draftIdFromResponse = findDraftIdInResponse(result);
      
      if (draftIdFromResponse) {
        const updatedDraft = {
          ...draftData,
          draftId: draftIdFromResponse,
          lastSaved: new Date().toISOString()
        };
        
        saveToLocalStorage(updatedDraft);
        setDraft(updatedDraft);
        setLastSynced(new Date());
        
        return updatedDraft;
      }

      throw new Error('Server did not return draftId');
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error("Failed to sync with server. Will retry automatically.");
      throw error;
    }
  }, [transformDraftForServer, findDraftIdInResponse, saveToLocalStorage]);

  // Process pending drafts
  const processPendingDraft = useCallback(async () => {
    if (pendingDraftRef.current && !isSyncingRef.current) {
      isSyncingRef.current = true;
      try {
        const latestDraft = {
          ...pendingDraftRef.current,
          draftId: pendingDraftRef.current.draftId || draft.draftId
        };
        
        await syncWithBackend(latestDraft);
        pendingDraftRef.current = null;
      } finally {
        isSyncingRef.current = false;
        if (pendingDraftRef.current) {
          processPendingDraft();
        }
      }
    }
  }, [draft.draftId, syncWithBackend]);

  // Debounced sync function
  const queueDraftForSync = useRef(
    debounce((draftData: SurveyDraft) => {
      requestAnimationFrame(() => {
        pendingDraftRef.current = { ...draftData };
        processPendingDraft();
      });
    }, TIMING.DEBOUNCE_DELAY)
  ).current;

  // Save draft locally and queue for sync
  const saveDraft = useCallback((updatedDraft: SurveyDraft) => {
    try {
      saveToLocalStorage(updatedDraft);
      queueDraftForSync(updatedDraft);
    } catch (error) {
      console.error('Error in saveDraft:', error);
      toast.error("Failed to save draft");
    }
  }, [saveToLocalStorage, queueDraftForSync]);

  // Update draft content
  const updateDraft = useCallback((
    updates: Partial<SurveyDraft['draftContent']>, 
    lastEditedQuestionId?: string
  ) => {
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
      
      requestAnimationFrame(() => {
        saveDraft(updatedDraft);
      });
      
      return updatedDraft;
    });
  }, [saveDraft]);

  // Manual save (bypasses debounce)
  const manualSave = useCallback(async () => {
    try {
      const debouncedFn = queueDraftForSync as { cancel?: () => void };
      if (debouncedFn && typeof debouncedFn.cancel === 'function') {
        debouncedFn.cancel();
      }
      
      pendingDraftRef.current = null;
      
      if (isSyncingRef.current) {
        await new Promise<void>((resolve) => {
          const checkSync = () => {
            if (!isSyncingRef.current) {
              resolve();
            } else {
              setTimeout(checkSync, TIMING.SYNC_CHECK_INTERVAL);
            }
          };
          setTimeout(checkSync, TIMING.SYNC_INITIAL_DELAY);
        });
      }
      
      if (!draft.draftContent.basicInfo.title && draft.draftContent.questions.length === 0) {
        toast.warning("Please add a title or questions before saving");
        return;
      }
      
      const savedDraft = await syncWithBackend(draft);
      if (savedDraft) {
        setDraft(savedDraft);
        saveToLocalStorage(savedDraft);
        toast.success("Draft saved successfully");
        return savedDraft;
      }
    } catch (error) {
      console.error("Manual save failed:", error);
      toast.error("Failed to save draft");
      throw error;
    }
  }, [draft, syncWithBackend, saveToLocalStorage, queueDraftForSync]);

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    try {
      const savedDraft = localStorage.getItem(STORAGE_KEYS.CURRENT_DRAFT);
      if (!savedDraft) return null;

      const parsed = JSON.parse(savedDraft);
      
      // Handle legacy format conversion
      if (!parsed.draftContent.options) {
        parsed.draftContent.options = [];
        
        parsed.draftContent.questions.forEach((q: ParsedDraftQuestion) => {
          if (q.options) {
            const questionId = q.question_id || parseInt(q.tempId || "0");
            q.options.forEach((optText: string, idx: number) => {
              parsed.draftContent.options.push({
                optionId: `${questionId}-opt-${idx}`,
                question_id: questionId,
                option_text: optText
              });
            });
            delete q.options;
          }
          
          if (q.tempId && !q.question_id) {
            q.question_id = parseInt(q.tempId) || q.question_id;
            delete q.tempId;
          }
        });
      }
      
      // Convert remaining tempIds
      if (parsed.draftContent.questions.length > 0) {
        parsed.draftContent.questions = parsed.draftContent.questions.map(
          (q: ParsedDraftQuestion, index: number) => {
            if (q.tempId && !q.question_id) {
              return {
                ...q,
                question_id: parseInt(q.tempId) || index + 1,
                tempId: undefined
              };
            }
            return q;
          }
        );
      }
      
      if (parsed.draftContent.options.length > 0) {
        parsed.draftContent.options = parsed.draftContent.options.map(
          (opt: ParsedDraftOption) => {
            if (opt.questionTempId && !opt.question_id) {
              return {
                ...opt,
                question_id: parseInt(opt.questionTempId) || 0,
                questionTempId: undefined
              };
            }
            return opt;
          }
        );
      }

      // Update conductor ID if provided
      if (conductorId) {
        parsed.draftContent.basicInfo.conductor_id = conductorId;
      }
      
      setDraft(parsed);
      return parsed;
    } catch (error) {
      console.error('Error loading draft:', error);
      toast.error("Failed to load saved draft");
      
      // Try backup
      const backupDraft = localStorage.getItem(STORAGE_KEYS.BACKUP_DRAFT);
      if (backupDraft) {
        try {
          const backup = JSON.parse(backupDraft);
          setDraft(backup);
          toast.success("Recovered from backup draft");
          return backup;
        } catch {
          // Backup failed too
        }
      }
      return null;
    }
  }, [conductorId]);

  // Transform draft questions to UI format
  const transformQuestionsForUI = useCallback((draftQuestions: any[], draftOptions: any[]): Question[] => {
    return draftQuestions.map((q: ParsedDraftQuestion) => {
      const questionOptions = draftOptions
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
        options: questionOptions,
        mediaFiles: q.mediaFiles?.map((m) => ({
          id: m.mediaId.toString(),
          url: m.fileUrl,
          type: m.fileType,
          status: m.status
        }))
      };
    });
  }, []);

  // Publish draft
  const publishDraft = useCallback(async (): Promise<void> => {
    if (!draft.draftId) {
      const savedDraft = await manualSave();
      if (!savedDraft?.draftId) {
        throw new Error("Could not obtain a draft ID for publishing");
      }
    }

    const result = await surveyApi.publishDraft(draft.draftId!);
    
    localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT);
    localStorage.removeItem(STORAGE_KEYS.BACKUP_DRAFT);
    
    return result;
  }, [draft.draftId, manualSave]);

  // Setup backup interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (draft.draftId) {
        saveToLocalStorage(draft, STORAGE_KEYS.BACKUP_DRAFT);
      }
    }, TIMING.BACKUP_INTERVAL);
    
    return () => clearInterval(interval);
  }, [draft, saveToLocalStorage]);

  // Cleanup debounced function
  useEffect(() => {
    return () => {
      const debouncedFn = queueDraftForSync as { cancel?: () => void };
      if (debouncedFn && typeof debouncedFn.cancel === 'function') {
        debouncedFn.cancel();
      }
    };
  }, [queueDraftForSync]);

  return {
    draft,
    setDraft,
    lastSynced,
    updateDraft,
    saveDraft,
    manualSave,
    loadDraft,
    publishDraft,
    transformQuestionsForUI,
    isLoading: isSyncingRef.current
  };
} 