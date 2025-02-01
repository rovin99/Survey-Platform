package service

import (
	"context"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
)

type SurveyService struct {
	surveyRepo   repository.SurveyRepository
	questionRepo repository.QuestionRepository
}

func NewSurveyService(sr repository.SurveyRepository, qr repository.QuestionRepository) *SurveyService {
	return &SurveyService{
		surveyRepo:   sr,
		questionRepo: qr,
	}
}

// Create a new survey
func (s *SurveyService) CreateSurvey(ctx context.Context, survey *models.Survey) error {
	return s.surveyRepo.Create(ctx, survey)
}

// Get a survey by ID
func (s *SurveyService) GetSurvey(ctx context.Context, id uint) (*models.Survey, error) {
	return s.surveyRepo.GetByID(ctx, id)
}

// List surveys for a specific conductor
func (s *SurveyService) ListSurveys(ctx context.Context, conductorID uint) ([]models.Survey, error) {
	return s.surveyRepo.List(ctx, conductorID)
}

// Update an existing survey
func (s *SurveyService) UpdateSurvey(ctx context.Context, survey *models.Survey) error {
	return s.surveyRepo.Update(ctx, survey)
}

// Delete a survey
func (s *SurveyService) DeleteSurvey(ctx context.Context, id uint) error {
	return s.surveyRepo.Delete(ctx, id)
}

// Add a question to a survey
func (s *SurveyService) AddQuestion(ctx context.Context, question *models.Question) error {
	return s.questionRepo.Create(ctx, question)
}

// Get questions for a survey
func (s *SurveyService) GetQuestions(ctx context.Context, surveyID uint) ([]models.Question, error) {
	return s.questionRepo.GetBySurveyID(ctx, surveyID)
}

// Update an existing question
func (s *SurveyService) UpdateQuestion(ctx context.Context, question *models.Question) error {
	return s.questionRepo.Update(ctx, question)
}

// Delete a question
func (s *SurveyService) DeleteQuestion(ctx context.Context, id uint) error {
	return s.questionRepo.Delete(ctx, id)
}
