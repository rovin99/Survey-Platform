package repository

import (
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"gorm.io/gorm"
)

type QuestionRepository struct {
	db *gorm.DB
}

func NewQuestionRepository(db *gorm.DB) *QuestionRepository {
	return &QuestionRepository{db: db}
}

func (r *QuestionRepository) Create(question *models.Question) error {
	return r.db.Create(question).Error
}

func (r *QuestionRepository) GetBySurveyID(surveyID uint) ([]models.Question, error) {
	var questions []models.Question
	err := r.db.Where("survey_id = ?", surveyID).Find(&questions).Error
	return questions, err
}

func (r *QuestionRepository) GetByID(questionID uint) (*models.Question, error) {
	var question models.Question
	err := r.db.First(&question, questionID).Error
	return &question, err
}

func (r *QuestionRepository) Update(question *models.Question) error {
	return r.db.Save(question).Error
}

func (r *QuestionRepository) Delete(questionID uint) error {
	return r.db.Delete(&models.Question{}, questionID).Error
}
