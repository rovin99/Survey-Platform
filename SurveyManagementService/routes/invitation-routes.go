package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
	middlewares "github.com/rovin99/Survey-Platform/SurveyManagementService/Middlewares"
)

// SetupInvitationRoutes sets up the invitation-related routes
func SetupInvitationRoutes(app *fiber.App, invitationHandler *handler.InvitationHandler) {
	// Participant-facing: surveys assigned to the logged-in participant (any authenticated user, not
	// conductor-gated). Registered before the :surveyId group so "assigned" isn't treated as a survey id.
	app.Get("/api/v1/surveys/assigned/my", middlewares.AuthMiddleware(), invitationHandler.ListMyAssignments)

	// All invitation routes require authentication (conductor must be logged in)
	invitations := app.Group("/api/v1/surveys/:surveyId", middlewares.AuthMiddleware())

	// Send bulk invitations
	invitations.Post("/invitations", invitationHandler.SendBulkInvitations)

	// Get all invitations for a survey
	invitations.Get("/invitations", invitationHandler.GetInvitations)

	// Get invitation statistics
	invitations.Get("/invitations/stats", invitationHandler.GetInvitationStats)

	// Update anonymous participation setting
	invitations.Patch("/anonymous", invitationHandler.UpdateAnonymousSetting)
}

