package handler

import (
	"log"
	"mime/multipart"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
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

func (h *MediaHandler) UploadMedia(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "No file provided",
		})
	}

	log.Printf("[INFO] Media upload: filename=%s size=%d type=%s", file.Filename, file.Size, file.Header.Get("Content-Type"))

	fileURL, err := h.mediaService.UploadMedia(file)
	if err != nil {
		log.Printf("[ERROR] Media upload failed: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	media := &models.SurveyMediaFile{
		FileURL:   fileURL,
		FileType:  "IMAGE",
		CreatedAt: time.Now(),
	}

	draftID := c.FormValue("draftId")
	if draftID != "" {
		if draftIDUint, err := strconv.ParseUint(draftID, 10, 32); err == nil {
			media.SurveyID = uint(draftIDUint)
		}
	}

	if err := h.mediaService.SaveMedia(media); err != nil {
		log.Printf("[ERROR] Failed to save media record: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Failed to save media record",
		})
	}

	log.Printf("[SUCCESS] Media uploaded: id=%d url=%s", media.MediaID, media.FileURL)
	return c.JSON(fiber.Map{
		"success":  true,
		"mediaId":  media.MediaID,
		"fileUrl":  media.FileURL,
		"fileType": media.FileType,
	})
}
