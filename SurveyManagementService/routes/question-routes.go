package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

func SetupQuestionRoutes(router fiber.Router, h *handler.QuestionHandler) {
	questions := router.Group("/questions")
	questions.Post("/", h.CreateQuestion)
	questions.Get("/:id", h.GetQuestion)
	questions.Get("/survey/:survey_id", h.GetQuestionsBySurvey)
	questions.Put("/:id", h.UpdateQuestion)
	questions.Delete("/:id", h.DeleteQuestion)
}
