package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Middlewares"
)

func SetupSurveyRoutes(router fiber.Router, h *handler.SurveyHandler) {
	survey := router.Group("/surveys")

	// 🔐 SECURE: List surveys for authenticated conductor (uses JWT, not URL params)
	survey.Get("/my", middlewares.ConductorRoleMiddleware(), h.ListSurveysByConductor)

	// 🔐 Conductor endpoints with ownership verification in handlers
	survey.Post("/:id/publish", middlewares.ConductorRoleMiddleware(), h.PublishSurvey)
	survey.Get("/:id/progress", middlewares.ConductorRoleMiddleware(), h.GetProgress)
	survey.Get("/:id", middlewares.ConductorRoleMiddleware(), h.GetSurvey)
	survey.Delete("/:id", middlewares.ConductorRoleMiddleware(), h.DeleteSurvey)

	// 🔐 DEPRECATED: Use /surveys/my instead - kept for backwards compatibility
	// Ownership is verified in handler to prevent accessing other conductors' surveys
	survey.Get("/conductor/:conductor_id", middlewares.ConductorRoleMiddleware(), h.ListSurveysByConductorParam)
}

// SetupDraftRoutes registers routes for draft management
// 🔐 All endpoints verify ownership in handlers - conductors can only access their own drafts
func SetupDraftRoutes(router fiber.Router, h *handler.SurveyHandler) {
	drafts := router.Group("/drafts")

	// All draft endpoints require conductor role + ownership verification
	drafts.Post("/", middlewares.ConductorRoleMiddleware(), h.CreateDraft)
	// 🔐 List the authenticated conductor's drafts — registered before /:id so "my" isn't matched as :id
	drafts.Get("/my", middlewares.ConductorRoleMiddleware(), h.ListMyDrafts)
	drafts.Get("/:id", middlewares.ConductorRoleMiddleware(), h.GetDraft)
	drafts.Put("/:id", middlewares.ConductorRoleMiddleware(), h.UpdateDraft)
	drafts.Delete("/:id", middlewares.ConductorRoleMiddleware(), h.DeleteDraft)
	drafts.Post("/:id/publish", middlewares.ConductorRoleMiddleware(), h.PublishDraft)
}
