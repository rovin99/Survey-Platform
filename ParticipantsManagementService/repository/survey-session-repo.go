package repository

import (
	"context"
	"errors"
	"time"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrSessionNotFound = errors.New("session not found")
var ErrDraftNotFound = errors.New("draft not found")

type ParticipantRepository interface {
	// Finds an IN_PROGRESS session or creates a new one. Returns the session.
	FindOrCreateSession(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error)
	// Gets session details.
	GetSessionByID(ctx context.Context, sessionID uint) (*models.SurveySession, error)
	GetSessionBySurveyParticipant(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error) // Useful if sessionID isn't known upfront
	// Updates session status and potentially the last question ID.
	UpdateSession(ctx context.Context, session *models.SurveySession) error
	// Retrieves the draft associated with a session. Creates an empty one if not found.
	FindOrCreateDraft(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error)
	// Updates the draft content and last saved timestamp.
	UpdateDraft(ctx context.Context, sessionID uint, lastQuestionID *uint, draftContent datatypes.JSON) error
	// Retrieves draft content only.
	GetDraftBySessionID(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error)
	// Deletes the draft for a session (used after submission).
	DeleteDraft(ctx context.Context, sessionID uint) error
	// Saves the final answers batch.
	CreateAnswersBatch(ctx context.Context, answers []models.Answer) error
	// GetDB returns the underlying gorm.DB instance
	GetDB() *gorm.DB
}

type gormParticipantRepository struct {
	db *gorm.DB
}

// GetDB returns the underlying gorm.DB instance
func (r *gormParticipantRepository) GetDB() *gorm.DB {
	return r.db
}

func NewGormParticipantRepository(db *gorm.DB) ParticipantRepository {
	// Auto-migrate if needed (consider running migrations separately)
	// db.AutoMigrate(&models.SurveySession{}, &models.ParticipantSurveyDraft{}, &models.Answer{})
	return &gormParticipantRepository{db: db}
}

func (r *gormParticipantRepository) FindOrCreateSession(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error) {
	var session models.SurveySession

	// Try to find an existing active session
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND participant_id = ? AND session_status = ?", surveyID, participantID, "IN_PROGRESS").
		First(&session).Error

	if err == nil {
		// Found existing session
		return &session, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Other database error
		return nil, err
	}

	// Not found, create a new one
	newSession := models.SurveySession{
		SurveyID:      surveyID,
		ParticipantID: participantID,
		SessionStatus: "IN_PROGRESS", // Start as IN_PROGRESS
		// LastQuestionID will be null initially
	}

	err = r.db.WithContext(ctx).Create(&newSession).Error
	if err != nil {
		return nil, err
	}
	return &newSession, nil
}

func (r *gormParticipantRepository) GetSessionByID(ctx context.Context, sessionID uint) (*models.SurveySession, error) {
	var session models.SurveySession
	err := r.db.WithContext(ctx).First(&session, sessionID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSessionNotFound
	}
	return &session, err
}

func (r *gormParticipantRepository) GetSessionBySurveyParticipant(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error) {
	var session models.SurveySession
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND participant_id = ? AND session_status = ?", surveyID, participantID, "IN_PROGRESS"). // Maybe filter by status?
		First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSessionNotFound
	}
	return &session, err
}

func (r *gormParticipantRepository) UpdateSession(ctx context.Context, session *models.SurveySession) error {
	return r.db.WithContext(ctx).Save(session).Error // Save updates all fields
}

func (r *gormParticipantRepository) FindOrCreateDraft(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error) {
	var draft models.ParticipantSurveyDraft

	// Use FirstOrCreate: Finds first record matching attributes, or create a new one if not found.
	// Important: Provide default values for creation.
	err := r.db.WithContext(ctx).
		Where(models.ParticipantSurveyDraft{SessionID: sessionID}).
		Assign(models.ParticipantSurveyDraft{LastSaved: time.Now()}). // Assign values only on create/update
		FirstOrCreate(&draft).Error

	return &draft, err
}

func (r *gormParticipantRepository) UpdateDraft(ctx context.Context, sessionID uint, lastQuestionID *uint, draftContent datatypes.JSON) error {
	// Upsert logic: Insert if not exists, update if exists based on session_id (unique index)
	draft := models.ParticipantSurveyDraft{
		SessionID:              sessionID,
		LastAnsweredQuestionID: lastQuestionID,
		DraftAnswersContent:    draftContent,
		LastSaved:              time.Now(),
	}

	// Use Clauses(clause.OnConflict...) for upsert based on the unique constraint on session_id
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "session_id"}},                                                                                // conflict target
		DoUpdates: clause.AssignmentColumns([]string{"last_answered_question_id", "draft_answers_content", "last_saved", "updated_at"}), // columns to update
	}).Create(&draft).Error
}

func (r *gormParticipantRepository) GetDraftBySessionID(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error) {
	var draft models.ParticipantSurveyDraft
	err := r.db.WithContext(ctx).Where("session_id = ?", sessionID).First(&draft).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// It's okay if a draft doesn't exist yet, return nil draft without error
		return nil, nil
	}
	return &draft, err
}

func (r *gormParticipantRepository) DeleteDraft(ctx context.Context, sessionID uint) error {
	result := r.db.WithContext(ctx).Where("session_id = ?", sessionID).Delete(&models.ParticipantSurveyDraft{})
	if result.Error != nil {
		return result.Error
	}
	// GORM returns RowsAffected=0 if no record found, which isn't necessarily an error here.
	// if result.RowsAffected == 0 {
	// 	 return ErrDraftNotFound // Decide if this is an error condition
	// }
	return nil
}

func (r *gormParticipantRepository) CreateAnswersBatch(ctx context.Context, answers []models.Answer) error {
	if len(answers) == 0 {
		return nil // Nothing to insert
	}
	return r.db.WithContext(ctx).Create(&answers).Error
}
