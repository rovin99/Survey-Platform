package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/models"
	service "github.com/rovin99/Survey-Platform/ParticipantsManagementService/services"
)

type EvaluationHandler struct {
	evalService service.EvaluationService
}

func NewEvaluationHandler(evalService service.EvaluationService) *EvaluationHandler {
	return &EvaluationHandler{evalService: evalService}
}

// GetPendingEvaluations returns all sessions pending evaluation for a survey
// GET /api/participant/surveys/:surveyId/pending-evaluations
func (h *EvaluationHandler) GetPendingEvaluations(c *fiber.Ctx) error {
	surveyID, err := strconv.ParseUint(c.Params("surveyId"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid survey ID"})
	}

	// Get conductor ID from context (set by auth middleware)
	conductorID, ok := c.Locals("conductorId").(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized - conductor ID not found"})
	}

	pending, err := h.evalService.GetPendingEvaluations(c.Context(), uint(surveyID), conductorID)
	if err != nil {
		if err == service.ErrUnauthorizedEvaluation {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "not authorized to view evaluations for this survey"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"pending_count": len(pending),
		"sessions":      pending,
	})
}

// GetSessionForEvaluation returns a session with its answers for evaluation
// GET /api/participant/sessions/:sessionId/for-evaluation
func (h *EvaluationHandler) GetSessionForEvaluation(c *fiber.Ctx) error {
	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid session ID"})
	}

	conductorID, ok := c.Locals("conductorId").(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized - conductor ID not found"})
	}

	session, answers, err := h.evalService.GetSessionForEvaluation(c.Context(), uint(sessionID), conductorID)
	if err != nil {
		if err == service.ErrUnauthorizedEvaluation {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "not authorized to evaluate this session"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"session": session,
		"answers": answers,
	})
}

// SaveQuestionEvaluation saves evaluation for a single question (auto-save)
// POST /api/participant/sessions/:sessionId/evaluation/question
func (h *EvaluationHandler) SaveQuestionEvaluation(c *fiber.Ctx) error {
	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid session ID"})
	}

	conductorID, ok := c.Locals("conductorId").(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized - conductor ID not found"})
	}

	var input service.QuestionEvaluationInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid input: " + err.Error()})
	}

	err = h.evalService.SaveQuestionEvaluation(c.Context(), uint(sessionID), input, conductorID)
	if err != nil {
		if err == service.ErrUnauthorizedEvaluation {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "not authorized to evaluate this session"})
		}
		if err == service.ErrInvalidMarks {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "marks cannot exceed max marks or be negative"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "evaluation saved"})
}

// SubmitEvaluation submits the complete evaluation for a session
// POST /api/participant/sessions/:sessionId/evaluate
func (h *EvaluationHandler) SubmitEvaluation(c *fiber.Ctx) error {
	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid session ID"})
	}

	conductorID, ok := c.Locals("conductorId").(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized - conductor ID not found"})
	}

	var input struct {
		Evaluations    []service.QuestionEvaluationInput `json:"evaluations"`
		NotifyByEmail  bool                               `json:"notify_by_email"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid input: " + err.Error()})
	}

	submission := service.EvaluationSubmission{
		SessionID:   uint(sessionID),
		Evaluations: input.Evaluations,
	}

	result, err := h.evalService.SubmitEvaluation(c.Context(), submission, conductorID)
	if err != nil {
		if err == service.ErrUnauthorizedEvaluation {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "not authorized to evaluate this session"})
		}
		if err == service.ErrSessionNotCompleted {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "session is not completed"})
		}
		if err == service.ErrNotPendingEvaluation {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "session is not pending evaluation"})
		}
		if err == service.ErrInvalidMarks {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "marks cannot exceed max marks or be negative"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Send email notification to participant if requested
	if input.NotifyByEmail {
		go func() {
			session, err := h.evalService.GetSessionForNotification(context.Background(), uint(sessionID))
			if err != nil {
				log.Printf("[WARN] Failed to get session for notification - SessionID: %d, Error: %v", sessionID, err)
				return
			}
			if session.Email == "" {
				log.Printf("[WARN] No email for session %d, skipping notification", sessionID)
				return
			}

			passed := ""
			if result.MaxScore > 0 {
				if result.Percentage >= 60 {
					passed = "Passed"
				} else {
					passed = "Not Passed"
				}
			}

			sendResultsEmail(session.Email, session.SurveyTitle, result.TotalScore, result.MaxScore, result.Percentage, passed, result.Evaluations, session.QuestionMap)
		}()
	}

	return c.JSON(fiber.Map{
		"message": "evaluation submitted successfully",
		"result":  result,
	})
}

// GetEvaluationResult returns the evaluation result for a session
// GET /api/participant/sessions/:sessionId/evaluation-results
func (h *EvaluationHandler) GetEvaluationResult(c *fiber.Ctx) error {
	sessionID, err := strconv.ParseUint(c.Params("sessionId"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid session ID"})
	}

	result, err := h.evalService.GetEvaluationResult(c.Context(), uint(sessionID))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(result)
}

// sendResultsEmail sends quiz results to participant via SurveyManagementService email API
func sendResultsEmail(email, surveyTitle string, totalScore, maxScore, percentage float64, passStatus string, evaluations []models.QuestionEvaluation, questionMap map[uint]string) {
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:5172"
	}

	// Build per-question breakdown
	var questionBreakdown string
	for i, eval := range evaluations {
		qText := questionMap[eval.QuestionID]
		if qText == "" {
			qText = fmt.Sprintf("Question %d", eval.QuestionID)
		}
		// Truncate long question text
		if len(qText) > 60 {
			qText = qText[:60] + "..."
		}
		feedback := ""
		if eval.Feedback != "" {
			feedback = fmt.Sprintf("  Feedback: %s", eval.Feedback)
		}
		questionBreakdown += fmt.Sprintf("  Q%d. %s\n      Marks: %.0f / %.0f%s\n", i+1, qText, eval.MarksGiven, eval.MaxMarks, feedback)
	}

	subject := fmt.Sprintf("Your Results: %s", surveyTitle)
	body := fmt.Sprintf(
		"Hello,\n\nYour quiz \"%s\" has been evaluated.\n\n"+
			"═══════════════════════════════\n"+
			"  Score: %.0f / %.0f\n"+
			"  Percentage: %.1f%%\n"+
			"  Status: %s\n"+
			"═══════════════════════════════\n\n"+
			"Question-wise Breakdown:\n"+
			"───────────────────────────────\n"+
			"%s"+
			"───────────────────────────────\n\n"+
			"You can view detailed results by logging in to the platform.\n\n"+
			"Best regards,\nSurvey Platform",
		surveyTitle, totalScore, maxScore, percentage, passStatus, questionBreakdown,
	)

	payload, _ := json.Marshal(map[string]string{
		"to":      email,
		"subject": subject,
		"body":    body,
	})

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("POST", surveyServiceURL+"/api/email/send", bytes.NewBuffer(payload))
	if err != nil {
		log.Printf("[ERROR] Failed to create email request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if key := os.Getenv("INTERNAL_API_KEY"); key != "" {
		req.Header.Set("X-Internal-API-Key", key)
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[ERROR] Failed to send results email to %s: %v", email, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 300 {
		log.Printf("[SUCCESS] Results email sent to %s for survey '%s'", email, surveyTitle)
	} else {
		log.Printf("[WARN] Email service returned %d for %s", resp.StatusCode, email)
	}
}
