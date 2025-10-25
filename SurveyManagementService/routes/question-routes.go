package routes

import (
	"github.com/gofiber/fiber/v2"
	middlewares "github.com/rovin99/Survey-Platform/SurveyManagementService/Middlewares"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

func SetupQuestionRoutes(router fiber.Router, h *handler.QuestionHandler) {
	questions := router.Group("/questions")

	// Apply conductor role middleware to question management endpoints
	questions.Post("/", middlewares.ConductorRoleMiddleware(), h.CreateQuestion)
	questions.Get("/:id", h.GetQuestion)                        // Allow any authenticated user to view questions
	questions.Get("/survey/:survey_id", h.GetQuestionsBySurvey) // Allow any authenticated user to view survey questions
	questions.Put("/:id", middlewares.ConductorRoleMiddleware(), h.UpdateQuestion)
	questions.Delete("/:id", middlewares.ConductorRoleMiddleware(), h.DeleteQuestion)
}
