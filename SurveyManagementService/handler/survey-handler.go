package handler

import (
	"encoding/json"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/utils/response"
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

	return response.Success(c, survey, "Survey retrieved successfully")
}

func (h *SurveyHandler) CreateDraft(c *fiber.Ctx) error {
	var req CreateDraftRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Log the request in a readable format
	draftContentJSON, _ := json.MarshalIndent(json.RawMessage(req.DraftContent), "", "  ")
	log.Printf("Creating draft with content: %s", string(draftContentJSON))

	draft, err := h.surveyService.CreateDraft(c.Context(), req.SurveyID, req.DraftContent, req.LastEditedQuestion)
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

	// Check if a more recent draft exists for this survey
	latestDraft, err := h.surveyService.GetLatestDraft(c.Context(), draft.SurveyID)
	if err == nil && latestDraft.DraftID > uint(draftID) {
		// A more recent draft exists
		log.Printf("More recent draft found: %d vs requested %d", latestDraft.DraftID, draftID)
		return response.BadRequest(c, "A more recent draft exists. Please refresh and try again.")
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
