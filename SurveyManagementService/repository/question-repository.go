package repository

import (
	"context"
	"gorm.io/gorm"
	"SurveyManagementService/models"
)

type QuestionRepository interface {
	Create(ctx context.Context, question *models.Question) error
	GetBySurveyID(ctx context.Context, surveyID uint) ([]models.Question, error)
	Update(ctx context.Context, question *models.Question) error
	Delete(ctx context.Context, id uint) error
}

type questionRepository struct {
	db *gorm.DB
}

func NewQuestionRepository(db *gorm.DB) QuestionRepository {
	return &questionRepository{db: db}
}

func (r *questionRepository) Create(ctx context.Context, question *models.Question) error {
	return r.db.WithContext(ctx).Create(question).Error
}

func (r *questionRepository) GetBySurveyID(ctx context.Context, surveyID uint) ([]models.Question, error) {
	var questions []models.Question
	err := r.db.WithContext(ctx).Where("survey_id = ?", surveyID).Order("order_index").Find(&questions).Error
	return questions, err
}

func (r *questionRepository) Update(ctx context.Context, question *models.Question) error {
	return r.db.WithContext(ctx).Save(question).Error
}

func (r *questionRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Question{}, id).Error
}
