package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

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

// captureBrowserInfo extracts browser/device info from request and updates the session
func (h *ParticipantHandler) captureBrowserInfo(c *fiber.Ctx, sessionID uint) {
	userAgentStr := c.Get("User-Agent")
	browserName, browserVersion := parseBrowser(userAgentStr)
	osName := parseOS(userAgentStr)
	deviceType := parseDeviceType(userAgentStr)

	// Get client IP - check forwarded headers first (for proxies/load balancers)
	clientIP := c.Get("X-Forwarded-For")
	if clientIP == "" {
		clientIP = c.Get("X-Real-IP")
	}
	if clientIP == "" {
		clientIP = c.IP()
	}
	// X-Forwarded-For can contain multiple IPs, take the first one
	if idx := strings.Index(clientIP, ","); idx != -1 {
		clientIP = strings.TrimSpace(clientIP[:idx])
	}

	info := repository.BrowserInfo{
		UserAgent:      userAgentStr,
		BrowserName:    browserName,
		BrowserVersion: browserVersion,
		OSName:         osName,
		DeviceType:     deviceType,
		IPAddress:      clientIP,
	}

	// Update asynchronously to not block the response
	go func() {
		if err := h.service.UpdateSessionBrowserInfo(c.Context(), sessionID, info); err != nil {
			log.Printf("[WARN] Failed to update browser info for session %d: %v", sessionID, err)
		}
	}()
}

// parseDeviceType detects device type from user agent
func parseDeviceType(ua string) string {
	uaLower := strings.ToLower(ua)
	if strings.Contains(uaLower, "mobile") || (strings.Contains(uaLower, "android") && !strings.Contains(uaLower, "tablet")) {
		return "mobile"
	}
	if strings.Contains(uaLower, "tablet") || strings.Contains(uaLower, "ipad") {
		return "tablet"
	}
	return "desktop"
}

// parseOS detects OS from user agent
func parseOS(ua string) string {
	uaLower := strings.ToLower(ua)
	switch {
	case strings.Contains(uaLower, "windows nt 10"):
		return "Windows 10/11"
	case strings.Contains(uaLower, "windows"):
		return "Windows"
	case strings.Contains(uaLower, "mac os x"):
		return "macOS"
	case strings.Contains(uaLower, "iphone"):
		return "iOS"
	case strings.Contains(uaLower, "ipad"):
		return "iPadOS"
	case strings.Contains(uaLower, "android"):
		return "Android"
	case strings.Contains(uaLower, "linux"):
		return "Linux"
	case strings.Contains(uaLower, "cros"):
		return "Chrome OS"
	default:
		return "Unknown"
	}
}

// parseBrowser detects browser name and version from user agent
func parseBrowser(ua string) (name, version string) {
	uaLower := strings.ToLower(ua)
	browsers := []struct {
		name, pattern, regex string
	}{
		{"Edge", "edg/", `Edg/(\d+[\.\d]*)`},
		{"Opera", "opr/", `OPR/(\d+[\.\d]*)`},
		{"Firefox", "firefox", `Firefox/(\d+[\.\d]*)`},
		{"Samsung Browser", "samsungbrowser", `SamsungBrowser/(\d+[\.\d]*)`},
		{"Chrome", "chrome", `Chrome/(\d+[\.\d]*)`},
		{"Safari", "safari", `Version/(\d+[\.\d]*)`},
	}
	for _, b := range browsers {
		if strings.Contains(uaLower, b.pattern) {
			name = b.name
			re := regexp.MustCompile(b.regex)
			if matches := re.FindStringSubmatch(ua); len(matches) > 1 {
				version = matches[1]
			}
			return
		}
	}
	return "Unknown", ""
}

// DTO for Save Draft Request Body
type SaveDraftRequest struct {
	LastQuestionID *uint                  `json:"lastQuestionId" validate:"omitempty,min=1"` // Use pointer for nullability
	DraftAnswers   map[string]interface{} `json:"draftAnswers" validate:"required"`
}

// DTO for Submit Survey Request Body
type SubmitRequest struct {
	Answers          []service.FinalAnswerInput `json:"answers" validate:"required,min=1,dive"`
	CompletedAt      string                     `json:"completedAt" validate:"omitempty"`
	ParticipantEmail string                     `json:"participantEmail" validate:"omitempty"` // For invitation tracking
	TabSwitchCount   int                        `json:"tabSwitchCount"`                        // Anti-cheating: tab switch count
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

	// Capture browser/device info for analytics
	h.captureBrowserInfo(c, response.Session.SessionID)

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
// HandleMarkSessionStarted records when the participant actually starts the quiz (clicks "Start").
// Idempotent: the timer is anchored to the first call only. Ownership is verified by SessionTokenMiddleware.
func (h *ParticipantHandler) HandleMarkSessionStarted(c *fiber.Ctx) error {
	sessionIDStr := c.Params("sessionId")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 64)
	if err != nil || sessionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session ID",
			"message": "Session ID must be a valid positive integer",
		})
	}

	if err := h.service.MarkSessionStarted(c.Context(), uint(sessionID)); err != nil {
		log.Printf("[ERROR] Failed to mark session started - SessionID: %d, Error: %v", sessionID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to start session",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{"success": true})
}

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
	participantID, _ := participantIDVal.(uint)

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

	// SECURITY: Ownership is already verified by SessionTokenMiddleware.
	// For authenticated sessions (session.ParticipantID != 0), middleware checks participantID match.
	// For anonymous sessions (session.ParticipantID == 0), middleware validates X-Session-Token.

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

	// Update tab switch count if present in draft data
	if tabCount, ok := req.DraftAnswers["tabSwitchCount"]; ok {
		if count, ok := tabCount.(float64); ok && int(count) > 0 {
			go func() {
				if err := h.service.UpdateTabSwitchCount(context.Background(), uint(sessionID), int(count)); err != nil {
					log.Printf("[WARN] Failed to update tab switch count from draft - SessionID: %d, Error: %v", sessionID, err)
				}
			}()
		}
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

	// SECURITY: Ownership is already verified by SessionTokenMiddleware.
	// For authenticated sessions (session.ParticipantID != 0), middleware checks participantID match.
	// For anonymous sessions (session.ParticipantID == 0), middleware validates X-Session-Token.
	// We skip redundant checks here since middleware already validated access.

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

	// Get session to retrieve survey ID before submit
	session, err := h.service.GetSessionByID(c.Context(), uint(sessionID))
	if err != nil {
		log.Printf("[ERROR] Session not found - SessionID: %d", sessionID)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "Session not found",
			"message": "The specified session does not exist",
		})
	}
	surveyID := session.SurveyID

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

	// Update tab switch count for anti-cheating tracking
	if req.TabSwitchCount > 0 {
		go func() {
			if err := h.service.UpdateTabSwitchCount(context.Background(), uint(sessionID), req.TabSwitchCount); err != nil {
				log.Printf("[WARN] Failed to update tab switch count - SessionID: %d, Error: %v", sessionID, err)
			}
		}()
	}

	// Mark session for manual evaluation if the survey requires it
	go func() {
		if err := h.service.MarkForManualEvaluationIfNeeded(context.Background(), uint(sessionID), surveyID); err != nil {
			log.Printf("[WARN] Failed to check/mark manual evaluation - SessionID: %d, Error: %v", sessionID, err)
		}
	}()

	// Mark invitation as completed so an assigned survey clears from the participant's dashboard.
	// Use the submitted email (anonymous/share-link flow) or fall back to the authenticated user's
	// JWT email (dashboard "Assigned to you" take, where participantEmail isn't sent).
	completionEmail := req.ParticipantEmail
	if completionEmail == "" {
		if emailVal := c.Locals("email"); emailVal != nil {
			completionEmail, _ = emailVal.(string)
		}
	}
	if completionEmail != "" {
		go markInvitationCompleted(surveyID, completionEmail)
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

// markInvitationCompleted calls SurveyManagementService to mark invitation as completed
func markInvitationCompleted(surveyID uint, email string) {
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:5172"
	}

	apiKey := os.Getenv("INTERNAL_API_KEY")
	// No default - if not set, log warning but continue (internal API may allow dev mode)

	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d/invitation/complete", surveyServiceURL, surveyID)

	body := fmt.Sprintf(`{"email":"%s"}`, email)
	req, err := http.NewRequest("POST", url, strings.NewReader(body))
	if err != nil {
		log.Printf("[WARN] Failed to create invitation complete request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("X-Internal-API-Key", apiKey)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[WARN] Failed to mark invitation as completed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		log.Printf("[SUCCESS] Invitation marked as completed - SurveyID: %d, Email: %s", surveyID, email)
	} else {
		log.Printf("[WARN] Failed to mark invitation completed - Status: %d, SurveyID: %d", resp.StatusCode, surveyID)
	}
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
	log.Printf("[DEBUG] HandleStartSessionViaShareLink called - Path: %s, Query: %s", c.Path(), c.Request().URI().QueryString())
	// Get share token from query
	shareToken := c.Query("token")
	if shareToken == "" {
		log.Printf("[ERROR] Share token missing from request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Missing share token",
			"message": "Share token is required",
		})
	}

	// Get token type (invitation or share link)
	tokenType := c.Query("type") // "invitation" for invitation tokens, empty for share links

	// Parse request body for email, password, and participant info (from public page validation)
	var reqBody struct {
		Email           string                 `json:"email"`
		Password        string                 `json:"password"`
		ParticipantInfo map[string]interface{} `json:"participant_info"` // Custom fields defined by conductor
	}
	c.BodyParser(&reqBody) // Optional body, ignore errors

	// Try to get Participant ID from middleware (may not exist for anonymous users)
	participantIDVal := c.Locals("participantId")
	participantID, hasAuth := participantIDVal.(uint)
	isAnonymous := !hasAuth || participantID == 0
	if isAnonymous {
		// Anonymous user - use 0 as participant ID marker
		// Each anonymous session gets a unique session_token for access control
		// Sessions are identified by (surveyID, email) for anonymous users with email
		// or by session_token alone for truly anonymous users
		participantID = 0
		log.Printf("[INFO] Anonymous user accessing share link, email: %s", reqBody.Email)
	}

	// Validate access with SurveyManagementService
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:5172" // Fixed: matches SurveyManagementService port
	}

	// Choose validation endpoint based on token type
	var validateURL string
	if tokenType == "invitation" {
		validateURL = fmt.Sprintf("%s/api/v1/surveys/public/validate-invitation?token=%s", surveyServiceURL, shareToken)
		log.Printf("[INFO] Using invitation validation endpoint for token: %s", shareToken)
	} else {
		validateURL = fmt.Sprintf("%s/api/v1/surveys/public/validate-access?token=%s", surveyServiceURL, shareToken)
		log.Printf("[INFO] Using share link validation endpoint for token: %s", shareToken)
	}

	// Build request body with email and password if provided
	var validateBody []byte
	if reqBody.Email != "" || reqBody.Password != "" {
		validateBodyMap := map[string]string{}
		if reqBody.Email != "" {
			validateBodyMap["email"] = reqBody.Email
		}
		if reqBody.Password != "" {
			validateBodyMap["password"] = reqBody.Password
		}
		validateBody, _ = json.Marshal(validateBodyMap)
	}

	// Get auth token from request
	authToken := c.Get("Authorization")

	var req *http.Request
	var err error
	if len(validateBody) > 0 {
		req, err = http.NewRequest("POST", validateURL, bytes.NewBuffer(validateBody))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, err = http.NewRequest("POST", validateURL, nil)
	}
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

	// Forward User-Agent and IP headers for access logging
	userAgent := c.Get("User-Agent")
	if userAgent != "" {
		req.Header.Set("User-Agent", userAgent)
	}
	// Forward real client IP
	clientIP := c.Get("X-Forwarded-For")
	if clientIP == "" {
		clientIP = c.Get("X-Real-IP")
	}
	if clientIP == "" {
		clientIP = c.IP()
	}
	if clientIP != "" {
		req.Header.Set("X-Forwarded-For", clientIP)
		req.Header.Set("X-Real-IP", clientIP)
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

		// Forward the actual error message from validation service
		errorMessage := "You are not authorized to access this survey"
		if msg, ok := errorResp["message"].(string); ok && msg != "" {
			errorMessage = msg
		}
		errorReason := ""
		if reason, ok := errorResp["reason"].(string); ok {
			errorReason = reason
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Access denied",
			"message": errorMessage,
			"reason":  errorReason,
			"details": errorResp,
		})
	}

	// Parse validation response
	var validationResp struct {
		Success          bool     `json:"success"`
		RequiresLogin    bool     `json:"requiresLogin"`
		RequiresPassword bool     `json:"requiresPassword"`
		AccessType       string   `json:"accessType"`
		AllowedDomains   string   `json:"allowedDomains"`
		Message          string   `json:"message"`
		Data             struct {
			SurveyID       uint   `json:"surveyId"`
			Title          string `json:"title"`
			AllowAnonymous bool   `json:"allowAnonymous"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&validationResp); err != nil {
		log.Printf("[ERROR] Failed to parse validation response: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Internal error",
			"message": "Failed to process validation response",
		})
	}

	// Handle special cases where login or password is required
	// IMPORTANT: Only return 403 if login is required AND validation hasn't succeeded yet
	// RequiresLogin is true for ALL ORGANIZATION surveys, even after valid email is provided
	if validationResp.RequiresLogin && !validationResp.Success {
		log.Printf("[INFO] Survey requires login - Token: %s, AccessType: %s, AllowedDomains: %s",
			shareToken, validationResp.AccessType, validationResp.AllowedDomains)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":          "Login required",
			"message":        fmt.Sprintf("Please log in with an email from: %s", validationResp.AllowedDomains),
			"requiresLogin":  true,
			"accessType":     validationResp.AccessType,
			"allowedDomains": validationResp.AllowedDomains,
			"data": fiber.Map{
				"surveyId": validationResp.Data.SurveyID,
				"title":    validationResp.Data.Title,
			},
		})
	}

	if validationResp.RequiresPassword && !validationResp.Success {
		log.Printf("[INFO] Survey requires password - Token: %s", shareToken)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":            "Password required",
			"message":          "This survey requires a password to access",
			"requiresPassword": true,
			"data": fiber.Map{
				"surveyId": validationResp.Data.SurveyID,
				"title":    validationResp.Data.Title,
			},
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
	log.Printf("[INFO] Access granted for token %s - Starting session for SurveyID: %d, Anonymous: %v, Email: %s", shareToken, surveyID, isAnonymous, reqBody.Email)

	// SECURITY: Enforce allow_anonymous server-side. If the survey does not allow anonymous
	// participation, an unauthenticated user cannot start a session via a public share link.
	// Invitation tokens are exempt (the invited email identifies the participant), and ORGANIZATION
	// access is already gated by the requiresLogin path above.
	if isAnonymous && tokenType != "invitation" && !validationResp.Data.AllowAnonymous {
		log.Printf("[INFO] Anonymous start blocked - survey %d requires sign-in (allow_anonymous=false)", surveyID)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":         "Login required",
			"message":       "This survey requires you to sign in before participating.",
			"requiresLogin": true,
			"data": fiber.Map{
				"surveyId": surveyID,
				"title":    validationResp.Data.Title,
			},
		})
	}

	var response *service.StartResumeResponse

	if isAnonymous {
		// Use anonymous session handling (prevents ID collision, each session gets unique token)
		response, err := h.service.StartAnonymousSession(c.Context(), surveyID, reqBody.Email, reqBody.ParticipantInfo, tokenType == "invitation")
		if err != nil {
			log.Printf("[ERROR] Failed to start anonymous session - SurveyID: %d, Error: %v", surveyID, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to start session",
				"message": "Unable to create survey session",
			})
		}
		tokenPreview := ""
		if len(response.Session.SessionToken) >= 8 {
			tokenPreview = response.Session.SessionToken[:8] + "..."
		}
		log.Printf("[SUCCESS] Anonymous session started - SurveyID: %d, SessionID: %d, Token: %s",
			surveyID, response.Session.SessionID, tokenPreview)

		// No browser/device capture for anonymous sessions (privacy)

		return c.Status(fiber.StatusOK).JSON(response)
	}

	// Authenticated user - use standard method
	response, err = h.service.StartOrResumeSurveyWithParticipantInfo(c.Context(), surveyID, participantID, reqBody.Email, reqBody.ParticipantInfo)

	if err != nil {
		log.Printf("[ERROR] Failed to start survey session - SurveyID: %d, Anonymous: %v, Error: %v", surveyID, isAnonymous, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to start session",
			"message": "Unable to create survey session",
		})
	}

	tokenPreview := ""
	if len(response.Session.SessionToken) >= 8 {
		tokenPreview = response.Session.SessionToken[:8] + "..."
	}
	log.Printf("[SUCCESS] Session started via share link - SurveyID: %d, SessionID: %d, Token: %s, Email: %s",
		surveyID, response.Session.SessionID, tokenPreview, reqBody.Email)

	// Capture browser/device info for analytics
	h.captureBrowserInfo(c, response.Session.SessionID)

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

	// SECURITY: Get conductor ID from JWT and verify ownership
	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		log.Printf("[ERROR] Authentication required for survey results - SurveyID: %d", surveyID)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Authentication required to view survey results",
		})
	}

	// Verify the conductor owns this survey
	isOwner, err := h.service.VerifySurveyOwnership(c.Context(), uint(surveyID), conductorID)
	if err != nil {
		log.Printf("[ERROR] Failed to verify survey ownership - SurveyID: %d, ConductorID: %d, Error: %v", surveyID, conductorID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Internal error",
			"message": "Failed to verify survey ownership",
		})
	}
	if !isOwner {
		log.Printf("[WARN] Unauthorized access attempt to survey results - SurveyID: %d, ConductorID: %d", surveyID, conductorID)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Forbidden",
			"message": "You do not have permission to view results for this survey",
		})
	}

	log.Printf("[INFO] Fetching enhanced survey results for SurveyID: %d (ConductorID: %d)", surveyID, conductorID)
	results, err := h.service.GetEnhancedSurveyResults(c.Context(), uint(surveyID))
	if err != nil {
		log.Printf("[ERROR] Failed to get survey results - SurveyID: %d, Error: %v", surveyID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get survey results",
			"message": "Unable to retrieve survey analytics",
		})
	}

	log.Printf("[SUCCESS] Retrieved enhanced survey results - SurveyID: %d, Title: %s, TotalSessions: %d, CompletedSessions: %d",
		surveyID, results.SurveyTitle, results.TotalSessions, results.CompletedSessions)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    results,
	})
}

// HandleGetMyHistory godoc
// @Summary Get Participant Survey History
// @Description Gets all surveys the current participant has taken with their results
// @Tags Participant
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 401 {object} fiber.Map "Unauthorized"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/my-history [get]
// @Security BearerAuth
func (h *ParticipantHandler) HandleGetMyHistory(c *fiber.Ctx) error {
	// Get participant ID from JWT
	participantIDVal := c.Locals("participantId")
	participantID, ok := participantIDVal.(uint)
	if !ok || participantID == 0 {
		log.Printf("[ERROR] Authentication required for survey history")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Authentication required. Please log in as a participant.",
		})
	}

	// Get email from JWT to also include anonymous sessions with matching email
	email := ""
	if emailVal := c.Locals("email"); emailVal != nil {
		email, _ = emailVal.(string)
	}

	log.Printf("[INFO] Fetching survey history for ParticipantID: %d, Email: %s", participantID, email)
	history, err := h.service.GetParticipantSurveyHistoryWithEmail(c.Context(), participantID, email)
	if err != nil {
		log.Printf("[ERROR] Failed to get participant history - ParticipantID: %d, Error: %v", participantID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to get survey history",
			"message": "Unable to retrieve your survey history",
		})
	}

	log.Printf("[SUCCESS] Retrieved survey history - ParticipantID: %d, TotalSurveys: %d, CompletedSurveys: %d",
		participantID, history.TotalSurveys, history.CompletedSurveys)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    history,
	})
}

// HandleGetSessionResponses godoc
// @Summary Get Session Responses
// @Description Gets all answers for a specific session (conductor must own the survey)
// @Tags Participant
// @Accept json
// @Produce json
// @Param sessionId path int true "Session ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map "Invalid Session ID"
// @Failure 403 {object} fiber.Map "Forbidden - not your survey"
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

	// SECURITY: Get conductor ID from JWT
	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		log.Printf("[ERROR] Authentication required for session responses - SessionID: %d", sessionID)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Authentication required to view session responses",
		})
	}

	// SECURITY: Get session to find which survey it belongs to
	session, err := h.service.GetSessionByID(c.Context(), uint(sessionID))
	if err != nil {
		log.Printf("[ERROR] Session not found - SessionID: %d", sessionID)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "Session not found",
			"message": "The specified session does not exist",
		})
	}

	// SECURITY: Verify the conductor owns the survey this session belongs to
	isOwner, err := h.service.VerifySurveyOwnership(c.Context(), session.SurveyID, conductorID)
	if err != nil {
		log.Printf("[ERROR] Failed to verify survey ownership - SurveyID: %d, ConductorID: %d, Error: %v", session.SurveyID, conductorID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Internal error",
			"message": "Failed to verify survey ownership",
		})
	}
	if !isOwner {
		log.Printf("[WARN] Unauthorized access attempt to session responses - SessionID: %d, SurveyID: %d, ConductorID: %d", sessionID, session.SurveyID, conductorID)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Forbidden",
			"message": "You do not have permission to view responses for this session",
		})
	}

	log.Printf("[INFO] Fetching responses for SessionID: %d (ConductorID: %d)", sessionID, conductorID)
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
// @Failure 403 {object} fiber.Map "Forbidden - not your session"
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

	// SECURITY: Get the session first to verify ownership
	session, err := h.service.GetSessionByID(c.Context(), uint(sessionID))
	if err != nil {
		log.Printf("[ERROR] Session not found - SessionID: %d", sessionID)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "Session not found",
			"message": "The specified session does not exist",
		})
	}

	// SECURITY: Verify the session is completed (only allow evaluation after submission)
	if session.SessionStatus != "COMPLETED" {
		log.Printf("[WARN] Attempted to evaluate non-completed session - SessionID: %d, Status: %s", sessionID, session.SessionStatus)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid session state",
			"message": "Quiz can only be evaluated after submission",
		})
	}

	// SECURITY: Ownership is already verified by SessionTokenMiddleware.
	// For authenticated sessions (session.ParticipantID != 0), middleware checks participantID match.
	// For anonymous sessions (session.ParticipantID == 0), middleware validates X-Session-Token.

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

// HandleResetParticipant godoc
// @Summary Reset Participant Session
// @Description Deletes a participant's session(s) to allow them to retake the survey/quiz
// @Tags Conductor
// @Accept json
// @Produce json
// @Param surveyId path int true "Survey ID"
// @Param email query string true "Participant email to reset"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map "Invalid Survey ID or missing email"
// @Failure 403 {object} fiber.Map "Forbidden - not your survey"
// @Failure 500 {object} fiber.Map "Internal Server Error"
// @Router /api/participant/surveys/{surveyId}/reset-participant [delete]
// @Security BearerAuth
func (h *ParticipantHandler) HandleResetParticipant(c *fiber.Ctx) error {
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

	// Get email from query parameter
	email := c.Query("email")
	if email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Missing email",
			"message": "Email parameter is required",
		})
	}

	// SECURITY: Get conductor ID from JWT
	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		log.Printf("[ERROR] Authentication required for reset participant - SurveyID: %d", surveyID)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Authentication required to reset participants",
		})
	}

	// Verify the conductor owns this survey
	isOwner, err := h.service.VerifySurveyOwnership(c.Context(), uint(surveyID), conductorID)
	if err != nil {
		log.Printf("[ERROR] Failed to verify survey ownership - SurveyID: %d, ConductorID: %d, Error: %v", surveyID, conductorID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Internal error",
			"message": "Failed to verify survey ownership",
		})
	}
	if !isOwner {
		log.Printf("[WARN] Unauthorized reset attempt - SurveyID: %d, ConductorID: %d, Email: %s", surveyID, conductorID, email)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Forbidden",
			"message": "You do not have permission to reset participants for this survey",
		})
	}

	// Reset all sessions for this participant
	log.Printf("[INFO] Resetting participant sessions - SurveyID: %d, Email: %s, ConductorID: %d", surveyID, email, conductorID)
	err = h.service.ResetParticipantByEmail(c.Context(), uint(surveyID), email)
	if err != nil {
		log.Printf("[ERROR] Failed to reset participant - SurveyID: %d, Email: %s, Error: %v", surveyID, email, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to reset participant",
			"message": "Unable to delete participant sessions",
		})
	}

	log.Printf("[SUCCESS] Participant reset - SurveyID: %d, Email: %s", surveyID, email)
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Successfully reset participant %s. They can now retake the survey.", email),
	})
}
