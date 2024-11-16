package handler

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