package routes

import (
	"github.com/gofiber/fiber/v2"
	middlewares "github.com/rovin99/Survey-Platform/SurveyManagementService/Middlewares"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

func SetupOptionRoutes(router fiber.Router, h *handler.OptionHandler) {
	optionGroup := router.Group("/options")

	// Apply conductor role middleware to option management endpoints
	optionGroup.Post("/", middlewares.ConductorRoleMiddleware(), h.CreateOption)
	optionGroup.Post("/batch", middlewares.ConductorRoleMiddleware(), h.BatchCreateOptions)
	optionGroup.Get("/:id", h.GetOption)                              // Allow any authenticated user to view options
	optionGroup.Get("/question/:question_id", h.GetOptionsByQuestion) // Allow any authenticated user to view question options
	optionGroup.Put("/:id", middlewares.ConductorRoleMiddleware(), h.UpdateOption)
	optionGroup.Delete("/:id", middlewares.ConductorRoleMiddleware(), h.DeleteOption)
}
