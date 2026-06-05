package repository

import (
	"context"
	"errors"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"gorm.io/gorm"
)

type SurveyAccessRepository interface {
	Create(ctx context.Context, control *models.SurveyAccessControl) error
	GetByToken(ctx context.Context, token string) (*models.SurveyAccessControl, error)
	GetBySurveyID(ctx context.Context, surveyID uint) (*models.SurveyAccessControl, error)
	Update(ctx context.Context, control *models.SurveyAccessControl) error
	Delete(ctx context.Context, surveyID uint) error
	CreateLog(ctx context.Context, log *models.SurveyAccessLog) error
	GetLogs(ctx context.Context, surveyID uint, limit, offset int) ([]models.SurveyAccessLog, error)
	CountGrantedAccess(ctx context.Context, surveyID uint) (int64, error)
	CountCompletedSessions(ctx context.Context, surveyID uint) (int64, error)
	// Invitation token methods
	GetInvitationByToken(ctx context.Context, token string) (*models.SurveyInvitation, error)
	UpdateInvitation(ctx context.Context, invitation *models.SurveyInvitation) error
	MarkInvitationCompleted(ctx context.Context, surveyID uint, email string) error
}

type surveyAccessRepository struct {
	db *gorm.DB
}

func NewSurveyAccessRepository(db *gorm.DB) SurveyAccessRepository {
	return &surveyAccessRepository{db: db}
}

func (r *surveyAccessRepository) Create(ctx context.Context, control *models.SurveyAccessControl) error {
	return r.db.WithContext(ctx).Create(control).Error
}

func (r *surveyAccessRepository) GetByToken(ctx context.Context, token string) (*models.SurveyAccessControl, error) {
	var control models.SurveyAccessControl
	err := r.db.WithContext(ctx).Where("share_token = ? AND is_active = ?", token, true).First(&control).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("share link not found or inactive")
		}
		return nil, err
	}
	return &control, nil
}

func (r *surveyAccessRepository) GetBySurveyID(ctx context.Context, surveyID uint) (*models.SurveyAccessControl, error) {
	var control models.SurveyAccessControl
	err := r.db.WithContext(ctx).Where("survey_id = ?", surveyID).First(&control).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("sharing not enabled for this survey")
		}
		return nil, err
	}
	return &control, nil
}

func (r *surveyAccessRepository) Update(ctx context.Context, control *models.SurveyAccessControl) error {
	return r.db.WithContext(ctx).Save(control).Error
}

func (r *surveyAccessRepository) Delete(ctx context.Context, surveyID uint) error {
	return r.db.WithContext(ctx).Where("survey_id = ?", surveyID).Delete(&models.SurveyAccessControl{}).Error
}

func (r *surveyAccessRepository) CreateLog(ctx context.Context, log *models.SurveyAccessLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *surveyAccessRepository) GetLogs(ctx context.Context, surveyID uint, limit, offset int) ([]models.SurveyAccessLog, error) {
	var logs []models.SurveyAccessLog
	err := r.db.WithContext(ctx).
		Where("survey_id = ?", surveyID).
		Order("accessed_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error
	return logs, err
}

// GetInvitationByToken retrieves an invitation by its unique token
func (r *surveyAccessRepository) GetInvitationByToken(ctx context.Context, token string) (*models.SurveyInvitation, error) {
	var invitation models.SurveyInvitation
	err := r.db.WithContext(ctx).Where("invitation_token = ?", token).First(&invitation).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invitation not found or invalid")
		}
		return nil, err
	}
	return &invitation, nil
}

// UpdateInvitation updates an invitation record
func (r *surveyAccessRepository) UpdateInvitation(ctx context.Context, invitation *models.SurveyInvitation) error {
	return r.db.WithContext(ctx).Save(invitation).Error
}

// CountGrantedAccess counts unique granted access for a survey (for MaxResponses validation)
// DEPRECATED: Use CountCompletedSessions instead for accurate max_responses limit
func (r *surveyAccessRepository) CountGrantedAccess(ctx context.Context, surveyID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.SurveyAccessLog{}).
		Where("survey_id = ? AND access_granted = ?", surveyID, true).
		Count(&count).Error
	return count, err
}

// CountCompletedSessions counts actual completed survey submissions for max_responses validation.
// This queries the survey_sessions table for sessions with status 'COMPLETED'.
func (r *surveyAccessRepository) CountCompletedSessions(ctx context.Context, surveyID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("survey_sessions").
		Where("survey_id = ? AND session_status = ?", surveyID, "COMPLETED").
		Count(&count).Error
	return count, err
}

// MarkInvitationCompleted marks an invitation as completed by email
func (r *surveyAccessRepository) MarkInvitationCompleted(ctx context.Context, surveyID uint, email string) error {
	return r.db.WithContext(ctx).
		Model(&models.SurveyInvitation{}).
		Where("survey_id = ? AND email = ? AND status != ?", surveyID, email, "COMPLETED").
		Updates(map[string]interface{}{
			"status":       "COMPLETED",
			"completed_at": gorm.Expr("NOW()"),
		}).Error
}
