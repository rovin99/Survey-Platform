// Types for survey taking functionality

export interface SurveyOption {
  id: number;
  questionId: number;
  optionText: string;
  orderIndex: number;
}

export interface CodeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}

export interface CodeSettings {
  defaultLanguage?: string;
  allowedLanguages?: string[];
  testCases?: CodeTestCase[];
  starterCode?: Record<string, string>;
}

export interface SurveyQuestion {
  id: number;
  surveyId: number;
  questionText: string;
  questionType: "multiple-choice" | "single-choice" | "text" | "rating" | "code" | "image-upload";
  mandatory: boolean;
  correctAnswers?: string | null;
  points?: number;
  explanation?: string;
  requiresJustification?: boolean;
  justificationRequired?: boolean;
  orderIndex: number;
  options?: SurveyOption[];
  mediaFiles?: SurveyMediaFile[];
  codeSettings?: CodeSettings | string; // For code questions
}

export interface SurveyMediaFile {
  id: number;
  questionId: number;
  fileUrl: string;
  fileType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
}

export interface AvailableSurvey {
  id: number;
  title: string;
  description: string;
  conductor: {
    id: number;
    name: string;
  };
  estimatedTime: string;
  questionCount: number;
  reward?: number;
  category?: string;
  status: string;
  expiresAt?: string;
}

export interface SurveyDetail {
  id: number;
  title: string;
  description: string;
  conductorId: number;
  status: string;
  isSelfRecruitment: boolean;
  questionDisplayMode?: 'one_by_one' | 'all_at_once';
  isQuiz?: boolean;
  timeLimitMinutes?: number;
  passingScorePercentage?: number;
  showCorrectAnswers?: boolean;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  questions: SurveyQuestion[];
}

export interface SurveySession {
  id: number;
  surveyId: number;
  participantId: number;
  sessionStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  lastQuestionId?: number | null;
  session_token?: string; // Token for anonymous session access
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantDraft {
  id: number;
  sessionId: number;
  draftContent: string; // JSON string
  lastSaved: string;
}

export interface SessionResponse {
  session: SurveySession;
  draft?: ParticipantDraft | null;
  survey: SurveyDetail;
}

export interface Answer {
  questionId: number;
  responseData: string; // JSON string
  justification?: string; // Participant-authored reason for choice answers (anti-cheating)
}

export interface SavedAnswer extends Answer {
  saved: boolean;
  timestamp?: string;
}

export interface SubmitSurveyRequest {
  answers: Answer[];
  completedAt: string;
  participantEmail?: string; // For invitation tracking
  tabSwitchCount?: number;   // Anti-cheating: tab switch count
}

export interface SubmitSurveyResponse {
  sessionId: number;
  surveyId: number;
  completedAt: string;
  totalQuestions: number;
  answeredQuestions: number;
  timeTaken?: string;
  reward?: {
    points: number;
    currency?: number;
  };
}



