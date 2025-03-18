package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/middlewares"
)

func SetupSurveyRoutes(app *fiber.App, handler *handler.SurveyHandler) {
	surveyGroup := app.Group("/api/surveys")

	// Create survey route with validation
	surveyGroup.Post("/",
		middlewares.SurveyValidationMiddleware(),
		handler.CreateSurvey,
	)

	// Save section route with validation
	surveyGroup.Post("/:id/sections",
		middlewares.QuestionSectionValidationMiddleware(),
		handler.SaveSection,
	)

	// Publish survey route with validation
	surveyGroup.Post("/:id/publish",
		middlewares.PublishSurveyValidationMiddleware(),
		handler.PublishSurvey,
	)

	surveyGroup.Get("/:id/progress",
		handler.GetProgress,
	)

	surveyGroup.Get("/:id",
		handler.GetSurvey,
	)
}

// SetupDraftRoutes registers routes for draft management
func SetupDraftRoutes(app *fiber.App, handler *handler.SurveyHandler) {
	draftGroup := app.Group("/api/v1")

	// Create or update draft
	draftGroup.Post("/drafts", handler.CreateDraft)

	// Get draft by ID
	draftGroup.Get("/drafts/:id", handler.GetDraft)

	// Update existing draft
	draftGroup.Put("/drafts/:id", handler.UpdateDraft)

	// Publish draft to survey
	draftGroup.Post("/drafts/:id/publish", handler.PublishDraft)
}
