package repository

import (
	"context"
	"gorm.io/gorm"
	"SurveyManagementService/models"
)

type SurveySessionRepository interface {
	Create(ctx context.Context, session *models.SurveySession) error
	GetByID(ctx context.Context, id uint) (*models.SurveySession, error)
	UpdateStatus(ctx context.Context, id uint, status string) error
	UpdateLastQuestion(ctx context.Context, id uint, questionID uint) error
}

type surveySessionRepository struct {
	db *gorm.DB
}

func NewSurveySessionRepository(db *gorm.DB) SurveySessionRepository {
	return &surveySessionRepository{db: db}
}

func (r *surveySessionRepository) Create(ctx context.Context, session *models.SurveySession) error {
	return r.db.WithContext(ctx).Create(session).Error
}

func (r *surveySessionRepository) GetByID(ctx context.Context, id uint) (*models.SurveySession, error) {
	var session models.SurveySession
	err := r.db.WithContext(ctx).First(&session, id).Error
	return &session, err
}

func (r *surveySessionRepository) UpdateStatus(ctx context.Context, id uint, status string) error {
	return r.db.WithContext(ctx).Model(&models.SurveySession{}).Where("id = ?", id).Update("status", status).Error
}

func (r *surveySessionRepository) UpdateLastQuestion(ctx context.Context, id uint, questionID uint) error {
	return r.db.WithContext(ctx).Model(&models.SurveySession{}).Where("id = ?", id).Update("last_question_id", questionID).Error
}
