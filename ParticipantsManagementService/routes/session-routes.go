package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/handler"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/middleware"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository"
)

func SetupParticipantRoutes(app *fiber.App, participantHandler *handler.ParticipantHandler, mediaHandler *handler.MediaHandler, repo repository.ParticipantRepository) {
	// Health check endpoint - not protected by auth
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"message": "Participants service is running",
		})
	})

	// Group routes specific to participant actions
	participantGroup := app.Group("/api/participant")

	// IMPORTANT: Register public routes FIRST (before auth middleware)
	// No IP rate limit here — campus WiFi shares one IP for all students.
	// Abuse prevention handled by: OTP email verification + email hash attempt tracking.
	participantGroup.Post("/surveys/public/start", participantHandler.HandleStartSessionViaShareLink)

	// Session-protected routes: require valid session token for anonymous users
	// or ownership verification for authenticated users (prevents IDOR attacks)
	sessionGroup := participantGroup.Group("/sessions/:sessionId")
	// OptionalAuthMiddleware extracts participantId if user is logged in (doesn't fail for anonymous)
	// SessionTokenMiddleware then verifies ownership (for authenticated) or session token (for anonymous)
	sessionGroup.Use(middleware.OptionalAuthMiddleware())
	sessionGroup.Use(middleware.SessionTokenMiddleware(repo))

	sessionGroup.Post("/start", participantHandler.HandleMarkSessionStarted)
	sessionGroup.Put("/draft", participantHandler.HandleSaveDraft)
	sessionGroup.Post("/submit", participantHandler.HandleSubmitSurvey)
	sessionGroup.Post("/evaluate", participantHandler.HandleEvaluateQuiz)
	sessionGroup.Get("/quiz-results", participantHandler.HandleEvaluateQuiz)
	sessionGroup.Post("/upload", mediaHandler.HandleUploadMedia)

	// Apply authentication middleware to authenticated routes only
	authGroup := participantGroup.Group("")
	authGroup.Use(middleware.AuthMiddleware())

	// Participant's own survey history (authenticated participants)
	authGroup.Get("/my-history", participantHandler.HandleGetMyHistory)

	// Route to start or resume a survey session for a specific survey (authenticated)
	authGroup.Post("/surveys/:surveyId/session", participantHandler.HandleStartOrResumeSurvey)

	// GET endpoint for session data (authenticated)
	authGroup.Get("/surveys/:surveyId/session", participantHandler.HandleGetSession)

	// Analytics/Results routes (authenticated - for conductors)
	authGroup.Get("/surveys/:surveyId/results", participantHandler.HandleGetSurveyResults)
	authGroup.Get("/sessions/:sessionId/responses", participantHandler.HandleGetSessionResponses)

	// Conductor management routes
	authGroup.Delete("/surveys/:surveyId/reset-participant", participantHandler.HandleResetParticipant)
}
