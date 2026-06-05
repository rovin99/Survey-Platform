package repository

import (
	"context"
	"errors"
	"time"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/models"
	"gorm.io/gorm"
)

var ErrEvaluationNotFound = errors.New("evaluation not found")

// EvaluationRepository defines the interface for evaluation operations
type EvaluationRepository interface {
	// CreateOrUpdateEvaluation creates or updates an evaluation for a question in a session
	CreateOrUpdateEvaluation(ctx context.Context, eval *models.QuestionEvaluation) error
	// GetEvaluationsBySessionID gets all evaluations for a session
	GetEvaluationsBySessionID(ctx context.Context, sessionID uint) ([]models.QuestionEvaluation, error)
	// GetEvaluation gets a specific evaluation by session and question
	GetEvaluation(ctx context.Context, sessionID, questionID uint) (*models.QuestionEvaluation, error)
	// DeleteEvaluationsBySessionID deletes all evaluations for a session
	DeleteEvaluationsBySessionID(ctx context.Context, sessionID uint) error
	// GetPendingEvaluationSessions gets all sessions pending evaluation for a survey
	GetPendingEvaluationSessions(ctx context.Context, surveyID uint) ([]models.SurveySession, error)
	// UpdateSessionEvaluationStatus updates the evaluation status of a session
	UpdateSessionEvaluationStatus(ctx context.Context, sessionID uint, status string, totalScore, maxScore float64, evaluatedBy uint) error
	// GetEvaluatedSessions gets all evaluated sessions for a survey
	GetEvaluatedSessions(ctx context.Context, surveyID uint) ([]models.SurveySession, error)
}

type gormEvaluationRepository struct {
	db *gorm.DB
}

// NewEvaluationRepository creates a new evaluation repository
func NewEvaluationRepository(db *gorm.DB) EvaluationRepository {
	return &gormEvaluationRepository{db: db}
}

func (r *gormEvaluationRepository) CreateOrUpdateEvaluation(ctx context.Context, eval *models.QuestionEvaluation) error {
	// Use upsert - if evaluation exists for session+question, update it; otherwise create
	result := r.db.WithContext(ctx).
		Where("session_id = ? AND question_id = ?", eval.SessionID, eval.QuestionID).
		Assign(models.QuestionEvaluation{
			MarksGiven:  eval.MarksGiven,
			MaxMarks:    eval.MaxMarks,
			Feedback:    eval.Feedback,
			EvaluatedBy: eval.EvaluatedBy,
			UpdatedAt:   time.Now(),
		}).
		FirstOrCreate(eval)

	return result.Error
}

func (r *gormEvaluationRepository) GetEvaluationsBySessionID(ctx context.Context, sessionID uint) ([]models.QuestionEvaluation, error) {
	var evaluations []models.QuestionEvaluation
	err := r.db.WithContext(ctx).
		Where("session_id = ?", sessionID).
		Order("question_id ASC").
		Find(&evaluations).Error

	return evaluations, err
}

func (r *gormEvaluationRepository) GetEvaluation(ctx context.Context, sessionID, questionID uint) (*models.QuestionEvaluation, error) {
	var eval models.QuestionEvaluation
	err := r.db.WithContext(ctx).
		Where("session_id = ? AND question_id = ?", sessionID, questionID).
		First(&eval).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrEvaluationNotFound
	}
	return &eval, err
}

func (r *gormEvaluationRepository) DeleteEvaluationsBySessionID(ctx context.Context, sessionID uint) error {
	return r.db.WithContext(ctx).
		Where("session_id = ?", sessionID).
		Delete(&models.QuestionEvaluation{}).Error
}

func (r *gormEvaluationRepository) GetPendingEvaluationSessions(ctx context.Context, surveyID uint) ([]models.SurveySession, error) {
	var sessions []models.SurveySession
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND session_status = ? AND evaluation_status = ?",
			surveyID, "COMPLETED", "pending_evaluation").
		Order("created_at ASC").
		Find(&sessions).Error

	return sessions, err
}

func (r *gormEvaluationRepository) UpdateSessionEvaluationStatus(ctx context.Context, sessionID uint, status string, totalScore, maxScore float64, evaluatedBy uint) error {
	// Use raw SQL to avoid GORM's autoUpdateTime modifying updated_at
	// updated_at should only reflect when the PARTICIPANT last acted (submission time)
	if status == "evaluated" {
		return r.db.WithContext(ctx).Exec(
			"UPDATE survey_sessions SET evaluation_status = ?, total_score = ?, max_score = ?, evaluated_at = ?, evaluated_by = ? WHERE session_id = ?",
			status, totalScore, maxScore, time.Now(), evaluatedBy, sessionID,
		).Error
	}
	return r.db.WithContext(ctx).Exec(
		"UPDATE survey_sessions SET evaluation_status = ?, total_score = ?, max_score = ? WHERE session_id = ?",
		status, totalScore, maxScore, sessionID,
	).Error
}

func (r *gormEvaluationRepository) GetEvaluatedSessions(ctx context.Context, surveyID uint) ([]models.SurveySession, error) {
	var sessions []models.SurveySession
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND evaluation_status = ?", surveyID, "evaluated").
		Order("evaluated_at DESC").
		Find(&sessions).Error

	return sessions, err
}
