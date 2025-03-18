package service

import (
    "context"
    "SurveyManagementService/models"
    "SurveyManagementService/repository"
)

type QuestionTypeService struct {
    questionRepo repository.QuestionRepository
}

type QuestionTypeServiceInterface interface {
    ValidateQuestionType(questionType string) bool
    GetQuestions(ctx context.Context, surveyID uint) ([]models.Question, error)
}

func NewQuestionTypeService(repo repository.QuestionRepository) *QuestionTypeService {
    return &QuestionTypeService{
        questionRepo: repo,
    }
}

func (s *QuestionTypeService) ValidateQuestionType(questionType string) bool {
    validTypes := map[string]bool{
        "TEXT":            true,
        "MULTIPLE_CHOICE": true,
        "SINGLE_CHOICE":   true,
        "RATING":         true,
        "FILE_UPLOAD":    true,
        "VIDEO":          true,
        "AUDIO":          true,
    }
    return validTypes[questionType]
}
func (s *QuestionTypeService) GetQuestions(ctx context.Context, surveyID uint) ([]models.Question, error) {
    return s.questionRepo.GetBySurveyID(ctx, surveyID)
}