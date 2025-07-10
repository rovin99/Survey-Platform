package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

func SetupOptionRoutes(router fiber.Router, h *handler.OptionHandler) {
	optionGroup := router.Group("/options")
	optionGroup.Post("/", h.CreateOption)
	optionGroup.Post("/batch", h.BatchCreateOptions)
	optionGroup.Get("/:id", h.GetOption)
	optionGroup.Get("/question/:question_id", h.GetOptionsByQuestion)
	optionGroup.Put("/:id", h.UpdateOption)
	optionGroup.Delete("/:id", h.DeleteOption)
}
