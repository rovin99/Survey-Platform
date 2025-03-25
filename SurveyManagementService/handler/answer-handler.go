package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/utils/response"
)

type AnswerHandler struct {
	answerService service.AnswerService
}

func NewAnswerHandler(answerService service.AnswerService) *AnswerHandler {
	return &AnswerHandler{
		answerService: answerService,
	}
}

type CreateAnswerRequest struct {
	SessionID    uint   `json:"session_id" validate:"required"`
	QuestionID   uint   `json:"question_id" validate:"required"`
	ResponseData string `json:"response_data" validate:"required"`
}

type BulkAnswerRequest struct {
	SessionID uint                  `json:"session_id" validate:"required"`
	Answers   []CreateAnswerRequest `json:"answers" validate:"required,dive"`
}

func (h *AnswerHandler) CreateAnswer(c *fiber.Ctx) error {
	var req CreateAnswerRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	answer := &models.Answer{
		SessionID:    req.SessionID,
		QuestionID:   req.QuestionID,
		ResponseData: req.ResponseData,
	}

	if err := h.answerService.CreateAnswer(c.Context(), answer); err != nil {
		return response.InternalServerError(c, "Failed to create answer: "+err.Error())
	}

	return response.Success(c, answer, "Answer created successfully", fiber.StatusCreated)
}

func (h *AnswerHandler) GetAnswersBySession(c *fiber.Ctx) error {
	sessionID, err := c.ParamsInt("session_id")
	if err != nil {
		return response.BadRequest(c, "Invalid session ID")
	}

	answers, err := h.answerService.GetAnswersBySession(c.Context(), uint(sessionID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get answers: "+err.Error())
	}

	return response.Success(c, answers, "Answers retrieved successfully")
}

func (h *AnswerHandler) GetAnswersByQuestion(c *fiber.Ctx) error {
	questionID, err := c.ParamsInt("question_id")
	if err != nil {
		return response.BadRequest(c, "Invalid question ID")
	}

	answers, err := h.answerService.GetAnswersByQuestion(c.Context(), uint(questionID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get answers: "+err.Error())
	}

	return response.Success(c, answers, "Answers retrieved successfully")
}

func (h *AnswerHandler) SubmitBulkAnswers(c *fiber.Ctx) error {
	var req BulkAnswerRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if len(req.Answers) == 0 {
		return response.BadRequest(c, "No answers provided")
	}

	// Convert request to models
	answers := make([]models.Answer, len(req.Answers))
	for i, ans := range req.Answers {
		answers[i] = models.Answer{
			SessionID:    req.SessionID,
			QuestionID:   ans.QuestionID,
			ResponseData: ans.ResponseData,
		}
	}

	if err := h.answerService.SubmitBulkAnswers(c.Context(), req.SessionID, answers); err != nil {
		return response.InternalServerError(c, "Failed to submit answers: "+err.Error())
	}

	return response.Success(c, nil, "Answers submitted successfully", fiber.StatusCreated)
}
