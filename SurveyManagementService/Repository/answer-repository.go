package repository

import (
	"context"
	"gorm.io/gorm"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

type AnswerRepository interface {
	Create(ctx context.Context, answer *models.Answer) error
	GetBySessionID(ctx context.Context, sessionID uint) ([]models.Answer, error)
	GetByQuestionID(ctx context.Context, questionID uint) ([]models.Answer, error)
}

type answerRepository struct {
	db *gorm.DB
}

func NewAnswerRepository(db *gorm.DB) AnswerRepository {
	return &answerRepository{db: db}
}

func (r *answerRepository) Create(ctx context.Context, answer *models.Answer) error {
	return r.db.WithContext(ctx).Create(answer).Error
}

func (r *answerRepository) GetBySessionID(ctx context.Context, sessionID uint) ([]models.Answer, error) {
	var answers []models.Answer
	err := r.db.WithContext(ctx).Where("session_id = ?", sessionID).Find(&answers).Error
	return answers, err
}

func (r *answerRepository) GetByQuestionID(ctx context.Context, questionID uint) ([]models.Answer, error) {
	var answers []models.Answer
	err := r.db.WithContext(ctx).Where("question_id = ?", questionID).Find(&answers).Error
	return answers, err
}
