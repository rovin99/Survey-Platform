package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

func SetupEmailRoutes(app fiber.Router, emailHandler *handler.EmailHandler) {
	emailGroup := app.Group("/email")
	
	// Email endpoints
	emailGroup.Post("/verify", emailHandler.SendVerificationEmail)
	emailGroup.Post("/magic-link", emailHandler.SendMagicLinkEmail)
	
	// Generic send endpoint (used by ParticipantsManagementService for notifications)
	emailGroup.Post("/send", emailHandler.SendGenericEmail)

	// Health check for email service
	emailGroup.Get("/health", emailHandler.CheckEmailHealth)
}
