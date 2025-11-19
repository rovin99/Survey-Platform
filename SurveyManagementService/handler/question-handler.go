package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/response"
)

type QuestionHandler struct {
	questionService service.QuestionService
}

func NewQuestionHandler(questionService service.QuestionService) *QuestionHandler {
	return &QuestionHandler{
		questionService: questionService,
	}
}

type CreateQuestionRequest struct {
	SurveyID       uint            `json:"survey_id" validate:"required"`
	QuestionText   string          `json:"question_text" validate:"required"`
	QuestionType   string          `json:"question_type" validate:"required"`
	Mandatory      bool            `json:"mandatory"`
	BranchingLogic string          `json:"branching_logic"`
	CorrectAnswers string          `json:"correct_answers"`
	Options        []models.Option `json:"options"`
}

func (h *QuestionHandler) CreateQuestion(c *fiber.Ctx) error {
	var req CreateQuestionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Create a new question model from the request
	question := &models.Question{
		SurveyID:       req.SurveyID,
		QuestionText:   req.QuestionText,
		QuestionType:   req.QuestionType,
		Mandatory:      req.Mandatory,
		BranchingLogic: req.BranchingLogic,
		CorrectAnswers: req.CorrectAnswers,
	}

	// If we have options and the question type is multiple choice or single choice
	// use the CreateQuestionWithOptions method
	if (req.QuestionType == "MULTIPLE_CHOICE" || req.QuestionType == "SINGLE_CHOICE") && len(req.Options) > 0 {
		if err := h.questionService.CreateQuestionWithOptions(c.Context(), question, req.Options); err != nil {
			return response.InternalServerError(c, "Failed to create question with options: "+err.Error())
		}
	} else {
		// Otherwise just create the question
		if err := h.questionService.CreateQuestion(c.Context(), question); err != nil {
			return response.InternalServerError(c, "Failed to create question: "+err.Error())
		}
	}

	return response.Success(c, question, "Question created successfully", fiber.StatusCreated)
}

func (h *QuestionHandler) GetQuestion(c *fiber.Ctx) error {
	questionID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid question ID")
	}

	question, err := h.questionService.GetQuestionByID(c.Context(), uint(questionID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get question: "+err.Error())
	}

	return response.Success(c, question, "Question retrieved successfully")
}

func (h *QuestionHandler) GetQuestionsBySurvey(c *fiber.Ctx) error {
	surveyID, err := c.ParamsInt("survey_id")
	if err != nil {
		return response.BadRequest(c, "Invalid survey ID")
	}

	questions, err := h.questionService.GetQuestionsBySurveyID(c.Context(), uint(surveyID))
	if err != nil {
		return response.InternalServerError(c, "Failed to get questions: "+err.Error())
	}

	return response.Success(c, questions, "Questions retrieved successfully")
}

func (h *QuestionHandler) UpdateQuestion(c *fiber.Ctx) error {
	questionID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid question ID")
	}

	var req CreateQuestionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	question := &models.Question{
		QuestionID:     uint(questionID),
		SurveyID:       req.SurveyID,
		QuestionText:   req.QuestionText,
		QuestionType:   req.QuestionType,
		Mandatory:      req.Mandatory,
		BranchingLogic: req.BranchingLogic,
		CorrectAnswers: req.CorrectAnswers,
	}

	if err := h.questionService.UpdateQuestion(c.Context(), question); err != nil {
		return response.InternalServerError(c, "Failed to update question: "+err.Error())
	}

	return response.Success(c, question, "Question updated successfully")
}

func (h *QuestionHandler) DeleteQuestion(c *fiber.Ctx) error {
	questionID, err := c.ParamsInt("id")
	if err != nil {
		return response.BadRequest(c, "Invalid question ID")
	}

	if err := h.questionService.DeleteQuestion(c.Context(), uint(questionID)); err != nil {
		return response.InternalServerError(c, "Failed to delete question: "+err.Error())
	}

	return response.Success(c, nil, "Question deleted successfully")
}
