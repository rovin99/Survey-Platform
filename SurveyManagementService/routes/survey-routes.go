package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

func SetupSurveyRoutes(router fiber.Router, h *handler.SurveyHandler) {
	survey := router.Group("/surveys")
	survey.Post("/:id/publish", h.PublishSurvey)
	survey.Get("/:id/progress", h.GetProgress)
	survey.Get("/:id", h.GetSurvey)
}

// SetupDraftRoutes registers routes for draft management
func SetupDraftRoutes(router fiber.Router, h *handler.SurveyHandler) {
	drafts := router.Group("/drafts")
	drafts.Post("/", h.CreateDraft)
	drafts.Get("/:id", h.GetDraft)
	drafts.Put("/:id", h.UpdateDraft)
	drafts.Post("/:id/publish", h.PublishDraft)
}
