package handler

import (
	"encoding/json"
	"log"

	"SurveyManagementService/models"
	"SurveyManagementService/service"
	"SurveyManagementService/utils/response"

	"github.com/gofiber/fiber/v2"
)

type SurveyHandler struct {
	surveyService   service.SurveyService
	questionService service.QuestionTypeServiceInterface
}

func NewSurveyHandler(surveyService service.SurveyService, questionService service.QuestionTypeServiceInterface) *SurveyHandler {
	return &SurveyHandler{
		surveyService:   surveyService,
		questionService: questionService,
	}
}

type CreateSurveyRequest struct {
	Title             string `json:"title"`
	Description       string `json:"description"`
	IsSelfRecruitment bool   `json:"is_self_recruitment"`
	ConductorID       uint   `json:"conductor_id"`
}

type SaveSectionRequest struct {
	Questions      []models.Question        `json:"questions"`
	MediaFiles     []models.SurveyMediaFile `json:"media_files"`
	BranchingLogic []models.BranchingRule   `json:"branching_logic"`
}

type CreateDraftRequest struct {
	SurveyID           uint               `json:"survey_id"`
	DraftContent       models.JSONContent `json:"draft_content"`
	LastEditedQuestion uint               `json:"last_edited_question"`
}

func (h *SurveyHandler) CreateSurvey(c *fiber.Ctx) error {
	var req CreateSurveyRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	survey := &models.Survey{
		Title:             req.Title,
		Description:       req.Description,
		IsSelfRecruitment: req.IsSelfRecruitment,
		ConductorID:       req.ConductorID,
	}

	if err := h.surveyService.CreateSurvey(c.Context(), survey); err != nil {
		return response.InternalServerError(c, "Failed to create survey")
	}

	return response.Success(c, survey, "Survey created successfully", fiber.StatusCreated)
}

func (h *SurveyHandler) SaveSection(c *fiber.Ctx) error {
	surveyID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	var req SaveSectionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	err = h.surveyService.SaveSection(c.Context(), uint(surveyID), req.Questions, req.MediaFiles, req.BranchingLogic)
	if err != nil {
		return response.InternalServerError(c, "Failed to save section")
	}

	return response.Success(c, nil, "Section saved successfully")
}

func (h *SurveyHandler) SaveDraft(c *fiber.Ctx) error {
	surveyID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	var draftContent models.JSONContent
	if err := c.BodyParser(&draftContent); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	lastEditedQuestion := uint(c.QueryInt("last_edited_question", 0))

	err = h.surveyService.SaveDraft(c.Context(), uint(surveyID), draftContent, lastEditedQuestion)
	if err != nil {
		return response.InternalServerError(c, "Failed to save draft")
	}

	return response.Success(c, nil, "Draft saved successfully")
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

func (h *SurveyHandler) GetQuestions(c *fiber.Ctx) error {
	surveyID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	questions, err := h.questionService.GetQuestions(c.Context(), uint(surveyID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get questions")
	}

	return response.Success(c, questions, "Questions retrieved successfully")
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
