package handler

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Middlewares"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/response"
)

type SurveyHandler struct {
	surveyService service.SurveyService
}

func NewSurveyHandler(surveyService service.SurveyService) *SurveyHandler {
	return &SurveyHandler{
		surveyService: surveyService,
	}
}

type CreateSurveyRequest struct {
	Title             string `json:"title"`
	Description       string `json:"description"`
	IsSelfRecruitment bool   `json:"is_self_recruitment"`
	ConductorID       uint   `json:"conductor_id"`
}


type CreateDraftRequest struct {
	SurveyID           uint               `json:"survey_id"`
	DraftContent       models.JSONContent `json:"draft_content"`
	LastEditedQuestion uint               `json:"last_edited_question"`
}


func (h *SurveyHandler) PublishSurvey(c *fiber.Ctx) error {
	surveyID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	// SECURITY: First fetch the survey to verify ownership
	survey, err := h.surveyService.GetSurvey(c.Context(), uint(surveyID))
	if err != nil {
		return response.NotFound(c, "Survey not found")
	}

	// SECURITY: Verify the authenticated user owns this survey
	if ownershipErr := middlewares.VerifyOwnership(c, survey.ConductorID, "survey"); ownershipErr != nil {
		return ownershipErr
	}

	err = h.surveyService.PublishSurvey(c.Context(), uint(surveyID))
	if err != nil {
		return response.InternalServerError(c, "Failed to publish survey")
	}

	return response.Success(c, nil, "Survey published successfully")
}

func (h *SurveyHandler) GetProgress(c *fiber.Ctx) error {
	surveyID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	// SECURITY: First fetch the survey to verify ownership
	survey, err := h.surveyService.GetSurvey(c.Context(), uint(surveyID))
	if err != nil {
		return response.NotFound(c, "Survey not found")
	}

	// SECURITY: Verify the authenticated user owns this survey
	if ownershipErr := middlewares.VerifyOwnership(c, survey.ConductorID, "survey"); ownershipErr != nil {
		return ownershipErr
	}

	progress, err := h.surveyService.GetProgress(c.Context(), uint(surveyID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get progress")
	}

	return response.Success(c, progress, "Progress retrieved successfully")
}

func (h *SurveyHandler) GetSurvey(c *fiber.Ctx) error {
	surveyID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	survey, err := h.surveyService.GetSurvey(c.Context(), uint(surveyID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get survey")
	}

	// SECURITY: Verify the authenticated user owns this survey
	if ownershipErr := middlewares.VerifyOwnership(c, survey.ConductorID, "survey"); ownershipErr != nil {
		return ownershipErr
	}

	return response.Success(c, survey, "Survey retrieved successfully")
}

func (h *SurveyHandler) DeleteSurvey(c *fiber.Ctx) error {
	surveyID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	conductorID, _ := c.Locals("userId").(uint)
	if conductorID == 0 {
		return response.Unauthorized(c, "Authentication required")
	}

	if err := h.surveyService.DeleteSurvey(c.Context(), uint(surveyID), conductorID); err != nil {
		if err.Error() == "unauthorized: you do not own this survey" {
			return response.Forbidden(c, err.Error())
		}
		if err.Error() == "survey not found" {
			return response.NotFound(c, err.Error())
		}
		return response.InternalServerError(c, "Failed to delete survey")
	}

	return response.Success(c, nil, "Survey and all related data deleted successfully")
}

func (h *SurveyHandler) CreateDraft(c *fiber.Ctx) error {
	// Get userId from JWT (set by auth middleware)
	// NOTE: This is userId, not conductorId. Ideally JWT should include conductorId.
	userID, _ := c.Locals("userId").(uint)

	var req CreateDraftRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Log the request in a readable format
	draftContentJSON, _ := json.MarshalIndent(json.RawMessage(req.DraftContent), "", "  ")
	log.Printf("Creating draft (userId: %d) with content: %s", userID, string(draftContentJSON))

	// NOTE: Passing userID as conductorID for now - ideally JWT should have conductorId
	draft, err := h.surveyService.CreateDraft(c.Context(), req.SurveyID, userID, req.DraftContent, req.LastEditedQuestion)
	if err != nil {
		return response.InternalServerError(c, "Failed to save draft")
	}

	return response.Success(c, fiber.Map{
		"draftId":   draft.DraftID,
		"lastSaved": draft.LastSaved,
	}, "Draft saved successfully", fiber.StatusCreated)
}

func (h *SurveyHandler) UpdateDraft(c *fiber.Ctx) error {
	// Get draft ID from URL parameters
	draftID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid draft ID")
	}

	// SECURITY: First fetch the draft to verify ownership
	existingDraft, err := h.surveyService.GetDraft(c.Context(), uint(draftID))
	if err != nil {
		return response.NotFound(c, "Draft not found")
	}

	// SECURITY: Verify the authenticated user owns this draft
	if ownershipErr := middlewares.VerifyOwnership(c, existingDraft.ConductorID, "draft"); ownershipErr != nil {
		return ownershipErr
	}

	// Parse the request body
	var req CreateDraftRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Log the request in a readable format
	draftContentJSON, _ := json.MarshalIndent(json.RawMessage(req.DraftContent), "", "  ")
	log.Printf("Updating draft %d with content: %s", draftID, string(draftContentJSON))

	// Update the draft using service
	draft, err := h.surveyService.UpdateDraft(c.Context(), uint(draftID), req.DraftContent, req.LastEditedQuestion)
	if err != nil {
		return response.InternalServerError(c, "Failed to update draft")
	}

	// Return the updated draft
	return response.Success(c, fiber.Map{
		"draftId":   draft.DraftID,
		"lastSaved": draft.LastSaved,
	}, "Draft updated successfully")
}

func (h *SurveyHandler) GetDraft(c *fiber.Ctx) error {
	draftID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid draft ID")
	}

	draft, err := h.surveyService.GetDraft(c.Context(), uint(draftID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get draft")
	}

	// SECURITY: Verify the authenticated user owns this draft
	if ownershipErr := middlewares.VerifyOwnership(c, draft.ConductorID, "draft"); ownershipErr != nil {
		return ownershipErr
	}

	return response.Success(c, draft, "Draft retrieved successfully")
}

func (h *SurveyHandler) PublishDraft(c *fiber.Ctx) error {
	// Get draft ID from URL parameters
	draftID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid draft ID")
	}

	// Get the requested draft
	draft, err := h.surveyService.GetDraft(c.Context(), uint(draftID))
	if err != nil {
		return response.InternalServerError(c, "Failed to retrieve draft: "+err.Error())
	}

	// SECURITY: Verify the authenticated user owns this draft
	if ownershipErr := middlewares.VerifyOwnership(c, draft.ConductorID, "draft"); ownershipErr != nil {
		return ownershipErr
	}

	// Check if a more recent draft exists for this survey (only if survey exists)
	if draft.SurveyID > 0 {
		latestDraft, err := h.surveyService.GetLatestDraft(c.Context(), draft.SurveyID)
		if err == nil && latestDraft.DraftID > uint(draftID) {
			// A more recent draft exists
			log.Printf("More recent draft found: %d vs requested %d", latestDraft.DraftID, draftID)
			return response.BadRequest(c, "A more recent draft exists. Please refresh and try again.")
		}
		// If there's an error getting latest draft (e.g., survey doesn't exist), continue with publishing
		// This allows drafts with non-existent survey IDs to be published as new surveys
	}

	// Publish the draft using service
	surveyID, err := h.surveyService.PublishDraftToSurvey(c.Context(), uint(draftID))
	if err != nil {
		return response.InternalServerError(c, "Failed to publish survey: "+err.Error())
	}

	// Return success with the survey ID
	return response.Success(c, fiber.Map{
		"surveyId": surveyID,
	}, "Survey published successfully")
}

// ListSurveysByConductor retrieves all surveys created by the authenticated conductor
// SECURITY: Uses authenticated user's ID from JWT, not URL parameters
func (h *SurveyHandler) ListSurveysByConductor(c *fiber.Ctx) error {
	// SECURITY: Get conductor ID from authenticated user's JWT, not URL params
	userID, err := middlewares.GetUserIDFromContext(c)
	if err != nil {
		// Return the error directly - GetUserIDFromContext returns a fiber.Error with proper status
		return err
	}

	// Get all surveys for the authenticated conductor only
	surveys, err := h.surveyService.ListSurveysByConductor(c.Context(), userID)
	if err != nil {
		return response.InternalServerError(c, "Failed to retrieve surveys")
	}

	return response.Success(c, surveys, "Surveys retrieved successfully")
}

// ListSurveysByConductorParam - DEPRECATED: kept for backwards compatibility
// This endpoint should be removed in favor of ListSurveysByConductor
func (h *SurveyHandler) ListSurveysByConductorParam(c *fiber.Ctx) error {
	// Get conductor ID from URL parameters
	conductorID, err := c.ParamsInt("conductor_id")
	if err != nil {
		return response.BadRequest(c, "Invalid conductor ID")
	}

	// SECURITY: Verify the authenticated user is requesting their own surveys
	userID, _ := middlewares.GetUserIDFromContext(c)
	if uint(conductorID) != userID {
		return response.Forbidden(c, "You can only view your own surveys")
	}

	// Get all surveys for this conductor
	surveys, err := h.surveyService.ListSurveysByConductor(c.Context(), uint(conductorID))
	if err != nil {
		return response.InternalServerError(c, "Failed to retrieve surveys")
	}

	return response.Success(c, surveys, "Surveys retrieved successfully")
}

// DraftListItem is a lightweight summary of a draft for the dashboard list (no full content).
type DraftListItem struct {
	DraftID       uint      `json:"draftId"`
	SurveyID      uint      `json:"surveyId"`
	Title         string    `json:"title"`
	QuestionCount int       `json:"questionCount"`
	LastSaved     time.Time `json:"lastSaved"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// ListMyDrafts returns the authenticated conductor's in-progress drafts (from the survey_drafts table).
// SECURITY: Uses conductor ID from JWT, not URL params.
func (h *SurveyHandler) ListMyDrafts(c *fiber.Ctx) error {
	userID, err := middlewares.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	drafts, err := h.surveyService.ListDraftsByConductor(c.Context(), userID)
	if err != nil {
		return response.InternalServerError(c, "Failed to retrieve drafts")
	}

	items := make([]DraftListItem, 0, len(drafts))
	for _, d := range drafts {
		// Parse title + question count from the opaque draft_content JSON. Parse defensively:
		// old/partial drafts may not match the expected shape.
		var parsed struct {
			BasicInfo struct {
				Title string `json:"title"`
			} `json:"basicInfo"`
			Questions []json.RawMessage `json:"questions"`
		}
		_ = json.Unmarshal([]byte(d.DraftContent), &parsed)

		title := parsed.BasicInfo.Title
		if title == "" {
			title = "Untitled draft"
		}

		items = append(items, DraftListItem{
			DraftID:       d.DraftID,
			SurveyID:      d.SurveyID,
			Title:         title,
			QuestionCount: len(parsed.Questions),
			LastSaved:     d.LastSaved,
			UpdatedAt:     d.UpdatedAt,
		})
	}

	return response.Success(c, items, "Drafts retrieved successfully")
}

// DeleteDraft deletes one of the authenticated conductor's drafts.
func (h *SurveyHandler) DeleteDraft(c *fiber.Ctx) error {
	draftID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid draft ID")
	}

	userID, err := middlewares.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	if err := h.surveyService.DeleteDraft(c.Context(), uint(draftID), userID); err != nil {
		switch err.Error() {
		case "unauthorized: you do not own this draft":
			return response.Forbidden(c, err.Error())
		case "draft not found":
			return response.NotFound(c, err.Error())
		default:
			return response.InternalServerError(c, "Failed to delete draft")
		}
	}

	return response.Success(c, nil, "Draft deleted successfully")
}

// GetSurveyInternal is for internal service-to-service calls (e.g., quiz evaluation)
// This endpoint does NOT require user authentication - it uses API key auth via InternalAPIKeyMiddleware
// SECURITY: Only callable from internal services, not exposed to external clients
func (h *SurveyHandler) GetSurveyInternal(c *fiber.Ctx) error {
	// Verify this is an internal call (set by InternalAPIKeyMiddleware)
	isInternal, _ := c.Locals("isInternalCall").(bool)
	if !isInternal {
		return response.Forbidden(c, "This endpoint is for internal use only")
	}

	surveyID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	survey, err := h.surveyService.GetSurvey(c.Context(), uint(surveyID))
	if err != nil {
		return response.NotFound(c, "Survey not found")
	}

	return response.Success(c, survey, "Survey retrieved successfully")
}
