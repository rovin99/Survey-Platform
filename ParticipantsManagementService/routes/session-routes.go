package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/handler"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/middleware"
)

func SetupParticipantRoutes(app *fiber.App, participantHandler *handler.ParticipantHandler) {
	// Health check endpoint - not protected by auth
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"message": "Participants service is running",
		})
	})

	// Group routes specific to participant actions
	participantGroup := app.Group("/api/participant")

	// Apply authentication middleware to all participant routes
	// Make sure your middleware sets c.Locals("participantId")
	participantGroup.Use(middleware.AuthMiddleware()) // Replace with your actual auth middleware

	// Route to start or resume a survey session for a specific survey
	participantGroup.Post("/surveys/:surveyId/session", participantHandler.HandleStartOrResumeSurvey)

	// GET endpoint for session data
	participantGroup.Get("/surveys/:surveyId/session", participantHandler.HandleGetSession)

	// Route to save the draft for a specific session
	participantGroup.Put("/sessions/:sessionId/draft", participantHandler.HandleSaveDraft)

	// Route to submit the final answers for a specific session
	participantGroup.Post("/sessions/:sessionId/submit", participantHandler.HandleSubmitSurvey)

	// Optional: Add routes to GET session or draft details if needed directly
	// participantGroup.Get("/sessions/:sessionId/draft", participantHandler.HandleGetDraft)   // Needs handler implementation
}
