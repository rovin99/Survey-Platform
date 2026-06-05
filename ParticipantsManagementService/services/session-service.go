package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json" // Needed for draft content handling
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/models"     // Adjust import path
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository" // Adjust import path
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var (
	internalAPIKeyOnce sync.Once
	internalAPIKey     string
)

// getInternalAPIKey returns the internal API key, logging warnings once if not set
// hashEmail returns a SHA-256 hash of the email for anonymous privacy.
// Stored instead of raw email so attempts can be tracked without storing PII.
func hashEmail(email string) string {
	if email == "" {
		return ""
	}
	h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(email))))
	return "sha256:" + hex.EncodeToString(h[:])
}

func getInternalAPIKey() string {
	internalAPIKeyOnce.Do(func() {
		internalAPIKey = os.Getenv("INTERNAL_API_KEY")
		env := os.Getenv("ENVIRONMENT")
		isProduction := env == "production" || env == "prod"

		if internalAPIKey == "" {
			if isProduction {
				log.Fatal("FATAL: INTERNAL_API_KEY required for service-to-service calls in production")
			}
			log.Println("WARNING: INTERNAL_API_KEY not set. Internal API calls may fail.")
		} else if len(internalAPIKey) < 32 {
			log.Printf("WARNING: INTERNAL_API_KEY should be at least 32 characters (got %d)", len(internalAPIKey))
		}
	})
	return internalAPIKey
}

// DTO for starting/resuming survey
type StartResumeResponse struct {
	Session *models.SurveySession          `json:"session"`
	Draft   *models.ParticipantSurveyDraft `json:"draft"` // Include existing draft content
	Survey  *SurveyDetail                  `json:"survey"`
}

// DTO for submitting final answers
type FinalAnswerInput struct {
	QuestionID    uint        `json:"questionId"`
	ResponseData  interface{} `json:"responseData"` // Use interface{} to accept various answer types
	Justification string      `json:"justification"` // Participant-authored reason for choice answers (anti-cheating)
}

type ParticipantService interface {
	StartOrResumeSurvey(ctx context.Context, surveyID, participantID uint) (*StartResumeResponse, error)
	StartOrResumeSurveyWithEmail(ctx context.Context, surveyID, participantID uint, email string) (*StartResumeResponse, error)
	StartOrResumeSurveyWithParticipantInfo(ctx context.Context, surveyID, participantID uint, email string, participantInfo map[string]interface{}) (*StartResumeResponse, error)
	// StartAnonymousSession creates or resumes a session for anonymous users (participantID=0).
	// When isInvitation is true the participant was explicitly invited by email, so the real email
	// is stored (not hashed) — the conductor needs to know who responded.
	StartAnonymousSession(ctx context.Context, surveyID uint, email string, participantInfo map[string]interface{}, isInvitation bool) (*StartResumeResponse, error)
	SaveDraft(ctx context.Context, sessionID uint, lastQuestionID *uint, draftContent map[string]interface{}) error
	SubmitSurvey(ctx context.Context, sessionID uint, finalAnswers []FinalAnswerInput) error
	GetSession(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error)
	GetSessionByID(ctx context.Context, sessionID uint) (*models.SurveySession, error)
	GetDraft(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error)
	GetSurveyResults(ctx context.Context, surveyID uint) (*SurveyResultsResponse, error)
	GetEnhancedSurveyResults(ctx context.Context, surveyID uint) (*EnhancedSurveyResults, error)
	GetSessionResponses(ctx context.Context, sessionID uint) ([]models.Answer, error)
	// VerifySurveyOwnership checks if the conductor owns the survey
	VerifySurveyOwnership(ctx context.Context, surveyID, conductorID uint) (bool, error)
	// UpdateSessionBrowserInfo updates the browser/device tracking info for a session
	UpdateSessionBrowserInfo(ctx context.Context, sessionID uint, info repository.BrowserInfo) error
	// UpdateTabSwitchCount updates the tab switch count for anti-cheating tracking
	UpdateTabSwitchCount(ctx context.Context, sessionID uint, count int) error
	// MarkSessionStarted records when the participant actually started the quiz (idempotent)
	MarkSessionStarted(ctx context.Context, sessionID uint) error
	// MarkForManualEvaluationIfNeeded checks if the survey requires manual evaluation and marks the session accordingly
	MarkForManualEvaluationIfNeeded(ctx context.Context, sessionID uint, surveyID uint) error
	// ResetParticipantSession deletes a participant's session to allow retake
	ResetParticipantSession(ctx context.Context, sessionID uint) error
	// ResetParticipantByEmail deletes all sessions for an email on a survey
	ResetParticipantByEmail(ctx context.Context, surveyID uint, email string) error
	// GetParticipantSurveyHistory returns all survey sessions for a participant with details
	GetParticipantSurveyHistory(ctx context.Context, participantID uint) (*ParticipantSurveyHistory, error)
	// GetParticipantSurveyHistoryWithEmail returns all survey sessions for a participant,
	// including anonymous sessions that were taken with the same email before registration
	GetParticipantSurveyHistoryWithEmail(ctx context.Context, participantID uint, email string) (*ParticipantSurveyHistory, error)
	// SetQuizEvaluationService sets the quiz evaluation service for history scores
	SetQuizEvaluationService(quizEvalService QuizEvaluationService)
	// SetEvaluationRepo sets the evaluation repo for reading manual evaluation marks in results
	SetEvaluationRepo(evalRepo repository.EvaluationRepository)
}

type participantServiceImpl struct {
	repo            repository.ParticipantRepository
	evalRepo        repository.EvaluationRepository
	quizEvalService QuizEvaluationService
}

func NewParticipantService(repo repository.ParticipantRepository) ParticipantService {
	return &participantServiceImpl{repo: repo}
}

// SetQuizEvaluationService sets the quiz evaluation service for calculating scores in history
func (s *participantServiceImpl) SetQuizEvaluationService(quizEvalService QuizEvaluationService) {
	s.quizEvalService = quizEvalService
}

func (s *participantServiceImpl) SetEvaluationRepo(evalRepo repository.EvaluationRepository) {
	s.evalRepo = evalRepo
}

func (s *participantServiceImpl) StartOrResumeSurvey(ctx context.Context, surveyID, participantID uint) (*StartResumeResponse, error) {
	session, err := s.repo.FindOrCreateSession(ctx, surveyID, participantID)
	if err != nil {
		return nil, err
	}

	// Always try to get the draft associated with this session
	draft, err := s.repo.GetDraftBySessionID(ctx, session.SessionID)
	if err != nil {
		// If there's a real database error, return it
		return nil, err
	}
	// If draft is nil (not found), it's fine, just return nil draft in response

	// Fetch real survey data from Survey Management Service
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:5172" // Fixed: matches SurveyManagementService port
	}

	// Use internal API endpoint (no JWT required, uses API key for service-to-service calls)
	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d", surveyServiceURL, surveyID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add internal API key for service-to-service authentication
	if key := getInternalAPIKey(); key != "" {
		req.Header.Set("X-Internal-API-Key", key)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch survey from service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("survey service returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse the response (using snake_case from backend)
	var surveyResponse struct {
		Success bool                 `json:"success"`
		Data    SurveyDetailFromAPI `json:"data"`
		Message string               `json:"message"`
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, &surveyResponse); err != nil {
		return nil, fmt.Errorf("failed to parse survey response: %w", err)
	}

	if !surveyResponse.Success {
		return nil, fmt.Errorf("survey service error: %s", surveyResponse.Message)
	}

	// Convert from API format (snake_case) to frontend format (camelCase)
	surveyDetail := convertToFrontendFormat(&surveyResponse.Data)

	return &StartResumeResponse{
		Session: session,
		Draft:   draft,
		Survey:  surveyDetail,
	}, nil
}

// StartOrResumeSurveyWithEmail starts or resumes a survey session and stores the participant email
func (s *participantServiceImpl) StartOrResumeSurveyWithEmail(ctx context.Context, surveyID, participantID uint, email string) (*StartResumeResponse, error) {
	session, err := s.repo.FindOrCreateSessionWithEmail(ctx, surveyID, participantID, email)
	if err != nil {
		return nil, err
	}

	// Always try to get the draft associated with this session
	draft, err := s.repo.GetDraftBySessionID(ctx, session.SessionID)
	if err != nil {
		return nil, err
	}

	// Fetch real survey data from Survey Management Service
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:5172"
	}

	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d", surveyServiceURL, surveyID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if key := getInternalAPIKey(); key != "" {
		req.Header.Set("X-Internal-API-Key", key)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch survey from service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("survey service returned status %d: %s", resp.StatusCode, string(body))
	}

	var surveyResponse struct {
		Success bool                `json:"success"`
		Data    SurveyDetailFromAPI `json:"data"`
		Message string              `json:"message"`
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, &surveyResponse); err != nil {
		return nil, fmt.Errorf("failed to parse survey response: %w", err)
	}

	if !surveyResponse.Success {
		return nil, fmt.Errorf("survey service error: %s", surveyResponse.Message)
	}

	surveyDetail := convertToFrontendFormat(&surveyResponse.Data)

	return &StartResumeResponse{
		Session: session,
		Draft:   draft,
		Survey:  surveyDetail,
	}, nil
}

// StartOrResumeSurveyWithParticipantInfo starts or resumes a survey session with email and custom participant info
func (s *participantServiceImpl) StartOrResumeSurveyWithParticipantInfo(ctx context.Context, surveyID, participantID uint, email string, participantInfo map[string]interface{}) (*StartResumeResponse, error) {
	// Convert participantInfo to JSON
	var participantInfoJSON datatypes.JSON
	if participantInfo != nil && len(participantInfo) > 0 {
		jsonBytes, err := json.Marshal(participantInfo)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize participant info: %w", err)
		}
		participantInfoJSON = datatypes.JSON(jsonBytes)
	}

	session, err := s.repo.FindOrCreateSessionWithParticipantInfo(ctx, surveyID, participantID, email, participantInfoJSON)
	if err != nil {
		return nil, err
	}

	// Always try to get the draft associated with this session
	draft, err := s.repo.GetDraftBySessionID(ctx, session.SessionID)
	if err != nil {
		return nil, err
	}

	// Fetch real survey data from Survey Management Service
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:5172"
	}

	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d", surveyServiceURL, surveyID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if key := getInternalAPIKey(); key != "" {
		req.Header.Set("X-Internal-API-Key", key)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch survey from service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("survey service returned status %d: %s", resp.StatusCode, string(body))
	}

	var surveyResponse struct {
		Success bool                `json:"success"`
		Data    SurveyDetailFromAPI `json:"data"`
		Message string              `json:"message"`
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, &surveyResponse); err != nil {
		return nil, fmt.Errorf("failed to parse survey response: %w", err)
	}

	if !surveyResponse.Success {
		return nil, fmt.Errorf("survey service error: %s", surveyResponse.Message)
	}

	surveyDetail := convertToFrontendFormat(&surveyResponse.Data)

	return &StartResumeResponse{
		Session: session,
		Draft:   draft,
		Survey:  surveyDetail,
	}, nil
}

// StartAnonymousSession creates or resumes a session for anonymous users.
// - If email is provided, tries to find existing IN_PROGRESS session
// - If previous session is COMPLETED, allows retake (if within max_attempts limit)
// - Each session gets a unique session_token for access control (prevents IDOR)
func (s *participantServiceImpl) StartAnonymousSession(ctx context.Context, surveyID uint, email string, participantInfo map[string]interface{}, isInvitation bool) (*StartResumeResponse, error) {
	var session *models.SurveySession
	var err error

	// Public share-link participants are stored hashed for privacy ("Anonymous #N").
	// Invited participants are explicitly known to the conductor, so store the real email.
	// The same stored value is used for find/count/create so resume & retake stay consistent.
	emailHash := hashEmail(email)
	if isInvitation && email != "" {
		emailHash = strings.ToLower(strings.TrimSpace(email))
	}

	// Fetch survey details first to check max_attempts
	surveyDetail, err := s.fetchSurveyDetails(surveyID)
	if err != nil {
		return nil, err
	}

	// If email provided, try to find existing IN_PROGRESS session (by hash)
	if email != "" {
		session, err = s.repo.FindAnonymousSessionByEmail(ctx, surveyID, emailHash)
		if err != nil {
			return nil, err
		}
	}

	// If existing IN_PROGRESS session found, resume it
	if session != nil {
		// Ensure session has a token (migration for old sessions)
		if session.SessionToken == "" {
			log.Printf("[INFO] Generating session token for existing session %d", session.SessionID)
			if err := s.repo.EnsureSessionToken(ctx, session.SessionID); err != nil {
				log.Printf("[WARN] Failed to generate session token: %v", err)
			} else {
				// Reload session to get the new token
				session, _ = s.repo.GetSessionByID(ctx, session.SessionID)
			}
		}
		draft, _ := s.repo.GetDraftBySessionID(ctx, session.SessionID)
		return &StartResumeResponse{
			Session: session,
			Draft:   draft,
			Survey:  surveyDetail,
		}, nil
	}

	// No IN_PROGRESS session - check if this is a retake (by hash)
	completedAttempts := 0
	if email != "" {
		completedAttempts, err = s.repo.CountCompletedAttemptsByEmail(ctx, surveyID, emailHash)
		if err != nil {
			return nil, fmt.Errorf("failed to count attempts: %w", err)
		}
	}

	// Check max_attempts limit
	if surveyDetail.MaxAttempts != nil && *surveyDetail.MaxAttempts > 0 {
		if completedAttempts >= *surveyDetail.MaxAttempts {
			return nil, fmt.Errorf("maximum attempts (%d) reached for this survey", *surveyDetail.MaxAttempts)
		}
	}

	// Create new session (first attempt or retake)
	var participantInfoJSON datatypes.JSON
	if participantInfo != nil && len(participantInfo) > 0 {
		jsonBytes, err := json.Marshal(participantInfo)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize participant info: %w", err)
		}
		participantInfoJSON = datatypes.JSON(jsonBytes)
	}

	attemptNumber := completedAttempts + 1
	// Store hash instead of raw email — no PII in DB for anonymous users
	session, err = s.repo.CreateRetakeSession(ctx, surveyID, 0, emailHash, participantInfoJSON, attemptNumber)
	if err != nil {
		return nil, err
	}

	return &StartResumeResponse{
		Session: session,
		Draft:   nil, // New session has no draft
		Survey:  surveyDetail,
	}, nil
}

// API format (snake_case from SurveyManagementService)
type SurveyDetailFromAPI struct {
	ID                     uint              `json:"id"`
	Title                  string            `json:"title"`
	Description            string            `json:"description"`
	ConductorID            uint              `json:"conductor_id"`
	IsSelfRecruitment      bool              `json:"is_self_recruitment"`
	Status                 string            `json:"status"`
	// Display mode: "one_by_one" or "all_at_once"
	QuestionDisplayMode    string            `json:"question_display_mode"`
	// Quiz-specific fields (updated to include all quiz fields)
	IsQuiz                 bool              `json:"is_quiz"`
	TimeLimitMinutes       *int              `json:"time_limit_minutes"`
	PassingScorePercentage *int              `json:"passing_score_percentage"`
	ShowCorrectAnswers     bool              `json:"show_correct_answers"`
	ShuffleQuestions       bool              `json:"shuffle_questions"`
	ShuffleOptions         bool              `json:"shuffle_options"`
	MaxAttempts            *int              `json:"max_attempts,omitempty"`
	RequiresManualEvaluation bool           `json:"requires_manual_evaluation"`
	// Custom participant fields defined by conductor
	ParticipantFields      json.RawMessage   `json:"participant_fields,omitempty"`
	Questions              []QuestionFromAPI `json:"questions"`
}

type QuestionFromAPI struct {
	ID             uint               `json:"id"`
	SurveyID       uint               `json:"survey_id"`
	QuestionText   string             `json:"question_text"`
	QuestionType   string             `json:"question_type"`
	Options        []OptionFromAPI    `json:"options,omitempty"`
	MediaFiles     []MediaFileFromAPI `json:"media_files,omitempty"`
	CorrectAnswers string             `json:"correct_answers"`
	BranchingLogic string             `json:"branching_logic"`
	Mandatory      bool               `json:"mandatory"`
	Points         int                `json:"points"`
	Explanation    string             `json:"explanation"`
	RequiresJustification bool        `json:"requires_justification"`
	JustificationRequired bool        `json:"justification_required"`
}

type MediaFileFromAPI struct {
	ID         uint   `json:"id"`
	QuestionID uint   `json:"question_id"`
	FileURL    string `json:"file_url"`
	FileType   string `json:"file_type"`
}

type OptionFromAPI struct {
	ID         uint   `json:"id"`
	QuestionID uint   `json:"question_id"`
	OptionText string `json:"option_text"`
}

// Frontend format (camelCase for JavaScript)
type SurveyDetail struct {
	ID                     uint            `json:"id"`
	Title                  string          `json:"title"`
	Description            string          `json:"description"`
	ConductorID            uint            `json:"conductorId"`
	IsSelfRecruitment      bool            `json:"isSelfRecruitment"`
	Status                 string          `json:"status"`
	QuestionDisplayMode    string          `json:"questionDisplayMode"`
	Questions              []Question      `json:"questions"`
	// Quiz-specific fields (Fix #1: Added for quiz functionality)
	IsQuiz                 bool            `json:"isQuiz"`
	TimeLimitMinutes       *int            `json:"timeLimitMinutes,omitempty"`
	PassingScorePercentage *int            `json:"passingScorePercentage,omitempty"`
	ShowCorrectAnswers     bool            `json:"showCorrectAnswers"`
	ShuffleQuestions       bool            `json:"shuffleQuestions"`
	ShuffleOptions         bool            `json:"shuffleOptions"`
	MaxAttempts            *int            `json:"maxAttempts,omitempty"`
	// Custom participant fields defined by conductor
	ParticipantFields      json.RawMessage `json:"participantFields,omitempty"`
}

type Question struct {
	ID             uint        `json:"id"`
	SurveyID       uint        `json:"surveyId"`
	QuestionText   string      `json:"questionText"`
	QuestionType   string      `json:"questionType"`
	Options        []Option    `json:"options,omitempty"`
	MediaFiles     []MediaFile `json:"mediaFiles,omitempty"`
	CorrectAnswers string      `json:"correctAnswers"`
	BranchingLogic string      `json:"branchingLogic"`
	Mandatory      bool        `json:"mandatory"`
	Points         int         `json:"points"`
	Explanation    string      `json:"explanation,omitempty"`
	RequiresJustification bool `json:"requiresJustification"`
	JustificationRequired bool `json:"justificationRequired"`
}

type MediaFile struct {
	ID         uint   `json:"id"`
	QuestionID uint   `json:"questionId"`
	FileURL    string `json:"fileUrl"`
	FileType   string `json:"fileType"`
}

type Option struct {
	ID         uint   `json:"id"`
	QuestionID uint   `json:"questionId"`
	OptionText string `json:"optionText"`
}

// Converter function (Fix #3: Now copies all quiz-specific fields)
func convertToFrontendFormat(apiSurvey *SurveyDetailFromAPI) *SurveyDetail {
	questions := make([]Question, len(apiSurvey.Questions))
	for i, q := range apiSurvey.Questions {
		options := make([]Option, len(q.Options))
		for j, opt := range q.Options {
			options[j] = Option{
				ID:         opt.ID,
				QuestionID: opt.QuestionID,
				OptionText: opt.OptionText,
			}
		}
		mediaFiles := make([]MediaFile, len(q.MediaFiles))
		for k, mf := range q.MediaFiles {
			mediaFiles[k] = MediaFile{
				ID:         mf.ID,
				QuestionID: mf.QuestionID,
				FileURL:    mf.FileURL,
				FileType:   mf.FileType,
			}
		}

		questions[i] = Question{
			ID:             q.ID,
			SurveyID:       q.SurveyID,
			QuestionText:   q.QuestionText,
			QuestionType:   q.QuestionType,
			Options:        options,
			MediaFiles:     mediaFiles,
			CorrectAnswers: q.CorrectAnswers,
			BranchingLogic: q.BranchingLogic,
			Mandatory:      q.Mandatory,
			Points:         q.Points,
			Explanation:    q.Explanation,
			RequiresJustification: q.RequiresJustification,
			JustificationRequired: q.JustificationRequired,
		}
	}
	return &SurveyDetail{
		ID:                     apiSurvey.ID,
		Title:                  apiSurvey.Title,
		Description:            apiSurvey.Description,
		ConductorID:            apiSurvey.ConductorID,
		IsSelfRecruitment:      apiSurvey.IsSelfRecruitment,
		Status:                 apiSurvey.Status,
		QuestionDisplayMode:    apiSurvey.QuestionDisplayMode,
		Questions:              questions,
		// Quiz-specific survey fields
		IsQuiz:                 apiSurvey.IsQuiz,
		TimeLimitMinutes:       apiSurvey.TimeLimitMinutes,
		PassingScorePercentage: apiSurvey.PassingScorePercentage,
		ShowCorrectAnswers:     apiSurvey.ShowCorrectAnswers,
		ShuffleQuestions:       apiSurvey.ShuffleQuestions,
		ShuffleOptions:         apiSurvey.ShuffleOptions,
		MaxAttempts:            apiSurvey.MaxAttempts,
		// Custom participant fields
		ParticipantFields:      apiSurvey.ParticipantFields,
	}
}

func (s *participantServiceImpl) SaveDraft(ctx context.Context, sessionID uint, lastQuestionID *uint, draftAnswers map[string]interface{}) error {
	// Validate session exists? (Optional, UpdateDraft handles non-existent via upsert but maybe explicit check is better)
	// session, err := s.repo.GetSessionByID(ctx, sessionID)
	// if err != nil {
	//    return err // Return error if session doesn't exist
	// }
	// // Optional: Check if session belongs to the authenticated participant

	draftJSON, err := json.Marshal(draftAnswers)
	if err != nil {
		return err // Error marshalling map to JSON
	}

	return s.repo.UpdateDraft(ctx, sessionID, lastQuestionID, datatypes.JSON(draftJSON))
}

func (s *participantServiceImpl) SubmitSurvey(ctx context.Context, sessionID uint, finalAnswersInput []FinalAnswerInput) error {
	// 1. Get the session to validate it exists and is IN_PROGRESS
	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return err // Includes ErrSessionNotFound
	}

	// Optional: Check if session belongs to the authenticated participant

	if session.SessionStatus != "IN_PROGRESS" {
		// Prevent double submission or submitting abandoned sessions
		return errors.New("survey session is not in progress")
	}

	// Server-side time-limit check: flag (don't reject) submissions that arrive after the limit.
	// We flag rather than reject because the client already auto-submits on expiry and clock skew
	// / network latency could otherwise unfairly drop a legitimate submission.
	if surveyDetail, sErr := s.fetchSurveyDetails(session.SurveyID); sErr == nil &&
		surveyDetail.IsQuiz && surveyDetail.TimeLimitMinutes != nil && *surveyDetail.TimeLimitMinutes > 0 {
		startedAt := session.CreatedAt
		if session.QuizStartedAt != nil {
			startedAt = *session.QuizStartedAt
		}
		const graceSeconds = 10
		deadline := startedAt.Add(time.Duration(*surveyDetail.TimeLimitMinutes)*time.Minute + graceSeconds*time.Second)
		if time.Now().After(deadline) {
			session.OverTime = true
			log.Printf("[WARN] Submission past time limit - SessionID: %d (started %s, limit %d min)", sessionID, startedAt.Format(time.RFC3339), *surveyDetail.TimeLimitMinutes)
		}
	}

	// 2. Prepare final answers for batch creation
	answersToCreate := make([]models.Answer, 0, len(finalAnswersInput))
	for _, input := range finalAnswersInput {
		// Marshal individual response data to JSON for the DB
		responseDataJSON, err := json.Marshal(input.ResponseData)
		if err != nil {
			// Log error for specific answer marshalling
			// Decide: skip this answer or fail the whole submission?
			// For now, let's skip and log (or return error)
			// return fmt.Errorf("failed to marshal answer for question %d: %w", input.QuestionID, err)
			continue // Or return error
		}

		answersToCreate = append(answersToCreate, models.Answer{
			SessionID:     sessionID,
			QuestionID:    input.QuestionID,
			ResponseData:  datatypes.JSON(responseDataJSON),
			Justification: input.Justification,
		})
	}

	// --- Transaction Recommended ---
	// Use a transaction to ensure all steps succeed or fail together
	db := s.repo.(repository.ParticipantRepository).GetDB()
	tx := db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	// Wrap repo calls in a function to handle rollback
	err = func(tx *gorm.DB) error {
		// Create a temporary repo instance using the transaction
		txRepo := repository.NewGormParticipantRepository(tx)

		// 3. Save final answers
		if err := txRepo.CreateAnswersBatch(ctx, answersToCreate); err != nil {
			return err
		}

		// 4. Update session status to COMPLETED
		session.SessionStatus = "COMPLETED"
		// Optionally update LastQuestionID here if needed, though maybe less relevant for completed state
		if err := txRepo.UpdateSession(ctx, session); err != nil {
			return err
		}

		// 5. Delete the draft
		if err := txRepo.DeleteDraft(ctx, sessionID); err != nil {
			// Log error but maybe don't fail the whole submission if draft deletion fails? Your call.
			// For atomicity, maybe we should fail.
			return err
		}

		return nil // Commit
	}(tx)

	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
	// --- End Transaction ---

}

// Added GetSession and GetDraft service methods if needed directly by handlers
func (s *participantServiceImpl) GetSession(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error) {
	return s.repo.GetSessionBySurveyParticipant(ctx, surveyID, participantID)
}

func (s *participantServiceImpl) GetDraft(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error) {
	draft, err := s.repo.GetDraftBySessionID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if draft == nil {
		return nil, repository.ErrDraftNotFound // Return specific error if needed by handler
	}
	return draft, nil
}

// Response structure for survey results/analytics (legacy)
type SurveyResultsResponse struct {
	SurveyID         uint                  `json:"surveyId"`
	TotalSessions    int                   `json:"totalSessions"`
	CompletedSessions int                  `json:"completedSessions"`
	InProgressSessions int                 `json:"inProgressSessions"`
	Sessions         []SessionWithAnswers  `json:"sessions"`
}

type SessionWithAnswers struct {
	SessionID     uint               `json:"sessionId"`
	ParticipantID uint               `json:"participantId"`
	Status        string             `json:"status"`
	CreatedAt     string             `json:"createdAt"`
	UpdatedAt     string             `json:"updatedAt"`
	Answers       []AnswerResponse   `json:"answers"`
}

type AnswerResponse struct {
	QuestionID   uint        `json:"questionId"`
	ResponseData interface{} `json:"responseData"`
	CreatedAt    string      `json:"createdAt"`
}

// ============================================================
// Enhanced Survey Results DTOs (with emails, scores, question details)
// ============================================================

// EnhancedSurveyResults is the main response for the enhanced results endpoint
type EnhancedSurveyResults struct {
	SurveyID           uint                `json:"surveyId"`
	SurveyTitle        string              `json:"surveyTitle"`
	IsQuiz             bool                `json:"isQuiz"`
	MaxAttempts        *int                `json:"maxAttempts,omitempty"`
	TotalSessions      int                 `json:"totalSessions"`
	CompletedSessions  int                 `json:"completedSessions"`
	InProgressSessions int                 `json:"inProgressSessions"`
	AverageScore       *float64            `json:"averageScore,omitempty"`
	PassRate           *float64            `json:"passRate,omitempty"`
	Participants       []ParticipantResult `json:"participants"`
}

// ParticipantResult represents a single participant's survey/quiz results
type ParticipantResult struct {
	SessionID        uint                   `json:"sessionId"`
	ParticipantID    uint                   `json:"participantId"`
	Email            string                 `json:"email"`
	TotalAttempts    int                    `json:"totalAttempts"`    // Total number of attempts by this participant
	CurrentAttempt   int                    `json:"currentAttempt"`   // Which attempt this result is from (latest)
	ParticipantInfo  map[string]interface{} `json:"participantInfo,omitempty"` // Custom participant fields
	Status           string                 `json:"status"`
	StartedAt        string                 `json:"startedAt"`
	CompletedAt      string                 `json:"completedAt,omitempty"`
	TimeTakenSeconds int                    `json:"timeTakenSeconds,omitempty"`
	// Browser/Device info
	BrowserName      string                 `json:"browserName,omitempty"`
	BrowserVersion   string                 `json:"browserVersion,omitempty"`
	OSName           string                 `json:"osName,omitempty"`
	DeviceType       string                 `json:"deviceType,omitempty"`
	IPAddress        string                 `json:"ipAddress,omitempty"`
	// Anti-cheating
	TabSwitchCount   int                    `json:"tabSwitchCount"`
	// Quiz-specific fields
	Score            *int                   `json:"score,omitempty"`
	TotalPoints      *int                   `json:"totalPoints,omitempty"`
	Percentage       *float64               `json:"percentage,omitempty"`
	Passed           *bool                  `json:"passed,omitempty"`
	BestScore        *int                   `json:"bestScore,omitempty"`        // Best score across all attempts
	BestPercentage   *float64               `json:"bestPercentage,omitempty"`   // Best percentage across all attempts
	Answers          []AnswerDetail         `json:"answers"`
}

// AnswerDetail represents a single answer with question context
type AnswerDetail struct {
	QuestionID     uint        `json:"questionId"`
	QuestionText   string      `json:"questionText"`
	QuestionType   string      `json:"questionType"`
	UserAnswer     interface{} `json:"userAnswer"`
	CorrectAnswer  interface{} `json:"correctAnswer,omitempty"`
	IsCorrect      *bool       `json:"isCorrect,omitempty"`
	PointsEarned   *int        `json:"pointsEarned,omitempty"`
	PointsPossible *int        `json:"pointsPossible,omitempty"`
	Justification  string      `json:"justification,omitempty"`
}

// AccessLogEntry represents a participant's access log from SurveyManagementService
type AccessLogEntry struct {
	ParticipantID *uint  `json:"participant_id"`
	UserEmail     string `json:"user_email"`
	AccessGranted bool   `json:"access_granted"`
}

// AccessLogsResponse is the response from the access logs API
type AccessLogsResponse struct {
	Success bool             `json:"success"`
	Data    []AccessLogEntry `json:"data"`
}

// ParticipantSurveyHistory contains a participant's survey history
type ParticipantSurveyHistory struct {
	ParticipantID     uint                       `json:"participantId"`
	TotalSurveys      int                        `json:"totalSurveys"`
	CompletedSurveys  int                        `json:"completedSurveys"`
	InProgressSurveys int                        `json:"inProgressSurveys"`
	Surveys           []ParticipantSurveyEntry   `json:"surveys"`
}

// ParticipantSurveyEntry represents a single survey in participant's history
type ParticipantSurveyEntry struct {
	SessionID        uint     `json:"sessionId"`
	SurveyID         uint     `json:"surveyId"`
	SurveyTitle      string   `json:"surveyTitle"`
	IsQuiz           bool     `json:"isQuiz"`
	Status           string   `json:"status"`
	AttemptNumber    int      `json:"attemptNumber"`
	StartedAt        string   `json:"startedAt"`
	CompletedAt      string   `json:"completedAt,omitempty"`
	TimeTakenSeconds int      `json:"timeTakenSeconds,omitempty"`
	// Quiz results
	Score            *int     `json:"score,omitempty"`
	TotalPoints      *int     `json:"totalPoints,omitempty"`
	Percentage       *float64 `json:"percentage,omitempty"`
	Passed           *bool    `json:"passed,omitempty"`
}

// GetSurveyResults retrieves all sessions and answers for a survey (for conductor analytics)
func (s *participantServiceImpl) GetSurveyResults(ctx context.Context, surveyID uint) (*SurveyResultsResponse, error) {
	// Get all sessions for this survey
	allSessions, err := s.repo.GetSessionsBySurveyID(ctx, surveyID)
	if err != nil {
		return nil, err
	}

	// Get completed sessions
	completedSessions, err := s.repo.GetCompletedSessionsBySurveyID(ctx, surveyID)
	if err != nil {
		return nil, err
	}

	// Build response with session details and answers
	sessionsWithAnswers := make([]SessionWithAnswers, 0, len(completedSessions))
	for _, session := range completedSessions {
		// Get answers for this session
		answers, err := s.repo.GetAnswersBySessionID(ctx, session.SessionID)
		if err != nil {
			continue // Skip sessions with errors
		}

		// Convert answers to response format
		answerResponses := make([]AnswerResponse, len(answers))
		for i, answer := range answers {
			// Parse JSON response data
			var responseData interface{}
			if err := json.Unmarshal(answer.ResponseData, &responseData); err != nil {
				responseData = string(answer.ResponseData) // Fallback to string
			}

			answerResponses[i] = AnswerResponse{
				QuestionID:   answer.QuestionID,
				ResponseData: responseData,
				CreatedAt:    answer.CreatedAt.Format(time.RFC3339),
			}
		}

		sessionsWithAnswers = append(sessionsWithAnswers, SessionWithAnswers{
			SessionID:     session.SessionID,
			ParticipantID: session.ParticipantID,
			Status:        session.SessionStatus,
			CreatedAt:     session.CreatedAt.Format(time.RFC3339),
			UpdatedAt:     session.UpdatedAt.Format(time.RFC3339),
			Answers:       answerResponses,
		})
	}

	// Calculate in-progress sessions
	inProgressCount := len(allSessions) - len(completedSessions)

	return &SurveyResultsResponse{
		SurveyID:           surveyID,
		TotalSessions:      len(allSessions),
		CompletedSessions:  len(completedSessions),
		InProgressSessions: inProgressCount,
		Sessions:           sessionsWithAnswers,
	}, nil
}

// GetSessionResponses retrieves all answers for a specific session
func (s *participantServiceImpl) GetSessionResponses(ctx context.Context, sessionID uint) ([]models.Answer, error) {
	return s.repo.GetAnswersBySessionID(ctx, sessionID)
}

// QuestionOptionInfo holds option mappings for a question
type QuestionOptionInfo struct {
	OptionIDToPosition map[uint]int    // option_id -> 1-indexed position
	OptionIDToText     map[uint]string // option_id -> option text
	PositionToText     map[int]string  // 1-indexed position -> option text
}

// GetEnhancedSurveyResults retrieves comprehensive results with emails, scores, and question details
func (s *participantServiceImpl) GetEnhancedSurveyResults(ctx context.Context, surveyID uint) (*EnhancedSurveyResults, error) {
	// 1. Fetch survey details (including questions) from SurveyManagementService
	surveyDetail, err := s.fetchSurveyDetails(surveyID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch survey details: %w", err)
	}

	// 2. Get all sessions for this survey
	allSessions, err := s.repo.GetSessionsBySurveyID(ctx, surveyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sessions: %w", err)
	}

	// 3. Fetch participant emails from access logs
	emailList, err := s.fetchSurveyEmails(surveyID)
	if err != nil {
		emailList = []string{}
	}

	// 4. Build question lookup map and option info for each question
	questionMap := make(map[uint]Question)
	optionInfoMap := make(map[uint]QuestionOptionInfo)
	for _, q := range surveyDetail.Questions {
		questionMap[q.ID] = q
		
		// Build option mappings - options are already sorted by ID from API
		optionInfo := QuestionOptionInfo{
			OptionIDToPosition: make(map[uint]int),
			OptionIDToText:     make(map[uint]string),
			PositionToText:     make(map[int]string),
		}
		for i, opt := range q.Options {
			position := i + 1 // 1-indexed
			optionInfo.OptionIDToPosition[opt.ID] = position
			optionInfo.OptionIDToText[opt.ID] = opt.OptionText
			optionInfo.PositionToText[position] = opt.OptionText
		}
		optionInfoMap[q.ID] = optionInfo
	}

	// 5. Process each session and group by participant email
	// Temporary struct to hold session data before grouping
	type sessionData struct {
		session          models.SurveySession
		email            string
		participantInfo  map[string]interface{}
		answerDetails    []AnswerDetail
		sessionScore     int
		sessionTotalPts  int
		timeTaken        int
	}

	allSessionData := make([]sessionData, 0, len(allSessions))

	for i, session := range allSessions {
		// Get answers for this session
		answers, err := s.repo.GetAnswersBySessionID(ctx, session.SessionID)
		if err != nil {
			continue
		}

		// Build answer details with question context
		answerDetails := make([]AnswerDetail, 0, len(answers))
		sessionScore := 0
		sessionTotalPoints := 0

		for _, answer := range answers {
			question, exists := questionMap[answer.QuestionID]
			if !exists {
				continue
			}
			optionInfo := optionInfoMap[answer.QuestionID]

			// Parse user's answer - handle double-encoded JSON
			var rawAnswer interface{}
			if err := json.Unmarshal(answer.ResponseData, &rawAnswer); err != nil {
				rawAnswer = string(answer.ResponseData)
			}

			// If rawAnswer is a string (double-encoded JSON), try to parse it again
			if strVal, ok := rawAnswer.(string); ok {
				var innerAnswer interface{}
				if err := json.Unmarshal([]byte(strVal), &innerAnswer); err == nil {
					rawAnswer = innerAnswer
				}
			}

			// Extract and convert user answer to display text
			userAnswerText, userOptionIDs := s.extractUserAnswer(rawAnswer, optionInfo, question.QuestionType)

			detail := AnswerDetail{
				QuestionID:    answer.QuestionID,
				QuestionText:  question.QuestionText,
				QuestionType:  question.QuestionType,
				UserAnswer:    userAnswerText,
				Justification: answer.Justification,
			}

			// For quizzes, calculate correctness and points
			if surveyDetail.IsQuiz {
				pointsPossible := question.Points
				if pointsPossible == 0 {
					pointsPossible = 1 // Default 1 point per question
				}
				detail.PointsPossible = &pointsPossible
				sessionTotalPoints += pointsPossible

				if question.CorrectAnswers != "" && question.QuestionType != "code" {
					// Auto-gradable question (single/multiple choice)
					correctText := s.convertCorrectAnswersToText(question.CorrectAnswers, optionInfo)
					detail.CorrectAnswer = correctText

					isCorrect := s.checkAnswerCorrectnessWithOptions(userOptionIDs, question.CorrectAnswers, optionInfo)
					detail.IsCorrect = &isCorrect

					pointsEarned := 0
					if isCorrect {
						pointsEarned = pointsPossible
						sessionScore += pointsEarned
					}
					detail.PointsEarned = &pointsEarned
				} else {
					// Manually graded question (text, rating, image-upload, code)
					// Points start at 0 — conductor edits via inline marks
					pointsEarned := 0
					detail.PointsEarned = &pointsEarned
				}
			}

			answerDetails = append(answerDetails, detail)
		}

		// Overlay manual evaluation marks if they exist
		if s.evalRepo != nil && session.EvaluationStatus == "evaluated" {
			evaluations, err := s.evalRepo.GetEvaluationsBySessionID(ctx, session.SessionID)
			if err == nil && len(evaluations) > 0 {
				evalMap := make(map[uint]float64)
				for _, ev := range evaluations {
					evalMap[ev.QuestionID] = ev.MarksGiven
				}
				// Recalculate score from evaluations
				sessionScore = 0
				for i, detail := range answerDetails {
					if marks, ok := evalMap[uint(detail.QuestionID)]; ok {
						earned := int(marks)
						answerDetails[i].PointsEarned = &earned
						sessionScore += earned
					}
				}
			}
		}

		// Calculate time taken
		timeTaken := 0
		if session.SessionStatus == "COMPLETED" {
			timeTaken = int(session.UpdatedAt.Sub(session.CreatedAt).Seconds())
		}

		// Get email from session (stored when session was created via share link)
		email := session.ParticipantEmail
		if email == "" || email == "anonymous@guest.local" {
			// Fallback: try to find in email list from access logs
			if i < len(emailList) {
				email = emailList[len(emailList)-1-i]
			}
		}
		if email == "" || email == "anonymous@guest.local" {
			if session.ParticipantID != 0 {
				// Authenticated participant without a stored email — group by participant id so
				// their multiple attempts still consolidate into a single participant row.
				email = fmt.Sprintf("participant_%d@unknown", session.ParticipantID)
			} else {
				// Truly anonymous session with no email — key each session uniquely so distinct
				// respondents are NOT merged into one row. Displayed as "Anonymous #N" below.
				email = fmt.Sprintf("anon-session:%d", session.SessionID)
			}
		}

		// Parse participant_info JSON if present
		var participantInfoMap map[string]interface{}
		if len(session.ParticipantInfo) > 0 {
			if err := json.Unmarshal(session.ParticipantInfo, &participantInfoMap); err != nil {
				fmt.Printf("[WARN] Failed to parse participant_info for session %d: %v\n", session.SessionID, err)
			}
		}

		allSessionData = append(allSessionData, sessionData{
			session:         session,
			email:           email,
			participantInfo: participantInfoMap,
			answerDetails:   answerDetails,
			sessionScore:    sessionScore,
			sessionTotalPts: sessionTotalPoints,
			timeTaken:       timeTaken,
		})
	}

	// 6. Group sessions by email and find latest attempt for each participant
	participantSessions := make(map[string][]sessionData)
	for _, sd := range allSessionData {
		participantSessions[sd.email] = append(participantSessions[sd.email], sd)
	}

	// 7. Build consolidated participant results (one per unique email)
	participants := make([]ParticipantResult, 0, len(participantSessions))
	var totalScore, totalPossible int
	var passedCount int
	completedCount := 0

	anonCounter := 0
	for email, sessions := range participantSessions {
		// Find the latest session (highest attempt number, or most recent if same)
		var latestSession sessionData
		var bestScore, bestTotalPts int
		totalAttempts := len(sessions)

		for _, sd := range sessions {
			// Track latest session
			if sd.session.AttemptNumber > latestSession.session.AttemptNumber ||
				(sd.session.AttemptNumber == latestSession.session.AttemptNumber &&
				 sd.session.CreatedAt.After(latestSession.session.CreatedAt)) {
				latestSession = sd
			}
			// Track best score (only from completed sessions)
			if sd.session.SessionStatus == "COMPLETED" && sd.sessionScore > bestScore {
				bestScore = sd.sessionScore
				bestTotalPts = sd.sessionTotalPts
			}
		}

		session := latestSession.session

		// Display "Anonymous #N" for hashed emails (privacy) and unidentified no-email sessions
		displayEmail := email
		if strings.HasPrefix(email, "sha256:") || strings.HasPrefix(email, "anon-session:") || email == "" {
			anonCounter++
			displayEmail = fmt.Sprintf("Anonymous #%d", anonCounter)
		}

		// Build participant result from latest session
		result := ParticipantResult{
			SessionID:        session.SessionID,
			ParticipantID:    session.ParticipantID,
			Email:            displayEmail,
			TotalAttempts:    totalAttempts,
			CurrentAttempt:   session.AttemptNumber,
			ParticipantInfo:  latestSession.participantInfo,
			Status:           session.SessionStatus,
			StartedAt:        session.CreatedAt.Format(time.RFC3339),
			TimeTakenSeconds: latestSession.timeTaken,
			// Browser/Device info
			BrowserName:      session.BrowserName,
			BrowserVersion:   session.BrowserVer,
			OSName:           session.OSName,
			DeviceType:       session.DeviceType,
			IPAddress:        session.IPAddress,
			TabSwitchCount:   session.TabSwitchCount,
			Answers:          latestSession.answerDetails,
		}

		if session.SessionStatus == "COMPLETED" {
			completedAt := session.UpdatedAt.Format(time.RFC3339)
			result.CompletedAt = completedAt
			completedCount++
		}

		// Add quiz-specific fields
		if surveyDetail.IsQuiz && session.SessionStatus == "COMPLETED" {
			result.Score = &latestSession.sessionScore
			result.TotalPoints = &latestSession.sessionTotalPts

			if latestSession.sessionTotalPts > 0 {
				percentage := float64(latestSession.sessionScore) / float64(latestSession.sessionTotalPts) * 100
				result.Percentage = &percentage

				// Check if passed (based on latest attempt)
				if surveyDetail.PassingScorePercentage != nil {
					passed := percentage >= float64(*surveyDetail.PassingScorePercentage)
					result.Passed = &passed
					if passed {
						passedCount++
					}
				}

				totalScore += latestSession.sessionScore
				totalPossible += latestSession.sessionTotalPts
			}

			// Add best score if different from current
			if bestScore > 0 && bestTotalPts > 0 {
				result.BestScore = &bestScore
				bestPct := float64(bestScore) / float64(bestTotalPts) * 100
				result.BestPercentage = &bestPct
			}
		}

		participants = append(participants, result)
	}

	response := &EnhancedSurveyResults{
		SurveyID:           surveyID,
		SurveyTitle:        surveyDetail.Title,
		IsQuiz:             surveyDetail.IsQuiz,
		MaxAttempts:        surveyDetail.MaxAttempts,
		TotalSessions:      len(allSessions),
		CompletedSessions:  completedCount,
		InProgressSessions: len(allSessions) - completedCount,
		Participants:       participants,
	}

	// Add quiz aggregate statistics
	if surveyDetail.IsQuiz && completedCount > 0 {
		if totalPossible > 0 {
			avgScore := float64(totalScore) / float64(completedCount)
			response.AverageScore = &avgScore
		}
		passRate := float64(passedCount) / float64(completedCount) * 100
		response.PassRate = &passRate
	}

	return response, nil
}

// extractUserAnswer extracts the user's answer and converts option IDs to text
func (s *participantServiceImpl) extractUserAnswer(rawAnswer interface{}, optionInfo QuestionOptionInfo, questionType string) (string, []uint) {
	var optionIDs []uint

	// For rating/text/image-upload: return raw value, don't look up as option ID
	isChoiceType := questionType == "single-choice" || questionType == "multiple-choice"

	// Handle code answers: {"value": {"code": "...", "language": "python"}}
	if answerMap, ok := rawAnswer.(map[string]interface{}); ok {
		if value, hasValue := answerMap["value"]; hasValue {
			if codeMap, ok := value.(map[string]interface{}); ok {
				if code, hasCode := codeMap["code"]; hasCode {
					lang, _ := codeMap["language"].(string)
					codeStr, _ := code.(string)
					if lang != "" {
						return fmt.Sprintf("[%s] %s", lang, codeStr), nil
					}
					return fmt.Sprintf("%v", codeStr), nil
				}
			}
		}
	}

	// Handle {"value": X} format
	if answerMap, ok := rawAnswer.(map[string]interface{}); ok {
		if value, exists := answerMap["value"]; exists {
			// Single value
			if floatVal, ok := value.(float64); ok {
				if !isChoiceType {
					// Rating, etc. — return the number as-is
					return fmt.Sprintf("%g", floatVal), nil
				}
				optionID := uint(floatVal)
				optionIDs = append(optionIDs, optionID)
				if text, exists := optionInfo.OptionIDToText[optionID]; exists {
					return text, optionIDs
				}
				return fmt.Sprintf("Option %d", optionID), optionIDs
			}
			// Array of values
			if arrVal, ok := value.([]interface{}); ok {
				var texts []string
				for _, v := range arrVal {
					if floatVal, ok := v.(float64); ok {
						optionID := uint(floatVal)
						optionIDs = append(optionIDs, optionID)
						if text, exists := optionInfo.OptionIDToText[optionID]; exists {
							texts = append(texts, text)
						} else {
							texts = append(texts, fmt.Sprintf("Option %d", optionID))
						}
					}
				}
				return strings.Join(texts, ", "), optionIDs
			}
			// String value (for text answers)
			if strVal, ok := value.(string); ok {
				return strVal, nil
			}
		}
	}
	
	// Plain string or other format
	return fmt.Sprintf("%v", rawAnswer), nil
}

// convertCorrectAnswersToText converts correct answer positions to option text
func (s *participantServiceImpl) convertCorrectAnswersToText(correctAnswers string, optionInfo QuestionOptionInfo) string {
	positions := splitCorrectAnswers(correctAnswers)
	var texts []string
	for _, posStr := range positions {
		pos := 0
		fmt.Sscanf(posStr, "%d", &pos)
		if text, exists := optionInfo.PositionToText[pos]; exists {
			texts = append(texts, text)
		} else {
			texts = append(texts, posStr)
		}
	}
	return strings.Join(texts, ", ")
}

// checkAnswerCorrectnessWithOptions checks if the user's answer matches the correct answer
func (s *participantServiceImpl) checkAnswerCorrectnessWithOptions(userOptionIDs []uint, correctAnswers string, optionInfo QuestionOptionInfo) bool {
	if len(userOptionIDs) == 0 {
		return false
	}

	// Convert user option IDs to positions
	userPositions := make(map[int]bool)
	for _, optID := range userOptionIDs {
		if pos, exists := optionInfo.OptionIDToPosition[optID]; exists {
			userPositions[pos] = true
		}
	}

	// Parse correct answer positions
	correctPositions := make(map[int]bool)
	for _, posStr := range splitCorrectAnswers(correctAnswers) {
		pos := 0
		fmt.Sscanf(posStr, "%d", &pos)
		if pos > 0 {
			correctPositions[pos] = true
		}
	}

	// Check if sets match exactly
	if len(userPositions) != len(correctPositions) {
		return false
	}
	for pos := range correctPositions {
		if !userPositions[pos] {
			return false
		}
	}
	return true
}

// fetchSurveyEmails fetches unique emails from access logs for this survey
func (s *participantServiceImpl) fetchSurveyEmails(surveyID uint) ([]string, error) {
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://survey-service:8080"
	}

	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d/access-logs", surveyServiceURL, surveyID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	if key := getInternalAPIKey(); key != "" {
		req.Header.Set("X-Internal-API-Key", key)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("access logs API returned status %d", resp.StatusCode)
	}

	var logsResponse AccessLogsResponse
	if err := json.NewDecoder(resp.Body).Decode(&logsResponse); err != nil {
		return nil, err
	}

	// Get unique non-anonymous emails in order
	seen := make(map[string]bool)
	var emails []string
	for _, log := range logsResponse.Data {
		if log.AccessGranted && log.UserEmail != "" && log.UserEmail != "anonymous@guest.local" {
			if !seen[log.UserEmail] {
				seen[log.UserEmail] = true
				emails = append(emails, log.UserEmail)
			}
		}
	}

	return emails, nil
}

// fetchSurveyDetails fetches survey information from SurveyManagementService
func (s *participantServiceImpl) fetchSurveyDetails(surveyID uint) (*SurveyDetail, error) {
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://survey-service:8080"
	}

	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d", surveyServiceURL, surveyID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	if key := getInternalAPIKey(); key != "" {
		req.Header.Set("X-Internal-API-Key", key)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("survey service returned status %d: %s", resp.StatusCode, string(body))
	}

	var surveyResponse struct {
		Success bool                `json:"success"`
		Data    SurveyDetailFromAPI `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&surveyResponse); err != nil {
		return nil, err
	}

	return convertToFrontendFormat(&surveyResponse.Data), nil
}

// fetchSurveyFromAPI returns the raw API response (snake_case) without frontend conversion.
// Used when we need fields like requires_manual_evaluation that aren't in the frontend format.
func (s *participantServiceImpl) fetchSurveyFromAPI(surveyID uint) (*SurveyDetailFromAPI, error) {
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://survey-service:8080"
	}

	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d", surveyServiceURL, surveyID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	if key := getInternalAPIKey(); key != "" {
		req.Header.Set("X-Internal-API-Key", key)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("survey service returned status %d: %s", resp.StatusCode, string(body))
	}

	var surveyResponse struct {
		Success bool                `json:"success"`
		Data    SurveyDetailFromAPI `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&surveyResponse); err != nil {
		return nil, err
	}

	return &surveyResponse.Data, nil
}

// splitCorrectAnswers splits comma-separated correct answers
func splitCorrectAnswers(answers string) []string {
	parts := strings.Split(answers, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// VerifySurveyOwnership checks if the conductor owns the survey
func (s *participantServiceImpl) VerifySurveyOwnership(ctx context.Context, surveyID, conductorID uint) (bool, error) {
	return s.repo.VerifySurveyOwnership(ctx, surveyID, conductorID)
}

// UpdateSessionBrowserInfo updates the browser/device tracking info for a session
func (s *participantServiceImpl) UpdateSessionBrowserInfo(ctx context.Context, sessionID uint, info repository.BrowserInfo) error {
	return s.repo.UpdateSessionBrowserInfo(ctx, sessionID, info)
}

// UpdateTabSwitchCount updates the tab switch count for anti-cheating tracking
func (s *participantServiceImpl) UpdateTabSwitchCount(ctx context.Context, sessionID uint, count int) error {
	return s.repo.UpdateTabSwitchCount(ctx, sessionID, count)
}

// MarkSessionStarted records when the participant actually started the quiz (idempotent)
func (s *participantServiceImpl) MarkSessionStarted(ctx context.Context, sessionID uint) error {
	return s.repo.MarkSessionStarted(ctx, sessionID)
}

// MarkForManualEvaluationIfNeeded checks if the survey requires manual evaluation
// and sets the session's evaluation_status to "pending_evaluation" if so.
func (s *participantServiceImpl) MarkForManualEvaluationIfNeeded(ctx context.Context, sessionID uint, surveyID uint) error {
	// Fetch raw survey data from SurveyManagementService (includes requires_manual_evaluation)
	apiSurvey, err := s.fetchSurveyFromAPI(surveyID)
	if err != nil {
		return fmt.Errorf("failed to fetch survey details: %w", err)
	}

	if !apiSurvey.IsQuiz || !apiSurvey.RequiresManualEvaluation {
		return nil // Not a quiz or doesn't need manual evaluation
	}

	log.Printf("[INFO] Marking session %d for manual evaluation (survey %d requires it)", sessionID, surveyID)
	// Use evaluation repo to update only evaluation_status without touching updated_at
	if s.evalRepo != nil {
		return s.evalRepo.UpdateSessionEvaluationStatus(ctx, sessionID, "pending_evaluation", 0, 0, 0)
	}
	return nil
}

// ResetParticipantSession deletes a session to allow the participant to retake
func (s *participantServiceImpl) ResetParticipantSession(ctx context.Context, sessionID uint) error {
	return s.repo.DeleteSession(ctx, sessionID)
}

// ResetParticipantByEmail deletes all sessions for an email on a survey
func (s *participantServiceImpl) ResetParticipantByEmail(ctx context.Context, surveyID uint, email string) error {
	return s.repo.DeleteSessionsByEmail(ctx, surveyID, email)
}

// GetSessionByID retrieves a session by its ID
func (s *participantServiceImpl) GetSessionByID(ctx context.Context, sessionID uint) (*models.SurveySession, error) {
	return s.repo.GetSessionByID(ctx, sessionID)
}

// GetParticipantSurveyHistory returns all survey sessions for a participant
func (s *participantServiceImpl) GetParticipantSurveyHistory(ctx context.Context, participantID uint) (*ParticipantSurveyHistory, error) {
	sessions, err := s.repo.GetSessionsByParticipantID(ctx, participantID)
	if err != nil {
		return nil, err
	}

	history := &ParticipantSurveyHistory{
		ParticipantID: participantID,
		Surveys:       make([]ParticipantSurveyEntry, 0),
	}

	completedCount := 0
	inProgressCount := 0
	surveyIDSet := make(map[uint]bool)

	for _, session := range sessions {
		surveyIDSet[session.SurveyID] = true

		if session.SessionStatus == "COMPLETED" {
			completedCount++
		} else if session.SessionStatus == "IN_PROGRESS" {
			inProgressCount++
		}

		// Fetch survey details
		surveyDetail, err := s.fetchSurveyDetails(session.SurveyID)
		if err != nil {
			log.Printf("[WARN] Failed to fetch survey %d details: %v", session.SurveyID, err)
			surveyDetail = &SurveyDetail{
				Title:  fmt.Sprintf("Survey #%d", session.SurveyID),
				IsQuiz: false,
			}
		}

		entry := ParticipantSurveyEntry{
			SessionID:     session.SessionID,
			SurveyID:      session.SurveyID,
			SurveyTitle:   surveyDetail.Title,
			IsQuiz:        surveyDetail.IsQuiz,
			Status:        session.SessionStatus,
			AttemptNumber: session.AttemptNumber,
			StartedAt:     session.CreatedAt.Format(time.RFC3339),
		}

		if session.SessionStatus == "COMPLETED" && !session.UpdatedAt.IsZero() {
			entry.CompletedAt = session.UpdatedAt.Format(time.RFC3339)
			// Calculate time taken (only if completed after started)
			if session.UpdatedAt.After(session.CreatedAt) {
				timeTaken := session.UpdatedAt.Sub(session.CreatedAt)
				entry.TimeTakenSeconds = int(timeTaken.Seconds())
			}

			// Quiz score for completed quizzes. Prefer the conductor's manually-evaluated score:
			// once a quiz is manually graded/overridden the session stores the authoritative
			// total_score/max_score, so the dashboard must reflect that rather than re-auto-grading.
			if surveyDetail.IsQuiz {
				if session.TotalScore != nil && session.MaxScore != nil {
					score := int(*session.TotalScore)
					maxPts := int(*session.MaxScore)
					pct := 0.0
					if *session.MaxScore > 0 {
						pct = (*session.TotalScore / *session.MaxScore) * 100
					}
					passed := false
					if surveyDetail.PassingScorePercentage != nil {
						passed = pct >= float64(*surveyDetail.PassingScorePercentage)
					}
					entry.Score = &score
					entry.TotalPoints = &maxPts
					entry.Percentage = &pct
					entry.Passed = &passed
				} else if s.quizEvalService != nil {
					quizResult, err := s.quizEvalService.EvaluateQuiz(ctx, session.SessionID)
					if err == nil && quizResult != nil {
						entry.Score = &quizResult.Score
						entry.TotalPoints = &quizResult.TotalPoints
						entry.Percentage = &quizResult.Percentage
						entry.Passed = &quizResult.Passed
					} else {
						log.Printf("[WARN] Failed to evaluate quiz for session %d: %v", session.SessionID, err)
					}
				}
			}
		}

		history.Surveys = append(history.Surveys, entry)
	}

	history.TotalSurveys = len(surveyIDSet)
	history.CompletedSurveys = completedCount
	history.InProgressSurveys = inProgressCount

	return history, nil
}

// GetParticipantSurveyHistoryWithEmail returns all survey sessions for a participant,
// including anonymous sessions that were taken with the same email before registration.
// This allows users who took surveys via invitation link (as anonymous) to see those
// surveys in their dashboard after registering with the same email.
func (s *participantServiceImpl) GetParticipantSurveyHistoryWithEmail(ctx context.Context, participantID uint, email string) (*ParticipantSurveyHistory, error) {
	// Match by participant id, raw email (invitation/authenticated share-link sessions), AND the
	// hashed email (anonymous PUBLIC share-link sessions store sha256(email) for privacy) — so a
	// logged-in user sees every survey they took with this email regardless of access method.
	emailHash := hashEmail(email)
	sessions, err := s.repo.GetSessionsByParticipantIDOrEmail(ctx, participantID, email, emailHash)
	if err != nil {
		return nil, err
	}

	history := &ParticipantSurveyHistory{
		ParticipantID: participantID,
		Surveys:       make([]ParticipantSurveyEntry, 0),
	}

	completedCount := 0
	inProgressCount := 0
	surveyIDSet := make(map[uint]bool)

	for _, session := range sessions {
		surveyIDSet[session.SurveyID] = true

		if session.SessionStatus == "COMPLETED" {
			completedCount++
		} else if session.SessionStatus == "IN_PROGRESS" {
			inProgressCount++
		}

		// Fetch survey details
		surveyDetail, err := s.fetchSurveyDetails(session.SurveyID)
		if err != nil {
			log.Printf("[WARN] Failed to fetch survey %d details: %v", session.SurveyID, err)
			surveyDetail = &SurveyDetail{
				Title:  fmt.Sprintf("Survey #%d", session.SurveyID),
				IsQuiz: false,
			}
		}

		entry := ParticipantSurveyEntry{
			SessionID:     session.SessionID,
			SurveyID:      session.SurveyID,
			SurveyTitle:   surveyDetail.Title,
			IsQuiz:        surveyDetail.IsQuiz,
			Status:        session.SessionStatus,
			AttemptNumber: session.AttemptNumber,
			StartedAt:     session.CreatedAt.Format(time.RFC3339),
		}

		if session.SessionStatus == "COMPLETED" && !session.UpdatedAt.IsZero() {
			entry.CompletedAt = session.UpdatedAt.Format(time.RFC3339)
			// Calculate time taken (only if completed after started)
			if session.UpdatedAt.After(session.CreatedAt) {
				timeTaken := session.UpdatedAt.Sub(session.CreatedAt)
				entry.TimeTakenSeconds = int(timeTaken.Seconds())
			}

			// Quiz score for completed quizzes. Prefer the conductor's manually-evaluated score:
			// once a quiz is manually graded/overridden the session stores the authoritative
			// total_score/max_score, so the dashboard must reflect that rather than re-auto-grading.
			if surveyDetail.IsQuiz {
				if session.TotalScore != nil && session.MaxScore != nil {
					score := int(*session.TotalScore)
					maxPts := int(*session.MaxScore)
					pct := 0.0
					if *session.MaxScore > 0 {
						pct = (*session.TotalScore / *session.MaxScore) * 100
					}
					passed := false
					if surveyDetail.PassingScorePercentage != nil {
						passed = pct >= float64(*surveyDetail.PassingScorePercentage)
					}
					entry.Score = &score
					entry.TotalPoints = &maxPts
					entry.Percentage = &pct
					entry.Passed = &passed
				} else if s.quizEvalService != nil {
					quizResult, err := s.quizEvalService.EvaluateQuiz(ctx, session.SessionID)
					if err == nil && quizResult != nil {
						entry.Score = &quizResult.Score
						entry.TotalPoints = &quizResult.TotalPoints
						entry.Percentage = &quizResult.Percentage
						entry.Passed = &quizResult.Passed
					} else {
						log.Printf("[WARN] Failed to evaluate quiz for session %d: %v", session.SessionID, err)
					}
				}
			}
		}

		history.Surveys = append(history.Surveys, entry)
	}

	history.TotalSurveys = len(surveyIDSet)
	history.CompletedSurveys = completedCount
	history.InProgressSurveys = inProgressCount

	return history, nil
}
