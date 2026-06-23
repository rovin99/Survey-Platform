package handler

import (
	"log"

	"github.com/gofiber/fiber/v2"
	service "github.com/rovin99/Survey-Platform/ParticipantsManagementService/services"
)

type MediaHandler struct {
	mediaService *service.MediaService
}

func NewMediaHandler(mediaService *service.MediaService) *MediaHandler {
	return &MediaHandler{mediaService: mediaService}
}

func (h *MediaHandler) HandleUploadMedia(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "No file provided",
		})
	}

	log.Printf("[INFO] Participant media upload: filename=%s size=%d type=%s", file.Filename, file.Size, file.Header.Get("Content-Type"))

	fileURL, err := h.mediaService.UploadMedia(file)
	if err != nil {
		log.Printf("[ERROR] Participant media upload failed: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	log.Printf("[SUCCESS] Participant media uploaded: url=%s", fileURL)
	return c.JSON(fiber.Map{
		"success": true,
		"fileUrl": fileURL,
	})
}
