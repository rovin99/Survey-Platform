package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

func SetupAnswerRoutes(router fiber.Router, h *handler.AnswerHandler) {
	answerGroup := router.Group("/answers")
	answerGroup.Post("/", h.CreateAnswer)
	answerGroup.Post("/bulk", h.SubmitBulkAnswers)
	answerGroup.Get("/session/:session_id", h.GetAnswersBySession)
	answerGroup.Get("/question/:question_id", h.GetAnswersByQuestion)
}
