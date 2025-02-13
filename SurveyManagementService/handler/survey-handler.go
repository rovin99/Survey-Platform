package handler

import (
	"encoding/json"

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

type SaveSectionRequest struct {
	Questions      []models.Question        `json:"questions"`
	MediaFiles     []models.SurveyMediaFile `json:"media_files"`
	BranchingLogic []models.BranchingRule   `json:"branching_logic"`
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

	var draftContent json.RawMessage
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
