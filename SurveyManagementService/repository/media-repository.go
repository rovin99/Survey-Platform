package repository

import (
	"context"
	"gorm.io/gorm"
	"SurveyManagementService/models"
)

type SurveyMediaRepository interface {
	Create(ctx context.Context, media *models.SurveyMediaFile) error
	GetBySessionID(ctx context.Context, sessionID uint) ([]models.SurveyMediaFile, error)
	GetByQuestionID(ctx context.Context, questionID uint) ([]models.SurveyMediaFile, error)
}

type surveyMediaRepository struct {
	db *gorm.DB
}

func NewSurveyMediaRepository(db *gorm.DB) SurveyMediaRepository {
	return &surveyMediaRepository{db: db}
}

func (r *surveyMediaRepository) Create(ctx context.Context, media *models.SurveyMediaFile) error {
	return r.db.WithContext(ctx).Create(media).Error
}

func (r *surveyMediaRepository) GetBySessionID(ctx context.Context, sessionID uint) ([]models.SurveyMediaFile, error) {
	var mediaFiles []models.SurveyMediaFile
	err := r.db.WithContext(ctx).Where("session_id = ?", sessionID).Find(&mediaFiles).Error
	return mediaFiles, err
}

func (r *surveyMediaRepository) GetByQuestionID(ctx context.Context, questionID uint) ([]models.SurveyMediaFile, error) {
	var mediaFiles []models.SurveyMediaFile
	err := r.db.WithContext(ctx).Where("question_id = ?", questionID).Find(&mediaFiles).Error
	return mediaFiles, err
}
