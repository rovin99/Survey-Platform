import { participantsConfig } from '@/lib/api-config';

const PARTICIPANTS_URL = participantsConfig.baseUrl;

export interface PendingEvaluationSession {
  session_id: number;
  survey_id: number;
  participant_email: string;
  participant_info?: string;
  submitted_at: string;
}

export interface QuestionEvaluation {
  evaluation_id?: number;
  session_id: number;
  question_id: number;
  marks_given: number;
  max_marks: number;
  feedback?: string;
  evaluated_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EvaluationResult {
  session_id: number;
  total_score: number;
  max_score: number;
  percentage: number;
  evaluated_at: string;
  evaluations: QuestionEvaluation[];
}

export interface SessionAnswer {
  answer_id: number;
  session_id: number;
  question_id: number;
  response_data: string;
  justification?: string;
  created_at: string;
}

export interface SessionForEvaluation {
  session: {
    session_id: number;
    survey_id: number;
    participant_email: string;
    participant_info?: string;
    session_status: string;
    evaluation_status: string;
    created_at: string;
    updated_at: string;
  };
  answers: SessionAnswer[];
}

export interface QuestionEvaluationInput {
  question_id: number;
  marks_given: number;
  max_marks: number;
  feedback?: string;
}

export interface EvaluationSubmission {
  evaluations: QuestionEvaluationInput[];
  notify_by_email?: boolean;
}

class EvaluationService {
  private getAuthHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get all sessions pending evaluation for a survey
   */
  async getPendingEvaluations(surveyId: number): Promise<{
    pending_count: number;
    sessions: PendingEvaluationSession[];
  }> {
    const response = await fetch(
      `${PARTICIPANTS_URL}/api/participant/surveys/${surveyId}/pending-evaluations`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch pending evaluations' }));
      throw new Error(error.error || 'Failed to fetch pending evaluations');
    }

    return response.json();
  }

  /**
   * Get a session with its answers for evaluation
   */
  async getSessionForEvaluation(sessionId: number): Promise<SessionForEvaluation> {
    const response = await fetch(
      `${PARTICIPANTS_URL}/api/participant/sessions/${sessionId}/for-evaluation`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch session for evaluation' }));
      throw new Error(error.error || 'Failed to fetch session for evaluation');
    }

    return response.json();
  }

  /**
   * Save evaluation for a single question (auto-save while grading)
   */
  async saveQuestionEvaluation(
    sessionId: number,
    evaluation: QuestionEvaluationInput
  ): Promise<{ message: string }> {
    const response = await fetch(
      `${PARTICIPANTS_URL}/api/participant/sessions/${sessionId}/evaluation/question`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(evaluation),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to save evaluation' }));
      throw new Error(error.error || 'Failed to save evaluation');
    }

    return response.json();
  }

  /**
   * Submit complete evaluation for a session
   */
  async submitEvaluation(
    sessionId: number,
    submission: EvaluationSubmission
  ): Promise<{ message: string; result: EvaluationResult }> {
    const response = await fetch(
      `${PARTICIPANTS_URL}/api/participant/sessions/${sessionId}/manual-evaluate`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(submission),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to submit evaluation' }));
      throw new Error(error.error || 'Failed to submit evaluation');
    }

    return response.json();
  }

  /**
   * Get evaluation result for a session
   */
  async getEvaluationResult(sessionId: number): Promise<EvaluationResult> {
    const response = await fetch(
      `${PARTICIPANTS_URL}/api/participant/sessions/${sessionId}/evaluation-results`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch evaluation results' }));
      throw new Error(error.error || 'Failed to fetch evaluation results');
    }

    return response.json();
  }
}

export const evaluationService = new EvaluationService();
