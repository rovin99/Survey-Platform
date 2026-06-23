package service

import (
	"mime/multipart"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/utils/storage"
)

type MediaService struct {
	storage *storage.StorageClient
}

func NewMediaService(storageClient *storage.StorageClient) *MediaService {
	return &MediaService{storage: storageClient}
}

func (s *MediaService) UploadMedia(file *multipart.FileHeader) (string, error) {
	return s.storage.Upload(file)
}
