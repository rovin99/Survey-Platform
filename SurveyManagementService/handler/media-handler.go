package handler

import (
	"mime/multipart"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"SurveyManagementService/models"
	"SurveyManagementService/utils/response"
)

type MediaHandler struct {
	mediaService MediaServiceInterface
}

type MediaServiceInterface interface {
	UploadMedia(file *multipart.FileHeader) (string, error)
	SaveMedia(media *models.SurveyMediaFile) error
}

func NewMediaHandler(mediaService MediaServiceInterface) *MediaHandler {
	return &MediaHandler{
		mediaService: mediaService,
	}
}

// getFileType determines the file type based on content type
func getFileType(contentType string) string {
	switch {
	case contentType == "image/jpeg" || contentType == "image/png" || contentType == "image/gif":
		return "IMAGE"
	case contentType == "video/mp4" || contentType == "video/mpeg" || contentType == "video/quicktime":
		return "VIDEO"
	case contentType == "audio/mpeg" || contentType == "audio/wav" || contentType == "audio/ogg":
		return "AUDIO"
	default:
		return "DOCUMENT"
	}
}

// handler/media_handler.go
func (h *MediaHandler) UploadMedia(c *fiber.Ctx) error {
	// Get file from request
	file, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "Invalid file")
	}

	// Get draft ID if available
	draftID := c.FormValue("draftId")

	// Upload to S3
	fileURL, err := h.mediaService.UploadMedia(file)
	if err != nil {
		return response.InternalServerError(c, "Failed to upload file")
	}

	// Create media record
	media := &models.SurveyMediaFile{
		FileURL:   fileURL,
		FileType:  getFileType(file.Header.Get("Content-Type")),
		CreatedAt: time.Now(),
	}

	if draftID != "" {
		// Parse draft ID if needed
		draftIDUint, err := strconv.ParseUint(draftID, 10, 32)
		if err == nil {
			// Associate with draft
			media.SurveyID = uint(draftIDUint)
		}
	}

	// Save media record
	if err := h.mediaService.SaveMedia(media); err != nil {
		return response.InternalServerError(c, "Failed to save media record")
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"mediaId":  media.MediaID,
		"fileUrl":  media.FileURL,
		"fileType": media.FileType,
	})
}
