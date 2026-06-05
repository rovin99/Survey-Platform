package service

import (
	"context"
	"errors"
	"mime/multipart"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/storage"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

type MediaServiceInterface interface {
	UploadMedia(file *multipart.FileHeader) (string, error)
	GetMediaByQuestion(ctx context.Context, questionID uint) ([]models.SurveyMediaFile, error)
	SaveMedia(media *models.SurveyMediaFile) error
}

type MediaService struct {
	storage   *storage.StorageClient
	mediaRepo models.MediaRepository
}

func NewMediaService(storageClient *storage.StorageClient, mediaRepo models.MediaRepository) MediaServiceInterface {
	return &MediaService{
		storage:   storageClient,
		mediaRepo: mediaRepo,
	}
}

func (s *MediaService) UploadMedia(file *multipart.FileHeader) (string, error) {
	return s.storage.Upload(file)
}

func (s *MediaService) GetMediaByQuestion(ctx context.Context, questionID uint) ([]models.SurveyMediaFile, error) {
	if questionID == 0 {
		return nil, errors.New("invalid question ID")
	}
	return s.mediaRepo.GetByQuestionID(ctx, questionID)
}

func (s *MediaService) SaveMedia(media *models.SurveyMediaFile) error {
	if media == nil {
		return errors.New("media cannot be nil")
	}
	return s.mediaRepo.Create(context.Background(), media)
}
