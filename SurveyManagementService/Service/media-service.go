package service

import (
    "context"
    "errors"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/models"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
)

type MediaService struct {
    mediaRepo repository.SurveyMediaRepository
}

func NewMediaService(repo repository.SurveyMediaRepository) *MediaService {
    return &MediaService{
        mediaRepo: repo,
    }
}

func (s *MediaService) AddMedia(ctx context.Context, media *models.SurveyMediaFile) error {
    if media == nil {
        return errors.New("nil media provided")
    }
    return s.mediaRepo.Create(ctx, media)
}

func (s *MediaService) GetMediaByQuestion(ctx context.Context, questionID uint) ([]models.SurveyMediaFile, error) {
    if questionID == 0 {
        return nil, errors.New("invalid question ID")
    }
    return s.mediaRepo.GetByQuestionID(ctx, questionID)
}
