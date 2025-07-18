package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Middlewares"
)

func SetupSurveyRoutes(router fiber.Router, h *handler.SurveyHandler) {
	survey := router.Group("/surveys")
	
	// Apply conductor role middleware to survey management endpoints
	survey.Post("/:id/publish", middlewares.ConductorRoleMiddleware(), h.PublishSurvey)
	survey.Get("/:id/progress", h.GetProgress) // Allow any authenticated user to check progress
	survey.Get("/:id", h.GetSurvey) // Allow any authenticated user to view surveys
}

// SetupDraftRoutes registers routes for draft management
func SetupDraftRoutes(router fiber.Router, h *handler.SurveyHandler) {
	drafts := router.Group("/drafts")
	
	// Apply conductor role middleware to draft creation/modification endpoints
	drafts.Post("/", middlewares.ConductorRoleMiddleware(), h.CreateDraft)
	drafts.Get("/:id", h.GetDraft) // Allow any authenticated user to view drafts
	drafts.Put("/:id", middlewares.ConductorRoleMiddleware(), h.UpdateDraft)
	drafts.Post("/:id/publish", middlewares.ConductorRoleMiddleware(), h.PublishDraft)
}
