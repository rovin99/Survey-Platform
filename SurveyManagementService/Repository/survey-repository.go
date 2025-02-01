package repository

import (
	"context"
	"gorm.io/gorm"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	
)

type SurveyRepository interface {
	Create(ctx context.Context, survey *models.Survey) error
	GetByID(ctx context.Context, id uint) (*models.Survey, error)
	Update(ctx context.Context, survey *models.Survey) error
	Delete(ctx context.Context, id uint) error
	List(ctx context.Context, conductorID uint) ([]models.Survey, error)
}

type surveyRepository struct {
	db *gorm.DB
}

func NewSurveyRepository(db *gorm.DB) SurveyRepository {
	return &surveyRepository{db: db}
}

func (r *surveyRepository) Create(ctx context.Context, survey *models.Survey) error {
	return r.db.WithContext(ctx).Create(survey).Error
}

func (r *surveyRepository) GetByID(ctx context.Context, id uint) (*models.Survey, error) {
	var survey models.Survey
	err := r.db.WithContext(ctx).Preload("Questions").First(&survey, id).Error
	return &survey, err
}

func (r *surveyRepository) Update(ctx context.Context, survey *models.Survey) error {
	return r.db.WithContext(ctx).Save(survey).Error
}

func (r *surveyRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Survey{}, id).Error
}

func (r *surveyRepository) List(ctx context.Context, conductorID uint) ([]models.Survey, error) {
	var surveys []models.Survey
	err := r.db.WithContext(ctx).Where("conductor_id = ?", conductorID).Find(&surveys).Error
	return surveys, err
}
