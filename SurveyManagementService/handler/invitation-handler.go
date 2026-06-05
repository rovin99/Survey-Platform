package handler

import (
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/response"
)

// InvitationHandler handles survey invitation endpoints
type InvitationHandler struct {
	invitationService *service.InvitationService
}

// NewInvitationHandler creates a new invitation handler
func NewInvitationHandler(invitationService *service.InvitationService) *InvitationHandler {
	return &InvitationHandler{
		invitationService: invitationService,
	}
}

// SendBulkInvitationsRequest is the request body for sending invitations
type SendBulkInvitationsRequest struct {
	Emails   []string `json:"emails" validate:"required,min=1"`
	ShareURL string   `json:"share_url" validate:"required"`
}

// UpdateAnonymousSettingRequest is the request body for updating anonymous setting
type UpdateAnonymousSettingRequest struct {
	AllowAnonymous bool `json:"allow_anonymous"`
}

// SendBulkInvitations handles POST /api/v1/surveys/:surveyId/invitations
func (h *InvitationHandler) SendBulkInvitations(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil || surveyID == 0 {
		return response.BadRequest(c, "Invalid survey ID")
	}

	// 🔐 ACCESS CONTROL: Get conductor ID from JWT
	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return response.Unauthorized(c, "Authentication required")
	}

	var req SendBulkInvitationsRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if len(req.Emails) == 0 {
		return response.BadRequest(c, "At least one email is required")
	}

	if req.ShareURL == "" {
		return response.BadRequest(c, "Share URL is required")
	}

	log.Printf("[INFO] Conductor %d sending %d invitations for survey %d", conductorID, len(req.Emails), surveyID)

	stats, err := h.invitationService.SendBulkInvitations(c.Context(), uint(surveyID), conductorID, req.Emails, req.ShareURL)
	if err != nil {
		log.Printf("[ERROR] Failed to send invitations: %v", err)
		return response.InternalServerError(c, err.Error())
	}

	log.Printf("[SUCCESS] Invitations sent - Total: %d, Sent: %d, Failed: %d",
		stats.TotalInvited, stats.TotalSent, stats.TotalFailed)

	return response.Success(c, fiber.Map{
		"stats": stats,
	}, "Invitations processed successfully")
}

// ListMyAssignments handles GET /api/v1/surveys/assigned/my
// Returns published surveys assigned (via invitation) to the authenticated participant's email
// that they haven't completed yet — for the participant dashboard's "Assigned to you" list.
func (h *InvitationHandler) ListMyAssignments(c *fiber.Ctx) error {
	emailVal := c.Locals("email")
	email, ok := emailVal.(string)
	if !ok || email == "" {
		return response.Unauthorized(c, "Authentication required")
	}

	assignments, err := h.invitationService.ListAssignmentsByEmail(c.Context(), email)
	if err != nil {
		return response.InternalServerError(c, "Failed to load assigned surveys")
	}
	return response.Success(c, assignments, "Assigned surveys retrieved")
}

// GetInvitationStats handles GET /api/v1/surveys/:surveyId/invitations/stats
func (h *InvitationHandler) GetInvitationStats(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil || surveyID == 0 {
		return response.BadRequest(c, "Invalid survey ID")
	}

	// 🔐 ACCESS CONTROL: Get conductor ID from JWT
	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return response.Unauthorized(c, "Authentication required")
	}

	stats, err := h.invitationService.GetInvitationStats(c.Context(), uint(surveyID), conductorID)
	if err != nil {
		return response.InternalServerError(c, "Failed to get invitation stats")
	}

	return response.Success(c, stats, "")
}

// GetInvitations handles GET /api/v1/surveys/:surveyId/invitations
func (h *InvitationHandler) GetInvitations(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil || surveyID == 0 {
		return response.BadRequest(c, "Invalid survey ID")
	}

	// 🔐 ACCESS CONTROL: Get conductor ID from JWT
	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return response.Unauthorized(c, "Authentication required")
	}

	invitations, err := h.invitationService.GetInvitations(c.Context(), uint(surveyID), conductorID)
	if err != nil {
		return response.InternalServerError(c, "Failed to get invitations")
	}

	return response.Success(c, fiber.Map{
		"invitations": invitations,
		"total":       len(invitations),
	}, "")
}

// UpdateAnonymousSetting handles PATCH /api/v1/surveys/:surveyId/anonymous
func (h *InvitationHandler) UpdateAnonymousSetting(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil || surveyID == 0 {
		return response.BadRequest(c, "Invalid survey ID")
	}

	// 🔐 ACCESS CONTROL: Get conductor ID from JWT
	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return response.Unauthorized(c, "Authentication required")
	}

	var req UpdateAnonymousSettingRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	log.Printf("[INFO] Conductor %d updating anonymous setting for survey %d to %v", conductorID, surveyID, req.AllowAnonymous)

	err = h.invitationService.UpdateSurveyAnonymousSetting(c.Context(), uint(surveyID), conductorID, req.AllowAnonymous)
	if err != nil {
		return response.InternalServerError(c, "Failed to update setting")
	}

	return response.Success(c, fiber.Map{
		"allow_anonymous": req.AllowAnonymous,
	}, "Anonymous setting updated successfully")
}

// MarkInvitationCompletedRequest is the request body for marking invitation as completed
type MarkInvitationCompletedRequest struct {
	Email string `json:"email" validate:"required"`
}

// MarkInvitationCompleted handles POST /internal/api/v1/surveys/:surveyId/invitation/complete
// This is an internal endpoint called by ParticipantsManagementService when survey is submitted
func (h *InvitationHandler) MarkInvitationCompleted(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil || surveyID == 0 {
		return response.BadRequest(c, "Invalid survey ID")
	}

	var req MarkInvitationCompletedRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Email == "" {
		return response.BadRequest(c, "Email is required")
	}

	log.Printf("[INFO] Marking invitation as completed - SurveyID: %d, Email: %s", surveyID, req.Email)

	err = h.invitationService.MarkInvitationCompleted(c.Context(), uint(surveyID), req.Email)
	if err != nil {
		log.Printf("[ERROR] Failed to mark invitation completed: %v", err)
		return response.InternalServerError(c, err.Error())
	}

	return response.Success(c, nil, "Invitation marked as completed")
}