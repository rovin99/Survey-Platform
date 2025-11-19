package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository"
	service "github.com/rovin99/Survey-Platform/ParticipantsManagementService/services"
)

type ParticipantHandler struct {
	service          service.ParticipantService
	quizEvalService  service.QuizEvaluationService
}

func NewParticipantHandler(service service.ParticipantService) *ParticipantHandler {
	return &ParticipantHandler{service: service}
}

func (h *ParticipantHandler) SetQuizEvaluationService(quizEvalService service.QuizEvaluationService) {
	h.quizEvalService = quizEvalService
}

// DTO for Save Draft Request Body
type SaveDraftRequest struct {
	LastQuestionID *uint                  `json:"lastQuestionId" validate:"omitempty,min=1"` // Use pointer for nullability
	DraftAnswers   map[string]interface{} `json:"draftAnswers" validate:"required"`
}

// DTO for Submit Survey Request Body
type SubmitRequest struct {
	Answers     []service.FinalAnswerInput `json:"answers" validate:"required,min=1,dive"`
	CompletedAt string                     `json:"completedAt" validate:"omitempty"`
}

// Validate validates the SaveDraftRequest
func (r *SaveDraftRequest) Validate() error {
	if r.DraftAnswers == nil {
		return fmt.Errorf("draftAnswers is required")
	}
	return nil
}

// Validate validates the SubmitRequest
func (r *SubmitRequest) Validate() error {
	if r.Answers == nil || len(r.Answers) == 0 {
		return fmt.Errorf("answers are required and must not be empty")
	}
	for i, answer := range r.Answers {
		if answer.QuestionID == 0 {
			return fmt.Errorf("answer at index %d has invalid questionId", i)
		}
		if answer.ResponseData == nil {
			return fmt.Errorf("answer at index %d has nil responseData", i)
		}
	}
	return nil
}

// HandleStartOrResumeSurvey godoc
// @Summary Start or Resume Survey Participation
// @Description Finds an existing active session for the participant and survey, or creates a new one. Returns session details and any existing draft answers.
// @Tags Participant
// @Accept json
// @Produce json
// @Param surveyId path int true "Survey ID"
// @Success 200 {object} service.StartResumeResponse
// @Failure 400 {object} fiber.Map "Invalid Survey ID or Participant ID missing"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/surveys/{surveyId}/session [post]
// @Security BearerAuth
func (h *ParticipantHandler) HandleStartOrResumeSurvey(c *fiber.Ctx) error {
	// Validate survey ID
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		log.Printf("[ERROR] Invalid survey ID format: %s, error: %v", surveyIDStr, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid survey ID",
			"message": "Survey ID must be a valid positive integer",
		})
	}

	if surveyID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid survey ID",
			"message": "Survey ID must be greater than 0",
		})
	}

	// Get Participant ID from middleware
	participantIDVal := c.Locals("participantId")
	participantID, ok := participantIDVal.(uint)
	if !ok || participantID == 0 {
		log.Printf("[ERROR] Participant ID missing or invalid in context")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Valid authentication required",
		})
	}

	// Call service to start or resume survey
	log.Printf("[INFO] Starting/Resuming survey - SurveyID: %d, ParticipantID: %d", surveyID, participantID)
	response, err := h.service.StartOrResumeSurvey(c.Context(), uint(surveyID), participantID)
	if err != nil {
		log.Printf("[ERROR] Failed to start/resume survey - SurveyID: %d, ParticipantID: %d, Error: %v", surveyID, participantID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to start survey",
			"message": "Unable to start or resume survey session",
		})
	}

	log.Printf("[SUCCESS] Survey session created/resumed - SurveyID: %d, ParticipantID: %d, SessionID: %d", surveyID, participantID, response.Session.SessionID)
	return c.Status(fiber.StatusOK).JSON(response)
}

// HandleSaveDraft godoc
// @Summary Save Participant Survey Draft
// @Description Saves the participant's current answers and progress for a specific session.
// @Tags Participant
// @Accept json
// @Produce json
// @Param sessionId path int true "Session ID"
// @Param draft body SaveDraftRequest true "Draft data including last question ID and answers"
// @Success 200 {object} fiber.Map "Successfully saved draft"
// @Failure 400 {object} fiber.Map "Invalid Session ID or request body"
// @Failure 404 {object} fiber.Map "Session not found"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/sessions/{sessionId}/draft [put]
// @Security BearerAuth
func (h *ParticipantHandler) HandleSaveDraft(c *fiber.Ctx) error {
	// Validate session ID
	sessionIDStr := c.Params("sessionId")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 64)
	if err != nil {
		log.Printf("[ERROR] Invalid session ID format: %s, error: %v", sessionIDStr, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be a valid positive integer",
		})
	}

	if sessionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be greater than 0",
		})
	}

	// Try to get Participant ID from middleware (may not exist for anonymous users)
	participantIDVal := c.Locals("participantId")
	participantID, hasAuth := participantIDVal.(uint)

	// Parse request body
	var req SaveDraftRequest
	if err := c.BodyParser(&req); err != nil {
		log.Printf("[ERROR] Failed to parse save draft request - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": "Unable to parse request data",
			"details": err.Error(),
		})
	}

	// Validate request
	if err := req.Validate(); err != nil {
		log.Printf("[ERROR] Save draft validation failed - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Validation error",
			"message": err.Error(),
		})
	}

	// If authenticated, verify session belongs to participant
	if hasAuth && participantID != 0 {
		session, err := h.service.GetSession(c.Context(), 0, participantID)
		if err == nil && session != nil && session.SessionID != uint(sessionID) {
			log.Printf("[WARN] Participant %d attempting to access session %d that doesn't belong to them", participantID, sessionID)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "Forbidden",
				"message": "You don't have access to this session",
			})
		}
	}
	// For anonymous users, we trust the sessionID provided (session-based auth via cookies can be added later)

	// Save draft
	log.Printf("[INFO] Saving draft - SessionID: %d, ParticipantID: %d", sessionID, participantID)
	err = h.service.SaveDraft(c.Context(), uint(sessionID), req.LastQuestionID, req.DraftAnswers)
	if err != nil {
		if errors.Is(err, repository.ErrSessionNotFound) {
			log.Printf("[ERROR] Session not found - SessionID: %d", sessionID)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "Session not found",
				"message": "The specified session does not exist",
			})
		}
		log.Printf("[ERROR] Failed to save draft - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to save draft",
			"message": "Unable to save draft progress",
		})
	}

	log.Printf("[SUCCESS] Draft saved - SessionID: %d, ParticipantID: %d", sessionID, participantID)
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Draft saved successfully",
	})
}

// HandleSubmitSurvey godoc
// @Summary Submit Survey Answers
// @Description Submits the participant's final answers for a specific session, marks the session as completed, and deletes the draft.
// @Tags Participant
// @Accept json
// @Produce json
// @Param sessionId path int true "Session ID"
// @Param answers body SubmitRequest true "Final answers"
// @Success 200 {object} fiber.Map "Successfully submitted survey"
// @Failure 400 {object} fiber.Map "Invalid Session ID or request body"
// @Failure 404 {object} fiber.Map "Session not found"
// @Failure 409 {object} fiber.Map "Session not in progress"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/sessions/{sessionId}/submit [post]
// @Security BearerAuth
func (h *ParticipantHandler) HandleSubmitSurvey(c *fiber.Ctx) error {
	// Validate session ID
	sessionIDStr := c.Params("sessionId")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 64)
	if err != nil {
		log.Printf("[ERROR] Invalid session ID format: %s, error: %v", sessionIDStr, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be a valid positive integer",
		})
	}

	if sessionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be greater than 0",
		})
	}

	// Try to get Participant ID from middleware (may not exist for anonymous users)
	participantIDVal := c.Locals("participantId")
	participantID, _ := participantIDVal.(uint)
	// Anonymous users are allowed for public surveys

	// Parse request body
	var req SubmitRequest
	if err := c.BodyParser(&req); err != nil {
		log.Printf("[ERROR] Failed to parse submit request - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": "Unable to parse request data",
			"details": err.Error(),
		})
	}

	// Validate request
	if err := req.Validate(); err != nil {
		log.Printf("[ERROR] Submit validation failed - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Validation error",
			"message": err.Error(),
		})
	}

	// Submit survey
	log.Printf("[INFO] Submitting survey - SessionID: %d, ParticipantID: %d, AnswerCount: %d", sessionID, participantID, len(req.Answers))
	err = h.service.SubmitSurvey(c.Context(), uint(sessionID), req.Answers)
	if err != nil {
		if errors.Is(err, repository.ErrSessionNotFound) {
			log.Printf("[ERROR] Session not found - SessionID: %d", sessionID)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "Session not found",
				"message": "The specified session does not exist",
			})
		}
		// Handle conflict error (session not in progress)
		if err.Error() == "survey session is not in progress" {
			log.Printf("[WARN] Attempted to submit non-active session - SessionID: %d", sessionID)
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":   "Invalid session state",
				"message": "Survey session is not in progress",
			})
		}

		log.Printf("[ERROR] Failed to submit survey - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to submit survey",
			"message": "Unable to submit survey answers",
		})
	}

	log.Printf("[SUCCESS] Survey submitted - SessionID: %d, ParticipantID: %d", sessionID, participantID)
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Survey submitted successfully",
		"data": fiber.Map{
			"sessionId": sessionID,
		},
	})
}

// HandleGetSession godoc
// @Summary Get Session Information
// @Description Gets the current session information for a survey and participant
// @Tags Participant
// @Accept json
// @Produce json
// @Param surveyId path int true "Survey ID"
// @Success 200 {object} service.StartResumeResponse
// @Failure 400 {object} fiber.Map "Invalid Survey ID or Participant ID missing"
// @Failure 404 {object} fiber.Map "Session not found"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/surveys/{surveyId}/session [get]
// @Security BearerAuth
func (h *ParticipantHandler) HandleGetSession(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid survey ID format"})
	}

	// Get Participant ID from middleware
	participantIDVal := c.Locals("participantId")
	participantID, ok := participantIDVal.(uint)
	if !ok || participantID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Participant ID missing or invalid"})
	}

	// In development mode, we can just reuse the StartOrResumeSurvey logic
	// since it will find or create a session
	response, err := h.service.StartOrResumeSurvey(c.Context(), uint(surveyID), participantID)
	if err != nil {
		// Log the error for debugging
		log.Printf("Failed to get survey session for surveyID=%d, participantID=%d: %v", surveyID, participantID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get survey session", "details": err.Error()})
	}

	// Log successful response
	log.Printf("Successfully served session for surveyID=%d, participantID=%d", surveyID, participantID)
	return c.Status(fiber.StatusOK).JSON(response)
}

// HandleStartSessionViaShareLink godoc
// @Summary Start Session via Share Link
// @Description Validates access via share token and starts a new session if authorized. Supports anonymous access.
// @Tags Participant
// @Accept json
// @Produce json
// @Param token query string true "Share Token"
// @Success 200 {object} service.StartResumeResponse
// @Failure 400 {object} fiber.Map "Invalid or missing share token"
// @Failure 403 {object} fiber.Map "Access denied"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/surveys/public/start [post]
func (h *ParticipantHandler) HandleStartSessionViaShareLink(c *fiber.Ctx) error {
	// Get share token from query
	shareToken := c.Query("token")
	if shareToken == "" {
		log.Printf("[ERROR] Share token missing from request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Missing share token",
			"message": "Share token is required",
		})
	}

	// Try to get Participant ID from middleware (may not exist for anonymous users)
	participantIDVal := c.Locals("participantId")
	participantID, hasAuth := participantIDVal.(uint)
	if !hasAuth || participantID == 0 {
		// Anonymous user - create a guest participant ID
		// For now, we'll use a special guest participant ID (1)
		// In production, you might want to create actual guest participants in AuthService
		participantID = 1 // Guest participant ID
		log.Printf("[INFO] Anonymous user accessing share link, using guest participant ID: %d", participantID)
	}

	// Validate access with SurveyManagementService
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:3002"
	}

	validateURL := fmt.Sprintf("%s/api/v1/surveys/public/validate-access?token=%s", surveyServiceURL, shareToken)

	// Get auth token from request
	authToken := c.Get("Authorization")

	req, err := http.NewRequest("POST", validateURL, nil)
	if err != nil {
		log.Printf("[ERROR] Failed to create validation request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Internal error",
			"message": "Failed to validate access",
		})
	}

	// Forward authorization header
	if authToken != "" {
		req.Header.Set("Authorization", authToken)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[ERROR] Failed to call validation endpoint: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Service unavailable",
			"message": "Unable to validate access",
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errorResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errorResp)
		log.Printf("[WARN] Access denied for token %s, participant %d: %v", shareToken, participantID, errorResp)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Access denied",
			"message": "You are not authorized to access this survey",
			"details": errorResp,
		})
	}

	// Parse validation response
	var validationResp struct {
		Success bool `json:"success"`
		Data    struct {
			SurveyID uint   `json:"surveyId"`
			Title    string `json:"title"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&validationResp); err != nil {
		log.Printf("[ERROR] Failed to parse validation response: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Internal error",
			"message": "Failed to process validation response",
		})
	}

	if !validationResp.Success || validationResp.Data.SurveyID == 0 {
		log.Printf("[ERROR] Invalid validation response for token %s", shareToken)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Access denied",
			"message": "Invalid access validation",
		})
	}

	// Start or resume survey session
	surveyID := validationResp.Data.SurveyID
	log.Printf("[INFO] Access granted for token %s - Starting session for SurveyID: %d, ParticipantID: %d", shareToken, surveyID, participantID)

	response, err := h.service.StartOrResumeSurvey(c.Context(), surveyID, participantID)
	if err != nil {
		log.Printf("[ERROR] Failed to start survey session - SurveyID: %d, ParticipantID: %d, Error: %v", surveyID, participantID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to start session",
			"message": "Unable to create survey session",
		})
	}

	log.Printf("[SUCCESS] Session started via share link - SurveyID: %d, ParticipantID: %d, SessionID: %d", surveyID, participantID, response.Session.SessionID)
	return c.Status(fiber.StatusOK).JSON(response)
}

// HandleGetSurveyResults godoc
// @Summary Get Survey Results/Analytics
// @Description Gets all sessions and responses for a survey for conductor analytics
// @Tags Participant
// @Accept json
// @Produce json
// @Param surveyId path int true "Survey ID"
// @Success 200 {object} service.SurveyResultsResponse
// @Failure 400 {object} fiber.Map "Invalid Survey ID"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/surveys/{surveyId}/results [get]
// @Security BearerAuth
func (h *ParticipantHandler) HandleGetSurveyResults(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		log.Printf("[ERROR] Invalid survey ID format: %s", surveyIDStr)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid survey ID",
			"message": "Survey ID must be a valid positive integer",
		})
	}

	if surveyID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid survey ID",
			"message": "Survey ID must be greater than 0",
		})
	}

	log.Printf("[INFO] Fetching survey results for SurveyID: %d", surveyID)
	results, err := h.service.GetSurveyResults(c.Context(), uint(surveyID))
	if err != nil {
		log.Printf("[ERROR] Failed to get survey results - SurveyID: %d, Error: %v", surveyID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get survey results",
			"message": "Unable to retrieve survey analytics",
		})
	}

	log.Printf("[SUCCESS] Retrieved survey results - SurveyID: %d, TotalSessions: %d, CompletedSessions: %d",
		surveyID, results.TotalSessions, results.CompletedSessions)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    results,
	})
}

// HandleGetSessionResponses godoc
// @Summary Get Session Responses
// @Description Gets all answers for a specific session
// @Tags Participant
// @Accept json
// @Produce json
// @Param sessionId path int true "Session ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map "Invalid Session ID"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/sessions/{sessionId}/responses [get]
// @Security BearerAuth
func (h *ParticipantHandler) HandleGetSessionResponses(c *fiber.Ctx) error {
	sessionIDStr := c.Params("sessionId")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 64)
	if err != nil {
		log.Printf("[ERROR] Invalid session ID format: %s", sessionIDStr)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be a valid positive integer",
		})
	}

	if sessionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be greater than 0",
		})
	}

	log.Printf("[INFO] Fetching responses for SessionID: %d", sessionID)
	answers, err := h.service.GetSessionResponses(c.Context(), uint(sessionID))
	if err != nil {
		log.Printf("[ERROR] Failed to get session responses - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get session responses",
			"message": "Unable to retrieve session answers",
		})
	}

	log.Printf("[SUCCESS] Retrieved session responses - SessionID: %d, AnswerCount: %d", sessionID, len(answers))

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    answers,
	})
}

// HandleEvaluateQuiz godoc
// @Summary Evaluate Quiz
// @Description Evaluates a quiz session and returns score, pass/fail, and detailed results
// @Tags Participant
// @Accept json
// @Produce json
// @Param sessionId path int true "Session ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map "Invalid Session ID"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/sessions/{sessionId}/evaluate [post]
func (h *ParticipantHandler) HandleEvaluateQuiz(c *fiber.Ctx) error {
	sessionIDStr := c.Params("sessionId")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 64)
	if err != nil {
		log.Printf("[ERROR] Invalid session ID format: %s", sessionIDStr)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be a valid positive integer",
		})
	}

	if sessionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be greater than 0",
		})
	}

	log.Printf("[INFO] Evaluating quiz for session ID: %d", sessionID)

	result, err := h.quizEvalService.EvaluateQuiz(c.Context(), uint(sessionID))
	if err != nil {
		log.Printf("[ERROR] Failed to evaluate quiz - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to evaluate quiz",
			"message": err.Error(),
		})
	}

	log.Printf("[SUCCESS] Quiz evaluated - SessionID: %d, Score: %d/%d (%.1f%%)",
		sessionID, result.Score, result.TotalPoints, result.Percentage)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}
