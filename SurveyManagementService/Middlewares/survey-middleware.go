package middlewares

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/utils/response"
)

// ValidationError represents a structured validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// SurveyValidationMiddleware validates survey creation/update requests
func SurveyValidationMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		var survey models.Survey
		if err := c.BodyParser(&survey); err != nil {
			return response.BadRequest(c, "Invalid request body")
		}

		errors := validateSurvey(&survey)
		if len(errors) > 0 {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"errors":  errors,
			})
		}

		return c.Next()
	}
}

func validateSurvey(survey *models.Survey) []ValidationError {
	var errors []ValidationError

	// Validate basic survey information
	if strings.TrimSpace(survey.Title) == "" {
		errors = append(errors, ValidationError{
			Field:   "title",
			Message: "Survey title is required",
		})
	} else if len(survey.Title) > 200 {
		errors = append(errors, ValidationError{
			Field:   "title",
			Message: "Survey title must not exceed 200 characters",
		})
	}

	if strings.TrimSpace(survey.Description) == "" {
		errors = append(errors, ValidationError{
			Field:   "description",
			Message: "Survey description is required",
		})
	}

	if survey.ConductorID == 0 {
		errors = append(errors, ValidationError{
			Field:   "conductor_id",
			Message: "Conductor ID is required",
		})
	}

	// Validate questions if present
	if len(survey.Questions) > 0 {
		questionErrors := validateQuestions(survey.Questions)
		errors = append(errors, questionErrors...)
	}

	return errors
}

func validateQuestions(questions []models.Question) []ValidationError {
	var errors []ValidationError
	seenOrderIndexes := make(map[int]bool)

	for i, question := range questions {
		// Validate question text
		if strings.TrimSpace(question.QuestionText) == "" {
			errors = append(errors, ValidationError{
				Field:   fmt.Sprintf("questions[%d].question_text", i),
				Message: "Question text is required",
			})
		}

		// Validate question type
		if !isValidQuestionType(question.QuestionType) {
			errors = append(errors, ValidationError{
				Field:   fmt.Sprintf("questions[%d].question_type", i),
				Message: "Invalid question type",
			})
		}

		// Validate order index
		if question.OrderIndex <= 0 {
			errors = append(errors, ValidationError{
				Field:   fmt.Sprintf("questions[%d].order_index", i),
				Message: "Order index must be positive",
			})
		}
		if seenOrderIndexes[question.OrderIndex] {
			errors = append(errors, ValidationError{
				Field:   fmt.Sprintf("questions[%d].order_index", i),
				Message: "Duplicate order index",
			})
		}
		seenOrderIndexes[question.OrderIndex] = true

		// Validate branching logic if present
		if question.BranchingLogic != "" {
			if err := validateBranchingLogic(question.BranchingLogic); err != nil {
				errors = append(errors, ValidationError{
					Field:   fmt.Sprintf("questions[%d].branching_logic", i),
					Message: err.Error(),
				})
			}
		}
	}

	return errors
}

func isValidQuestionType(qType string) bool {
	validTypes := map[string]bool{
		"TEXT":            true,
		"MULTIPLE_CHOICE": true,
		"SINGLE_CHOICE":   true,
		"RATING":          true,
		"DATE":            true,
		"FILE_UPLOAD":     true,
	}
	return validTypes[strings.ToUpper(qType)]
}

func validateBranchingLogic(logic string) error {
	var branchingRule struct {
		Condition    string `json:"condition"`
		NextQuestion uint   `json:"next_question"`
	}

	if err := json.Unmarshal([]byte(logic), &branchingRule); err != nil {
		return fmt.Errorf("invalid branching logic format")
	}

	if branchingRule.Condition == "" {
		return fmt.Errorf("branching condition is required")
	}

	if branchingRule.NextQuestion == 0 {
		return fmt.Errorf("next question ID is required")
	}

	return nil
}

// QuestionSectionValidationMiddleware validates question section updates
func QuestionSectionValidationMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		var section struct {
			Questions      []models.Question        `json:"questions"`
			MediaFiles     []models.SurveyMediaFile `json:"media_files"`
			BranchingLogic string                   `json:"branching_logic"`
		}

		if err := c.BodyParser(&section); err != nil {
			return response.BadRequest(c, "Invalid request body")
		}

		var errors []ValidationError

		// Validate questions
		if len(section.Questions) == 0 {
			errors = append(errors, ValidationError{
				Field:   "questions",
				Message: "At least one question is required",
			})
		} else {
			questionErrors := validateQuestions(section.Questions)
			errors = append(errors, questionErrors...)
		}

		// Validate media files
		for i, media := range section.MediaFiles {
			if media.FileURL == "" {
				errors = append(errors, ValidationError{
					Field:   fmt.Sprintf("media_files[%d].file_url", i),
					Message: "File URL is required",
				})
			}
			if !isValidMediaType(media.FileType) {
				errors = append(errors, ValidationError{
					Field:   fmt.Sprintf("media_files[%d].file_type", i),
					Message: "Invalid media type",
				})
			}
		}

		if len(errors) > 0 {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"errors":  errors,
			})
		}

		return c.Next()
	}
}

func isValidMediaType(mediaType string) bool {
	validTypes := map[string]bool{
		"IMAGE":    true,
		"VIDEO":    true,
		"AUDIO":    true,
		"DOCUMENT": true,
	}
	return validTypes[strings.ToUpper(mediaType)]
}

// PublishSurveyValidationMiddleware validates if a survey can be published
func PublishSurveyValidationMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		var survey models.Survey
		if err := c.BodyParser(&survey); err != nil {
			return response.BadRequest(c, "Invalid request body")
		}

		var errors []ValidationError

		// Check if basic info is complete
		if strings.TrimSpace(survey.Title) == "" || strings.TrimSpace(survey.Description) == "" {
			errors = append(errors, ValidationError{
				Field:   "basic_info",
				Message: "Survey title and description are required for publication",
			})
		}

		// Check if there are questions
		if len(survey.Questions) == 0 {
			errors = append(errors, ValidationError{
				Field:   "questions",
				Message: "At least one question is required for publication",
			})
		}

		// Validate mandatory questions have proper validation
		for i, question := range survey.Questions {
			if question.Mandatory {
				if question.QuestionType == "TEXT" && !strings.Contains(question.BranchingLogic, "validation") {
					errors = append(errors, ValidationError{
						Field:   fmt.Sprintf("questions[%d]", i),
						Message: "Mandatory text questions must have validation rules",
					})
				}
			}
		}

		if len(errors) > 0 {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"success": false,
				"errors":  errors,
			})
		}

		return c.Next()
	}
}
