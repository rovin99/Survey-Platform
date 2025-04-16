package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Repository"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

type AnswerService interface {
	CreateAnswer(ctx context.Context, answer *models.Answer) error
	GetAnswerByID(ctx context.Context, id uint) (*models.Answer, error)
	GetAnswersBySession(ctx context.Context, sessionID uint) ([]models.Answer, error)
	GetAnswersByQuestion(ctx context.Context, questionID uint) ([]models.Answer, error)
	UpdateAnswer(ctx context.Context, answer *models.Answer) error
	DeleteAnswer(ctx context.Context, id uint) error
	SubmitBulkAnswers(ctx context.Context, sessionID uint, answers []models.Answer) error
	ValidateAnswer(ctx context.Context, answer *models.Answer) error
}

type answerService struct {
	answerRepo   repository.AnswerRepository
	questionRepo repository.QuestionRepository
	sessionRepo  repository.SurveySessionRepository
}

func NewAnswerService(answerRepo repository.AnswerRepository, questionRepo repository.QuestionRepository, sessionRepo repository.SurveySessionRepository) AnswerService {
	return &answerService{
		answerRepo:   answerRepo,
		questionRepo: questionRepo,
		sessionRepo:  sessionRepo,
	}
}

func (s *answerService) CreateAnswer(ctx context.Context, answer *models.Answer) error {
	if answer == nil {
		return errors.New("nil answer provided")
	}

	// Validate required fields
	if answer.SessionID == 0 {
		return errors.New("session ID is required")
	}

	if answer.QuestionID == 0 {
		return errors.New("question ID is required")
	}

	// Validate the answer data
	if err := s.ValidateAnswer(ctx, answer); err != nil {
		return err
	}

	answer.CreatedAt = time.Now()
	answer.UpdatedAt = time.Now()

	return s.answerRepo.Create(ctx, answer)
}

func (s *answerService) GetAnswerByID(ctx context.Context, id uint) (*models.Answer, error) {
	if id == 0 {
		return nil, errors.New("invalid answer ID")
	}

	// This needs to be implemented in the repository
	return nil, errors.New("method not implemented")
}

func (s *answerService) GetAnswersBySession(ctx context.Context, sessionID uint) ([]models.Answer, error) {
	if sessionID == 0 {
		return nil, errors.New("invalid session ID")
	}

	return s.answerRepo.GetBySessionID(ctx, sessionID)
}

func (s *answerService) GetAnswersByQuestion(ctx context.Context, questionID uint) ([]models.Answer, error) {
	if questionID == 0 {
		return nil, errors.New("invalid question ID")
	}

	return s.answerRepo.GetByQuestionID(ctx, questionID)
}

func (s *answerService) UpdateAnswer(ctx context.Context, answer *models.Answer) error {
	if answer == nil || answer.AnswerID == 0 {
		return errors.New("invalid answer provided")
	}

	// Validate the answer data
	if err := s.ValidateAnswer(ctx, answer); err != nil {
		return err
	}

	answer.UpdatedAt = time.Now()

	// This needs to be implemented in the repository
	return errors.New("method not implemented")
}

func (s *answerService) DeleteAnswer(ctx context.Context, id uint) error {
	if id == 0 {
		return errors.New("invalid answer ID")
	}

	// This needs to be implemented in the repository
	return errors.New("method not implemented")
}

func (s *answerService) SubmitBulkAnswers(ctx context.Context, sessionID uint, answers []models.Answer) error {
	if sessionID == 0 {
		return errors.New("invalid session ID")
	}

	if answers == nil || len(answers) == 0 {
		return errors.New("no answers provided")
	}

	// Implement transaction for bulk submission
	// This is a placeholder and needs to be implemented
	return errors.New("method not implemented")
}

func (s *answerService) ValidateAnswer(ctx context.Context, answer *models.Answer) error {
	if answer == nil {
		return errors.New("nil answer provided")
	}

	// Check if the question exists
	// This would require a method to get question by ID

	// Validate the response data format based on question type
	// For example, for multiple choice, ensure the selected option exists

	// Validate response data is valid JSON
	var jsonData interface{}
	if err := json.Unmarshal([]byte(answer.ResponseData), &jsonData); err != nil {
		return errors.New("invalid response data format: " + err.Error())
	}

	return nil
}
