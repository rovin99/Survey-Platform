package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/response"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

type OptionHandler struct {
	optionService service.OptionService
}

func NewOptionHandler(optionService service.OptionService) *OptionHandler {
	return &OptionHandler{
		optionService: optionService,
	}
}

type CreateOptionRequest struct {
	QuestionID uint   `json:"question_id" validate:"required"`
	OptionText string `json:"option_text" validate:"required"`
}

type BatchCreateOptionsRequest struct {
	Options []CreateOptionRequest `json:"options" validate:"required,dive"`
}

func (h *OptionHandler) CreateOption(c *fiber.Ctx) error {
	var req CreateOptionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	option := &models.Option{
		QuestionID: req.QuestionID,
		OptionText: req.OptionText,
	}

	if err := h.optionService.CreateOption(c.Context(), option); err != nil {
		return response.InternalServerError(c, "Failed to create option: "+err.Error())
	}

	return response.Success(c, option, "Option created successfully", fiber.StatusCreated)
}

func (h *OptionHandler) GetOption(c *fiber.Ctx) error {
	optionID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid option ID")
	}

	option, err := h.optionService.GetOptionByID(c.Context(), uint(optionID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get option: "+err.Error())
	}

	return response.Success(c, option, "Option retrieved successfully")
}

func (h *OptionHandler) GetOptionsByQuestion(c *fiber.Ctx) error {
	questionID, err := c.ParamsInt("question_id")
	if err != nil {
		return response.BadRequest(c, "Invalid question ID")
	}

	options, err := h.optionService.GetOptionsByQuestionID(c.Context(), uint(questionID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get options: "+err.Error())
	}

	return response.Success(c, options, "Options retrieved successfully")
}

func (h *OptionHandler) UpdateOption(c *fiber.Ctx) error {
	optionID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid option ID")
	}

	var req CreateOptionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	option := &models.Option{
		OptionID:   uint(optionID),
		QuestionID: req.QuestionID,
		OptionText: req.OptionText,
	}

	if err := h.optionService.UpdateOption(c.Context(), option); err != nil {
		return response.InternalServerError(c, "Failed to update option: "+err.Error())
	}

	return response.Success(c, option, "Option updated successfully")
}

func (h *OptionHandler) DeleteOption(c *fiber.Ctx) error {
	optionID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid option ID")
	}

	if err := h.optionService.DeleteOption(c.Context(), uint(optionID)); err != nil {
		return response.InternalServerError(c, "Failed to delete option: "+err.Error())
	}

	return response.Success(c, nil, "Option deleted successfully")
}

func (h *OptionHandler) BatchCreateOptions(c *fiber.Ctx) error {
	var req BatchCreateOptionsRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if len(req.Options) == 0 {
		return response.BadRequest(c, "No options provided")
	}

	// Convert request to models
	options := make([]models.Option, len(req.Options))
	for i, opt := range req.Options {
		options[i] = models.Option{
			QuestionID: opt.QuestionID,
			OptionText: opt.OptionText,
		}
	}

	if err := h.optionService.BatchCreateOptions(c.Context(), options); err != nil {
		return response.InternalServerError(c, "Failed to create options: "+err.Error())
	}

	return response.Success(c, options, "Options created successfully", fiber.StatusCreated)
}
