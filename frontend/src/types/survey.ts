export interface Survey {
	id: string;
	name: string;
	prizePool: string;
	dueDate: string;
	responses?: string;
	status: "draft" | "ongoing" | "completed";
}

export interface NotificationType {
	id: string;
	title: string;
	message: string;
	icon: string;
	timestamp: string;
}

export interface Question {
    id: string;
    text: string;
    type: "multiple-choice" | "single-choice" | "text" | "rating";
    options: Option[];
    mandatory: boolean;
    correctAnswers?: string;
    mediaFiles?: MediaFile[];
}

export interface Option {
    id: string;
    text: string;
}

export interface MediaFile {
    id: string;
    url: string;
    type: string;
    status: 'UPLOADING' | 'READY' | 'ERROR';
}

export interface DraftQuestion {
    question_id: number;
    tempId?: string;
    question_text: string;
    question_type: string;
    mandatory: boolean;
    branching_logic: string;
    correct_answers?: string;
    mediaFiles?: DraftMediaFile[];
}

export interface DraftMediaFile {
    mediaId: number;
    fileUrl: string;
    fileType: string;
    status: 'UPLOADING' | 'READY' | 'ERROR';
}

export interface DraftOption {
    optionId: string;
    question_id: number;
    questionTempId?: string;
    option_text: string;
}

export interface SurveyBasicInfo {
    title: string;
    description: string;
    is_self_recruitment: boolean;
    conductor_id: number;
    status: string;
}

export interface SurveyDraft {
    draftId?: number;
    surveyId?: number;
    draftContent: {
        basicInfo: SurveyBasicInfo;
        questions: DraftQuestion[];
        options: DraftOption[];
    };
    lastSaved: string;
    lastEditedQuestion?: string;
}

// Type for parsed draft data from localStorage
export interface ParsedDraftQuestion {
    question_id?: number;
    tempId?: string;
    question_text: string;
    question_type: string;
    mandatory: boolean;
    branching_logic: string;
    correct_answers?: string;
    options?: string[];
    mediaFiles?: DraftMediaFile[];
}

export interface ParsedDraftOption {
    optionId: string;
    question_id?: number;
    questionTempId?: string;
    option_text: string;
}

// Type for server response
export interface ServerResponse {
    data?: {
        draftId?: number;
        surveyId?: number;
    };
    draftId?: number;
    surveyId?: number;
    [key: string]: unknown;
}

// Type for window with requestIdleCallback support
export type WindowWithIdleCallback = Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

export type SurveySection = 'basic' | 'questions' | 'branching';
