package storage

import (
	"context"
	"fmt"
	"log"
	"mime/multipart"
	"strings"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const maxImageSize = 5 * 1024 * 1024 // 5MB

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

type StorageClient struct {
	client *minio.Client
	bucket string
}

func NewStorageClient(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*StorageClient, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	// Ensure bucket exists
	ctx := context.Background()
	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}
		log.Printf("[INFO] Created MinIO bucket: %s", bucket)
	}

	log.Printf("[INFO] MinIO storage connected: endpoint=%s bucket=%s ssl=%v", endpoint, bucket, useSSL)
	return &StorageClient{client: client, bucket: bucket}, nil
}

// Upload validates and uploads a file to MinIO, returning the relative URL path.
// The returned path is in the format "/uploads/{uuid}.{ext}" for nginx proxy compatibility.
func (s *StorageClient) Upload(file *multipart.FileHeader) (string, error) {
	if file.Size > maxImageSize {
		return "", fmt.Errorf("file too large: %d bytes (max %d bytes)", file.Size, maxImageSize)
	}

	contentType := file.Header.Get("Content-Type")
	ext, ok := allowedImageTypes[strings.ToLower(contentType)]
	if !ok {
		return "", fmt.Errorf("unsupported file type: %s (allowed: JPEG, PNG, GIF, WebP)", contentType)
	}

	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer src.Close()

	objectName := uuid.New().String() + ext

	_, err = s.client.PutObject(context.Background(), s.bucket, objectName, src, file.Size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload to MinIO: %w", err)
	}

	// Return path compatible with nginx proxy: /uploads/uuid.ext
	// Nginx rewrites this to MinIO: /uploads/uuid.ext → minio:9000/survey-uploads/uuid.ext
	fileURL := "/uploads/" + objectName
	return fileURL, nil
}
