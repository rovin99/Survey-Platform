package service

import (
    
    "github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
)

type QuestionTypeService struct {
    questionRepo repository.QuestionRepository
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