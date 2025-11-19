import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { surveyApi } from '@/services/surveyApi';
import { FILE_TYPES } from '@/constants/survey';
import type { Question, DraftQuestion } from '@/types/survey';

export function useMediaUpload() {
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  const handleMediaUpload = useCallback(async (
    file: File,
    questionId: string,
    onQuestionUpdate: (questionId: string, updateFn: (q: Question) => Question) => void,
    onDraftUpdate: (questionId: number, updateFn: (q: DraftQuestion) => DraftQuestion) => void,
    draftId?: number
  ) => {
    const questionIdNum = parseInt(questionId);
    const tempMediaId = Date.now().toString();
    
    // Add to uploading set
    setUploadingFiles(prev => new Set(prev).add(tempMediaId));
    
    // Update UI state with uploading status
    onQuestionUpdate(questionId, (q) => ({
      ...q,
      mediaFiles: [
        ...(q.mediaFiles || []),
        {
          id: tempMediaId,
          url: URL.createObjectURL(file),
          type: file.type.startsWith('image/') ? FILE_TYPES.IMAGE : FILE_TYPES.DOCUMENT,
          status: 'UPLOADING'
        }
      ]
    }));

    // Update draft state with uploading status
    onDraftUpdate(questionIdNum, (q) => ({
      ...q,
      mediaFiles: [
        ...(q.mediaFiles || []),
        { 
          mediaId: parseInt(tempMediaId), 
          fileUrl: URL.createObjectURL(file), 
          fileType: file.type.startsWith('image/') ? FILE_TYPES.IMAGE : FILE_TYPES.DOCUMENT,
          status: 'UPLOADING' as const 
        }
      ]
    }));

    try {
      const result = await surveyApi.uploadMedia(file, draftId);
      
      // Remove from uploading set
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempMediaId);
        return newSet;
      });
      
      // Update UI state with success
      onQuestionUpdate(questionId, (q) => ({
        ...q,
        mediaFiles: (q.mediaFiles || []).map(m => 
          m.id === tempMediaId 
            ? { 
                ...m, 
                id: result.mediaId.toString(), 
                url: result.fileUrl, 
                type: result.fileType, 
                status: 'READY' 
              }
            : m
        )
      }));

      // Update draft state with success
      onDraftUpdate(questionIdNum, (q) => ({
        ...q,
        mediaFiles: (q.mediaFiles || []).map(m => 
          m.mediaId === parseInt(tempMediaId)
            ? { 
                mediaId: result.mediaId, 
                fileUrl: result.fileUrl, 
                fileType: result.fileType, 
                status: 'READY' as const 
              }
            : m
        )
      }));

      toast.success('Media uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      
      // Remove from uploading set
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempMediaId);
        return newSet;
      });
      
      // Update UI state with error
      onQuestionUpdate(questionId, (q) => ({
        ...q,
        mediaFiles: (q.mediaFiles || []).map(m => 
          m.id === tempMediaId 
            ? { ...m, status: 'ERROR' }
            : m
        )
      }));
      
      // Update draft state with error
      onDraftUpdate(questionIdNum, (q) => ({
        ...q,
        mediaFiles: (q.mediaFiles || []).map(m => 
          m.mediaId === parseInt(tempMediaId)
            ? { ...m, status: 'ERROR' as const }
            : m
        )
      }));
      
      toast.error('Failed to upload media');
    }
  }, []);

  const removeMedia = useCallback((
    questionId: string,
    mediaId: string,
    onQuestionUpdate: (questionId: string, updateFn: (q: Question) => Question) => void,
    onDraftUpdate: (questionId: number, updateFn: (q: DraftQuestion) => DraftQuestion) => void
  ) => {
    const questionIdNum = parseInt(questionId);
    
    // Update UI state
    onQuestionUpdate(questionId, (q) => ({
      ...q,
      mediaFiles: (q.mediaFiles || []).filter(m => m.id !== mediaId)
    }));
    
    // Update draft state
    onDraftUpdate(questionIdNum, (q) => ({
      ...q,
      mediaFiles: (q.mediaFiles || []).filter(m => m.mediaId.toString() !== mediaId)
    }));
  }, []);

  const handleFileInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    questionId: string,
    onQuestionUpdate: (questionId: string, updateFn: (q: Question) => Question) => void,
    onDraftUpdate: (questionId: number, updateFn: (q: DraftQuestion) => DraftQuestion) => void,
    draftId?: number
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleMediaUpload(files[0], questionId, onQuestionUpdate, onDraftUpdate, draftId);
      // Reset the input
      e.target.value = '';
    }
  }, [handleMediaUpload]);

  return {
    handleMediaUpload,
    removeMedia,
    handleFileInputChange,
    uploadingFiles: Array.from(uploadingFiles)
  };
} 