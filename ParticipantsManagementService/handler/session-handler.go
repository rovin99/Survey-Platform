package handler

import (
	"errors"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository"
	service "github.com/rovin99/Survey-Platform/ParticipantsManagementService/services"
)

type ParticipantHandler struct {
	service service.ParticipantService
}

func NewParticipantHandler(service service.ParticipantService) *ParticipantHandler {
	return &ParticipantHandler{service: service}
}

// DTO for Save Draft Request Body
type SaveDraftRequest struct {
	LastQuestionID *uint                  `json:"lastQuestionId"` // Use pointer for nullability
	DraftAnswers   map[string]interface{} `json:"draftAnswers"`
}

// DTO for Submit Survey Request Body
type SubmitRequest struct {
	Answers []service.FinalAnswerInput `json:"answers"`
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
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid survey ID format"})
	}

	// --- Get Participant ID (Example: from middleware) ---
	participantIDVal := c.Locals("participantId") // Assuming middleware sets this
	participantID, ok := participantIDVal.(uint)  // Adjust type assertion as needed (e.g., string conversion)
	if !ok || participantID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Participant ID missing or invalid"})
	}
	// --- End Get Participant ID ---

	response, err := h.service.StartOrResumeSurvey(c.Context(), uint(surveyID), participantID)
	if err != nil {
		// Log error details (err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start or resume survey session"})
	}

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
	sessionIDStr := c.Params("sessionId")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid session ID format"})
	}

	// --- Optional: Validate session belongs to participant ---
	// participantID := c.Locals("participantId").(uint)
	// session, err := h.service.GetSessionByID(c.Context(), uint(sessionID)) // Need GetSessionByID in service/repo
	// if err != nil { ... handle error ... }
	// if session.ParticipantID != participantID { return c.Status(fiber.StatusForbidden).JSON(...) }
	// --- End Validation ---

	var req SaveDraftRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "details": err.Error()})
	}

	// Basic validation
	if req.DraftAnswers == nil {
		req.DraftAnswers = make(map[string]interface{}) // Ensure it's not nil if empty
	}

	err = h.service.SaveDraft(c.Context(), uint(sessionID), req.LastQuestionID, req.DraftAnswers)
	if err != nil {
		// Check for specific errors if needed (e.g., session not found)
		// if errors.Is(err, repository.ErrSessionNotFound) {
		// 	 return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
		// }
		// Log error details (err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save draft"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Draft saved successfully"})
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
	sessionIDStr := c.Params("sessionId")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid session ID format"})
	}

	// --- Optional: Validate session belongs to participant (similar to SaveDraft) ---

	var req SubmitRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "details": err.Error()})
	}

	if req.Answers == nil {
		// Maybe allow submitting empty answers? Or return bad request?
		req.Answers = []service.FinalAnswerInput{}
	}

	err = h.service.SubmitSurvey(c.Context(), uint(sessionID), req.Answers)
	if err != nil {
		if errors.Is(err, repository.ErrSessionNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
		}
		// Handle potential conflict error from service (e.g., "survey session is not in progress")
		if err.Error() == "survey session is not in progress" {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		}

		// Log error details (err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to submit survey"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Survey submitted successfully"})
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
