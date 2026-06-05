package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/models"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository"
)

var (
	ErrSessionNotCompleted    = errors.New("session is not completed")
	ErrNotPendingEvaluation   = errors.New("session is not pending evaluation")
	ErrUnauthorizedEvaluation = errors.New("unauthorized to evaluate this session")
	ErrInvalidMarks           = errors.New("marks cannot exceed max marks")
)

// QuestionEvaluationInput represents input for evaluating a single question
type QuestionEvaluationInput struct {
	QuestionID uint    `json:"question_id"`
	MarksGiven float64 `json:"marks_given"`
	MaxMarks   float64 `json:"max_marks"`
	Feedback   string  `json:"feedback,omitempty"`
}

// EvaluationSubmission represents the full evaluation submission
type EvaluationSubmission struct {
	SessionID   uint                      `json:"session_id"`
	Evaluations []QuestionEvaluationInput `json:"evaluations"`
}

// EvaluationResult represents the result of an evaluation
type EvaluationResult struct {
	SessionID       uint                       `json:"session_id"`
	TotalScore      float64                    `json:"total_score"`
	MaxScore        float64                    `json:"max_score"`
	Percentage      float64                    `json:"percentage"`
	EvaluatedAt     time.Time                  `json:"evaluated_at"`
	Evaluations     []models.QuestionEvaluation `json:"evaluations"`
}

// PendingEvaluationSession represents a session pending evaluation
type PendingEvaluationSession struct {
	SessionID        uint      `json:"session_id"`
	SurveyID         uint      `json:"survey_id"`
	ParticipantEmail string    `json:"participant_email"`
	ParticipantInfo  string    `json:"participant_info,omitempty"`
	SubmittedAt      time.Time `json:"submitted_at"`
}

// EvaluationService defines the interface for evaluation operations
type EvaluationService interface {
	// GetPendingEvaluations gets all sessions pending evaluation for a survey
	GetPendingEvaluations(ctx context.Context, surveyID, conductorID uint) ([]PendingEvaluationSession, error)
	// GetSessionForEvaluation gets a session with answers for evaluation
	GetSessionForEvaluation(ctx context.Context, sessionID, conductorID uint) (*models.SurveySession, []models.Answer, error)
	// SaveQuestionEvaluation saves evaluation for a single question (auto-save)
	SaveQuestionEvaluation(ctx context.Context, sessionID uint, eval QuestionEvaluationInput, conductorID uint) error
	// SubmitEvaluation submits the complete evaluation for a session
	SubmitEvaluation(ctx context.Context, submission EvaluationSubmission, conductorID uint) (*EvaluationResult, error)
	// GetEvaluationResult gets the evaluation result for a session
	GetEvaluationResult(ctx context.Context, sessionID uint) (*EvaluationResult, error)
	// MarkSessionForManualEvaluation marks a completed session as pending evaluation
	MarkSessionForManualEvaluation(ctx context.Context, sessionID uint) error
	// GetSessionForNotification returns session info needed for email notification
	GetSessionForNotification(ctx context.Context, sessionID uint) (*SessionNotificationInfo, error)
}

// SessionNotificationInfo contains info needed to send results email
type SessionNotificationInfo struct {
	Email        string
	SurveyTitle  string
	QuestionMap  map[uint]string // questionID → questionText
}

type evaluationService struct {
	evalRepo    repository.EvaluationRepository
	sessionRepo repository.ParticipantRepository
}

// NewEvaluationService creates a new evaluation service
func NewEvaluationService(evalRepo repository.EvaluationRepository, sessionRepo repository.ParticipantRepository) EvaluationService {
	return &evaluationService{
		evalRepo:    evalRepo,
		sessionRepo: sessionRepo,
	}
}

func (s *evaluationService) GetPendingEvaluations(ctx context.Context, surveyID, conductorID uint) ([]PendingEvaluationSession, error) {
	// Verify conductor owns this survey
	isOwner, err := s.sessionRepo.VerifySurveyOwnership(ctx, surveyID, conductorID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify ownership: %w", err)
	}
	if !isOwner {
		return nil, ErrUnauthorizedEvaluation
	}

	sessions, err := s.evalRepo.GetPendingEvaluationSessions(ctx, surveyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending sessions: %w", err)
	}

	result := make([]PendingEvaluationSession, len(sessions))
	for i, sess := range sessions {
		result[i] = PendingEvaluationSession{
			SessionID:        sess.SessionID,
			SurveyID:         sess.SurveyID,
			ParticipantEmail: sess.ParticipantEmail,
			SubmittedAt:      sess.UpdatedAt,
		}
		if sess.ParticipantInfo != nil {
			result[i].ParticipantInfo = string(sess.ParticipantInfo)
		}
	}

	return result, nil
}

func (s *evaluationService) GetSessionForEvaluation(ctx context.Context, sessionID, conductorID uint) (*models.SurveySession, []models.Answer, error) {
	session, err := s.sessionRepo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Verify conductor owns this survey
	isOwner, err := s.sessionRepo.VerifySurveyOwnership(ctx, session.SurveyID, conductorID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to verify ownership: %w", err)
	}
	if !isOwner {
		return nil, nil, ErrUnauthorizedEvaluation
	}

	// Get answers for this session
	answers, err := s.sessionRepo.GetAnswersBySessionID(ctx, sessionID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get answers: %w", err)
	}

	return session, answers, nil
}

func (s *evaluationService) SaveQuestionEvaluation(ctx context.Context, sessionID uint, eval QuestionEvaluationInput, conductorID uint) error {
	// Validate marks
	if eval.MarksGiven > eval.MaxMarks {
		return ErrInvalidMarks
	}
	if eval.MarksGiven < 0 {
		return ErrInvalidMarks
	}

	session, err := s.sessionRepo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}

	// Verify conductor owns this survey
	isOwner, err := s.sessionRepo.VerifySurveyOwnership(ctx, session.SurveyID, conductorID)
	if err != nil {
		return fmt.Errorf("failed to verify ownership: %w", err)
	}
	if !isOwner {
		return ErrUnauthorizedEvaluation
	}

	evaluation := &models.QuestionEvaluation{
		SessionID:   sessionID,
		QuestionID:  eval.QuestionID,
		MarksGiven:  eval.MarksGiven,
		MaxMarks:    eval.MaxMarks,
		Feedback:    eval.Feedback,
		EvaluatedBy: conductorID,
	}

	return s.evalRepo.CreateOrUpdateEvaluation(ctx, evaluation)
}

func (s *evaluationService) SubmitEvaluation(ctx context.Context, submission EvaluationSubmission, conductorID uint) (*EvaluationResult, error) {
	session, err := s.sessionRepo.GetSessionByID(ctx, submission.SessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Verify session is completed
	if session.SessionStatus != "COMPLETED" {
		return nil, ErrSessionNotCompleted
	}

	// Allow evaluation/re-evaluation for any completed session
	// (conductors can edit marks from the results page regardless of current evaluation status)

	// Verify conductor owns this survey
	isOwner, err := s.sessionRepo.VerifySurveyOwnership(ctx, session.SurveyID, conductorID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify ownership: %w", err)
	}
	if !isOwner {
		return nil, ErrUnauthorizedEvaluation
	}

	// Save all evaluations and calculate total score
	var totalScore, maxScore float64
	for _, eval := range submission.Evaluations {
		if eval.MarksGiven > eval.MaxMarks || eval.MarksGiven < 0 {
			return nil, ErrInvalidMarks
		}

		evaluation := &models.QuestionEvaluation{
			SessionID:   submission.SessionID,
			QuestionID:  eval.QuestionID,
			MarksGiven:  eval.MarksGiven,
			MaxMarks:    eval.MaxMarks,
			Feedback:    eval.Feedback,
			EvaluatedBy: conductorID,
		}

		if err := s.evalRepo.CreateOrUpdateEvaluation(ctx, evaluation); err != nil {
			return nil, fmt.Errorf("failed to save evaluation for question %d: %w", eval.QuestionID, err)
		}

		totalScore += eval.MarksGiven
		maxScore += eval.MaxMarks
	}

	// Update session evaluation status
	if err := s.evalRepo.UpdateSessionEvaluationStatus(ctx, submission.SessionID, "evaluated", totalScore, maxScore, conductorID); err != nil {
		return nil, fmt.Errorf("failed to update session status: %w", err)
	}

	// Get all evaluations for response
	evaluations, err := s.evalRepo.GetEvaluationsBySessionID(ctx, submission.SessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get evaluations: %w", err)
	}

	percentage := 0.0
	if maxScore > 0 {
		percentage = (totalScore / maxScore) * 100
	}

	return &EvaluationResult{
		SessionID:   submission.SessionID,
		TotalScore:  totalScore,
		MaxScore:    maxScore,
		Percentage:  percentage,
		EvaluatedAt: time.Now(),
		Evaluations: evaluations,
	}, nil
}

func (s *evaluationService) GetEvaluationResult(ctx context.Context, sessionID uint) (*EvaluationResult, error) {
	session, err := s.sessionRepo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	evaluations, err := s.evalRepo.GetEvaluationsBySessionID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get evaluations: %w", err)
	}

	var totalScore, maxScore float64
	if session.TotalScore != nil {
		totalScore = *session.TotalScore
	}
	if session.MaxScore != nil {
		maxScore = *session.MaxScore
	}

	percentage := 0.0
	if maxScore > 0 {
		percentage = (totalScore / maxScore) * 100
	}

	var evaluatedAt time.Time
	if session.EvaluatedAt != nil {
		evaluatedAt = *session.EvaluatedAt
	}

	return &EvaluationResult{
		SessionID:   sessionID,
		TotalScore:  totalScore,
		MaxScore:    maxScore,
		Percentage:  percentage,
		EvaluatedAt: evaluatedAt,
		Evaluations: evaluations,
	}, nil
}

func (s *evaluationService) MarkSessionForManualEvaluation(ctx context.Context, sessionID uint) error {
	session, err := s.sessionRepo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}

	if session.SessionStatus != "COMPLETED" {
		return ErrSessionNotCompleted
	}

	return s.evalRepo.UpdateSessionEvaluationStatus(ctx, sessionID, "pending_evaluation", 0, 0, 0)
}

func (s *evaluationService) GetSessionForNotification(ctx context.Context, sessionID uint) (*SessionNotificationInfo, error) {
	session, err := s.sessionRepo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Fetch survey title from SurveyManagementService
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:5172"
	}

	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d", surveyServiceURL, session.SurveyID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	if key := os.Getenv("INTERNAL_API_KEY"); key != "" {
		req.Header.Set("X-Internal-API-Key", key)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch survey: %w", err)
	}
	defer resp.Body.Close()

	var surveyResp struct {
		Data struct {
			Title     string `json:"title"`
			Questions []struct {
				ID           uint   `json:"id"`
				QuestionText string `json:"question_text"`
			} `json:"questions"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&surveyResp)

	questionMap := make(map[uint]string)
	for _, q := range surveyResp.Data.Questions {
		questionMap[q.ID] = q.QuestionText
	}

	return &SessionNotificationInfo{
		Email:       session.ParticipantEmail,
		SurveyTitle: surveyResp.Data.Title,
		QuestionMap: questionMap,
	}, nil
}
