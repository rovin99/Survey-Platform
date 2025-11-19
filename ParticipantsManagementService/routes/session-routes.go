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

	// Apply authentication middleware to authenticated routes only
	authGroup := participantGroup.Group("")
	authGroup.Use(middleware.AuthMiddleware()) // Authenticated routes

	// Route to start or resume a survey session for a specific survey (authenticated)
	authGroup.Post("/surveys/:surveyId/session", participantHandler.HandleStartOrResumeSurvey)

	// GET endpoint for session data (authenticated)
	authGroup.Get("/surveys/:surveyId/session", participantHandler.HandleGetSession)

	// Analytics/Results routes (authenticated - for conductors)
	authGroup.Get("/surveys/:surveyId/results", participantHandler.HandleGetSurveyResults)
	authGroup.Get("/sessions/:sessionId/responses", participantHandler.HandleGetSessionResponses)

	// Public routes (no authentication middleware) - for anonymous survey taking
	publicGroup := participantGroup.Group("")
	// No auth middleware applied to public routes

	// Route to start a session via share link (public access with token validation)
	publicGroup.Post("/surveys/public/start", participantHandler.HandleStartSessionViaShareLink)

	// Routes for draft and submit - these work with session cookies for anonymous users
	publicGroup.Put("/sessions/:sessionId/draft", participantHandler.HandleSaveDraft)
	publicGroup.Post("/sessions/:sessionId/submit", participantHandler.HandleSubmitSurvey)

	// Quiz evaluation routes (public - can be called after quiz submission)
	publicGroup.Post("/sessions/:sessionId/evaluate", participantHandler.HandleEvaluateQuiz)
	publicGroup.Get("/sessions/:sessionId/quiz-results", participantHandler.HandleEvaluateQuiz)

	// Optional: Add routes to GET session or draft details if needed directly
	// participantGroup.Get("/sessions/:sessionId/draft", participantHandler.HandleGetDraft)   // Needs handler implementation
}
