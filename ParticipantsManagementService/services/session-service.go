package service

import (
	"context"
	"encoding/json" // Needed for draft content handling
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"errors"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/models"     // Adjust import path
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository" // Adjust import path
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// DTO for starting/resuming survey
type StartResumeResponse struct {
	Session *models.SurveySession          `json:"session"`
	Draft   *models.ParticipantSurveyDraft `json:"draft"` // Include existing draft content
	Survey  *SurveyDetail                  `json:"survey"`
}

// DTO for submitting final answers
type FinalAnswerInput struct {
	QuestionID   uint        `json:"questionId"`
	ResponseData interface{} `json:"responseData"` // Use interface{} to accept various answer types
}

type ParticipantService interface {
	StartOrResumeSurvey(ctx context.Context, surveyID, participantID uint) (*StartResumeResponse, error)
	SaveDraft(ctx context.Context, sessionID uint, lastQuestionID *uint, draftContent map[string]interface{}) error
	SubmitSurvey(ctx context.Context, sessionID uint, finalAnswers []FinalAnswerInput) error
	GetSession(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error)
	GetDraft(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error)
	GetSurveyResults(ctx context.Context, surveyID uint) (*SurveyResultsResponse, error)
	GetSessionResponses(ctx context.Context, sessionID uint) ([]models.Answer, error)
}

type participantServiceImpl struct {
	repo repository.ParticipantRepository
	// Potentially add clients for other services (e.g., survey service client) if needed
}

func NewParticipantService(repo repository.ParticipantRepository) ParticipantService {
	return &participantServiceImpl{repo: repo}
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
		surveyServiceURL = "http://localhost:3002"
	}

	// Call the Survey Management Service to get survey details
	url := fmt.Sprintf("%s/api/v1/surveys/%d", surveyServiceURL, surveyID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
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

// API format (snake_case from SurveyManagementService)
type SurveyDetailFromAPI struct {
	ID                     uint              `json:"id"`
	Title                  string            `json:"title"`
	Description            string            `json:"description"`
	ConductorID            uint              `json:"conductor_id"`
	IsSelfRecruitment      bool              `json:"is_self_recruitment"`
	Status                 string            `json:"status"`
	IsQuiz                 bool              `json:"is_quiz"`
	PassingScorePercentage *int              `json:"passing_score_percentage"`
	Questions              []QuestionFromAPI `json:"questions"`
}

type QuestionFromAPI struct {
	ID             uint            `json:"id"`
	SurveyID       uint            `json:"survey_id"`
	QuestionText   string          `json:"question_text"`
	QuestionType   string          `json:"question_type"`
	Options        []OptionFromAPI `json:"options,omitempty"`
	CorrectAnswers string          `json:"correct_answers"`
	BranchingLogic string          `json:"branching_logic"`
	Mandatory      bool            `json:"mandatory"`
	Points         int             `json:"points"`
	Explanation    string          `json:"explanation"`
}

type OptionFromAPI struct {
	ID         uint   `json:"id"`
	QuestionID uint   `json:"question_id"`
	OptionText string `json:"option_text"`
}

// Frontend format (camelCase for JavaScript)
type SurveyDetail struct {
	ID                uint       `json:"id"`
	Title             string     `json:"title"`
	Description       string     `json:"description"`
	ConductorID       uint       `json:"conductorId"`
	IsSelfRecruitment bool       `json:"isSelfRecruitment"`
	Status            string     `json:"status"`
	Questions         []Question `json:"questions"`
}

type Question struct {
	ID             uint     `json:"id"`
	SurveyID       uint     `json:"surveyId"`
	QuestionText   string   `json:"questionText"`
	QuestionType   string   `json:"questionType"`
	Options        []Option `json:"options,omitempty"`
	CorrectAnswers string   `json:"correctAnswers"`
	BranchingLogic string   `json:"branchingLogic"`
	Mandatory      bool     `json:"mandatory"`
}

type Option struct {
	ID         uint   `json:"id"`
	QuestionID uint   `json:"questionId"`
	OptionText string `json:"optionText"`
}

// Converter function
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
		questions[i] = Question{
			ID:             q.ID,
			SurveyID:       q.SurveyID,
			QuestionText:   q.QuestionText,
			QuestionType:   q.QuestionType,
			Options:        options,
			CorrectAnswers: q.CorrectAnswers,
			BranchingLogic: q.BranchingLogic,
			Mandatory:      q.Mandatory,
		}
	}
	return &SurveyDetail{
		ID:                apiSurvey.ID,
		Title:             apiSurvey.Title,
		Description:       apiSurvey.Description,
		ConductorID:       apiSurvey.ConductorID,
		IsSelfRecruitment: apiSurvey.IsSelfRecruitment,
		Status:            apiSurvey.Status,
		Questions:         questions,
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
			SessionID:    sessionID,
			QuestionID:   input.QuestionID,
			ResponseData: datatypes.JSON(responseDataJSON),
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

// Response structure for survey results/analytics
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
