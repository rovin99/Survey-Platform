// Types for survey taking functionality

export interface SurveyOption {
  id: number;
  questionId: number;
  optionText: string;
  orderIndex: number;
}

export interface SurveyQuestion {
  id: number;
  surveyId: number;
  questionText: string;
  questionType: "multiple-choice" | "single-choice" | "text" | "rating";
  mandatory: boolean;
  branchingLogic?: string | null;
  correctAnswers?: string | null;
  points?: number;
  explanation?: string;
  orderIndex: number;
  options?: SurveyOption[];
  mediaFiles?: SurveyMediaFile[];
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
  isQuiz?: boolean;
  timeLimitMinutes?: number;
  passingScorePercentage?: number;
  showCorrectAnswers?: boolean;
  shuffleQuestions?: boolean;
  questions: SurveyQuestion[];
}

export interface SurveySession {
  id: number;
  surveyId: number;
  participantId: number;
  sessionStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  lastQuestionId?: number | null;
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
}

export interface SavedAnswer extends Answer {
  saved: boolean;
  timestamp?: string;
}

export interface SubmitSurveyRequest {
  answers: Answer[];
  completedAt: string;
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



