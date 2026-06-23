package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/handler"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/middleware"
)

func SetupEvaluationRoutes(app *fiber.App, evalHandler *handler.EvaluationHandler) {
	auth := middleware.AuthMiddleware()

	// Register each evaluation route individually (not as a group with middleware)
	// This avoids the group's AuthMiddleware intercepting unrelated /api/participant/* routes
	app.Get("/api/participant/surveys/:surveyId/pending-evaluations", auth, evalHandler.GetPendingEvaluations)
	app.Get("/api/participant/sessions/:sessionId/for-evaluation", auth, evalHandler.GetSessionForEvaluation)
	app.Post("/api/participant/sessions/:sessionId/evaluation/question", auth, evalHandler.SaveQuestionEvaluation)
	app.Post("/api/participant/sessions/:sessionId/manual-evaluate", auth, evalHandler.SubmitEvaluation)
	app.Get("/api/participant/sessions/:sessionId/evaluation-results", auth, evalHandler.GetEvaluationResult)
}
