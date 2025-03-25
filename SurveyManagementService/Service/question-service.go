package service

import (
	"context"
	"errors"
	"time"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
	"gorm.io/gorm"
)

type QuestionService interface {
	CreateQuestion(ctx context.Context, question *models.Question) error
	GetQuestionByID(ctx context.Context, id uint) (*models.Question, error)
	GetQuestionsBySurveyID(ctx context.Context, surveyID uint) ([]models.Question, error)
	UpdateQuestion(ctx context.Context, question *models.Question) error
	DeleteQuestion(ctx context.Context, id uint) error
	ValidateQuestionType(questionType string) bool
	CreateQuestionWithOptions(ctx context.Context, question *models.Question, options []models.Option) error
}

type questionService struct {
	questionRepo repository.QuestionRepository
	optionRepo   repository.OptionRepository
	surveyRepo   repository.SurveyRepository
}

func NewQuestionService(questionRepo repository.QuestionRepository, optionRepo repository.OptionRepository, surveyRepo repository.SurveyRepository) QuestionService {
	return &questionService{
		questionRepo: questionRepo,
		optionRepo:   optionRepo,
		surveyRepo:   surveyRepo,
	}
}

func (s *questionService) CreateQuestion(ctx context.Context, question *models.Question) error {
	if question == nil {
		return errors.New("nil question provided")
	}

	if !s.ValidateQuestionType(question.QuestionType) {
		return errors.New("invalid question type")
	}

	question.CreatedAt = time.Now()
	question.UpdatedAt = time.Now()

	return s.questionRepo.Create(ctx, question)
}

func (s *questionService) GetQuestionByID(ctx context.Context, id uint) (*models.Question, error) {
	if id == 0 {
		return nil, errors.New("invalid question ID")
	}

	return nil, errors.New("not implemented")
}

func (s *questionService) GetQuestionsBySurveyID(ctx context.Context, surveyID uint) ([]models.Question, error) {
	if surveyID == 0 {
		return nil, errors.New("invalid survey ID")
	}

	return s.questionRepo.GetBySurveyID(ctx, surveyID)
}

func (s *questionService) UpdateQuestion(ctx context.Context, question *models.Question) error {
	if question == nil || question.QuestionID == 0 {
		return errors.New("invalid question provided")
	}

	if !s.ValidateQuestionType(question.QuestionType) {
		return errors.New("invalid question type")
	}

	question.UpdatedAt = time.Now()

	return s.questionRepo.Update(ctx, question)
}

func (s *questionService) DeleteQuestion(ctx context.Context, id uint) error {
	if id == 0 {
		return errors.New("invalid question ID")
	}

	return s.questionRepo.Delete(ctx, id)
}

func (s *questionService) ValidateQuestionType(questionType string) bool {
	validTypes := map[string]bool{
		"TEXT":            true,
		"MULTIPLE_CHOICE": true,
		"SINGLE_CHOICE":   true,
		"RATING":          true,
		"FILE_UPLOAD":     true,
		"VIDEO":           true,
		"AUDIO":           true,
	}
	return validTypes[questionType]
}

func (s *questionService) CreateQuestionWithOptions(ctx context.Context, question *models.Question, options []models.Option) error {
	if question == nil {
		return errors.New("nil question provided")
	}

	if !s.ValidateQuestionType(question.QuestionType) {
		return errors.New("invalid question type")
	}

	// Check if we need options
	needsOptions := question.QuestionType == "MULTIPLE_CHOICE" || question.QuestionType == "SINGLE_CHOICE"
	if needsOptions && (options == nil || len(options) == 0) {
		return errors.New("options required for this question type")
	}

	// Use a transaction to ensure atomicity
	return s.surveyRepo.Transaction(ctx, func(tx *gorm.DB) error {
		// Set timestamps
		now := time.Now()
		question.CreatedAt = now
		question.UpdatedAt = now

		// Create the question
		if err := tx.Create(question).Error; err != nil {
			return err
		}

		// Create options if needed
		if needsOptions && len(options) > 0 {
			for i := range options {
				options[i].QuestionID = question.QuestionID
				options[i].CreatedAt = now
				options[i].UpdatedAt = now
			}

			if err := tx.CreateInBatches(options, len(options)).Error; err != nil {
				return err
			}
		}

		return nil
	})
}
