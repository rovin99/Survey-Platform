package service

import (
    "context"
    "errors"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/models"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
)

type AnswerService struct {
    answerRepo repository.AnswerRepository
}

func NewAnswerService(repo repository.AnswerRepository) *AnswerService {
    return &AnswerService{
        answerRepo: repo,
    }
}

func (s *AnswerService) CreateAnswer(ctx context.Context, answer *models.Answer) error {
    if answer == nil {
        return errors.New("nil answer provided")
    }
    return s.answerRepo.Create(ctx, answer)
}

func (s *AnswerService) GetAnswersBySession(ctx context.Context, sessionID uint) ([]models.Answer, error) {
    if sessionID == 0 {
        return nil, errors.New("invalid session ID")
    }
    return s.answerRepo.GetBySessionID(ctx, sessionID)
}

func (s *AnswerService) GetAnswersByQuestion(ctx context.Context, questionID uint) ([]models.Answer, error) {
    if questionID == 0 {
        return nil, errors.New("invalid question ID")
    }
    return s.answerRepo.GetByQuestionID(ctx, questionID)
}
