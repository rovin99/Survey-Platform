package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

func SetupMediaRoutes(app *fiber.App, handler *handler.MediaHandler) {
	mediaGroup := app.Group("/api/v1/media")

	mediaGroup.Post("/upload", handler.UploadMedia)

}
