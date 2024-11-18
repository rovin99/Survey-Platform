package handler

import (
	
	"github.com/rovin99/Survey-Platform/SurveyManagementService/service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/gofiber/fiber/v2"
	
)
type SurveyHandler struct {
	surveyService *service.SurveyService
}

func NewSurveyHandler(ss *service.SurveyService) *SurveyHandler {
	return &SurveyHandler{surveyService: ss}
}

func (h *SurveyHandler) CreateSurvey(c *fiber.Ctx) error {
	var survey models.Survey
	if err := c.BodyParser(&survey); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := h.surveyService.CreateSurvey(&survey); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(survey)
}

func (h *SurveyHandler) GetSurvey(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	survey, err := h.surveyService.GetSurvey(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Survey not found",
		})
	}

	return c.JSON(survey)
}
func (h *SurveyHandler) ListSurveys(c *fiber.Ctx) error {
	surveys, err := h.surveyService.ListSurveys()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(surveys)
}

func (h *SurveyHandler) UpdateSurvey(c *fiber.Ctx) error {

	var survey models.Survey
	if err := c.BodyParser(&survey); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	survey.SurveyID = uint(id)

	if err := h.surveyService.UpdateSurvey(&survey); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(survey)
}

func (h *SurveyHandler) DeleteSurvey(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	if err := h.surveyService.DeleteSurvey(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *SurveyHandler) AddQuestion(c *fiber.Ctx) error {
	var question models.Question
	if err := c.BodyParser(&question); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	surveyID, err := c.ParamsInt("surveyID")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	question.SurveyID = uint(surveyID)

	if err := h.surveyService.AddQuestion(&question); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(question)
}

func (h *SurveyHandler) GetQuestion(c *fiber.Ctx) error {
	questionID, err := c.ParamsInt("questionID")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid question ID",
		})
	}

	question, err := h.surveyService.GetQuestion(uint(questionID))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Question not found",
		})
	}

	return c.JSON(question)
}

func (h *SurveyHandler) UpdateQuestion(c *fiber.Ctx) {

	var question models.Question
	if err := c.BodyParser(&question); err != nil {
		c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
		return
	}

	questionID, err := c.ParamsInt("questionID")
	if err != nil {
		c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid question ID",
		})
		return
	}

	question.QuestionID = uint(questionID)

	if err := h.surveyService.UpdateQuestion(&question); err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
		return
	}

	c.JSON(question)
}

func (h *SurveyHandler) DeleteQuestion(c *fiber.Ctx) {
	questionID, err := c.ParamsInt("questionID")
	if err != nil {
		c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid question ID",
		})
		return
	}

	if err := h.surveyService.DeleteQuestion(uint(questionID)); err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
		return
	}

	c.SendStatus(fiber.StatusNoContent)
}