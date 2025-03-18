package service

import (
	"context"
	"errors"

	"fmt"
	"mime/multipart"
	"path/filepath"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/google/uuid"
	"SurveyManagementService/models"
)

type MediaServiceInterface interface {
	UploadMedia(file *multipart.FileHeader) (string, error)
	GetMediaByQuestion(ctx context.Context, questionID uint) ([]models.SurveyMediaFile, error)
	SaveMedia(media *models.SurveyMediaFile) error
}

// service/media_service.go
type MediaService struct {
	s3Client   *s3.S3
	bucketName string
	mediaRepo  models.MediaRepository
}

// NewMediaService creates a new media service instance
func NewMediaService(s3Client *s3.S3, bucketName string, mediaRepo models.MediaRepository) MediaServiceInterface {
	return &MediaService{
		s3Client:   s3Client,
		bucketName: bucketName,
		mediaRepo:  mediaRepo,
	}
}

func (s *MediaService) UploadToS3(file *multipart.FileHeader) (string, error) {
	// Open file
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	// Generate unique key
	fileExt := filepath.Ext(file.Filename)
	objectKey := fmt.Sprintf("surveys/media/%s%s", uuid.New().String(), fileExt)

	// Upload to S3
	_, err = s.s3Client.PutObject(&s3.PutObjectInput{
		Bucket:      aws.String(s.bucketName),
		Key:         aws.String(objectKey),
		Body:        src,
		ContentType: aws.String(file.Header.Get("Content-Type")),
	})

	if err != nil {
		return "", err
	}

	// Generate URL
	fileURL := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", s.bucketName, objectKey)
	return fileURL, nil
}

// UploadMedia uploads a file and stores its metadata
func (s *MediaService) UploadMedia(file *multipart.FileHeader) (string, error) {
	// Upload to S3 and get the URL
	fileURL, err := s.UploadToS3(file)
	if err != nil {
		return "", err
	}

	// Here you would typically save the media file info to your database
	// This would require information about which survey/question/session this media belongs to
	// For now, we'll just return the URL

	return fileURL, nil
}

func (s *MediaService) GetMediaByQuestion(ctx context.Context, questionID uint) ([]models.SurveyMediaFile, error) {
	if questionID == 0 {
		return nil, errors.New("invalid question ID")
	}
	return s.mediaRepo.GetByQuestionID(ctx, questionID)
}

// SaveMedia saves a media file record to the database
func (s *MediaService) SaveMedia(media *models.SurveyMediaFile) error {
	if media == nil {
		return errors.New("media cannot be nil")
	}

	// We need a context for the repository operation
	ctx := context.Background()

	return s.mediaRepo.Create(ctx, media)
}
