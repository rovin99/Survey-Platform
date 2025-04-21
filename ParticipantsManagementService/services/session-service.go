package service

import (
	"context"
	"encoding/json" // Needed for draft content handling
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
	Survey  *MockSurvey                    `json:"survey"`
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
}

type participantServiceImpl struct {
	repo repository.ParticipantRepository
	// Potentially add clients for other services (e.g., survey service client) if needed
	SURVEY_SERVICE_URL string // URL of the survey management service
}

func NewParticipantService(repo repository.ParticipantRepository) ParticipantService {
	return &participantServiceImpl{repo: repo, SURVEY_SERVICE_URL: "http://localhost:3001"}
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

	// For debugging only - log and proceed
	if draft == nil {
		// We could log this but it's normal behavior
	}

	// Create mock survey data for development/testing
	// In a real implementation, this would be fetched from the Survey Management Service
	mockSurvey := &MockSurvey{
		ID:          surveyID,
		Title:       "Student Demographics Survey",
		Description: "A survey to understand student demographics at IITGN",
		Questions: []MockQuestion{
			{
				ID:           5,  // Actual ID from database
				QuestionText: "What is your gender?",
				QuestionType: "MULTIPLE_CHOICE",
				Mandatory:    true,
				CorrectAnswers: "Male,Female,Other",
			},
			{
				ID:           6,  // Actual ID from database
				QuestionText: "What is your age group?",
				QuestionType: "MULTIPLE_CHOICE",
				Mandatory:    true,
				CorrectAnswers: "18-20,21-23,24-26,27+",
			},
			{
				ID:           7,  // Actual ID from database
				QuestionText: "Which state are you from?",
				QuestionType: "MULTIPLE_CHOICE",
				Mandatory:    true,
				CorrectAnswers: "Gujarat,Maharashtra,Delhi,Tamil Nadu,Karnataka",
			},
		},
		IsSelfRecruitment: true,
		Status:            "PUBLISHED",
	}

	return &StartResumeResponse{
		Session: session,
		Draft:   draft,
		Survey:  mockSurvey,
	}, nil
}

// Mock survey types for development/testing
type MockSurvey struct {
	ID                uint           `json:"id"`
	Title             string         `json:"title"`
	Description       string         `json:"description"`
	Questions         []MockQuestion `json:"questions"`
	IsSelfRecruitment bool           `json:"is_self_recruitment"`
	Status            string         `json:"status"`
}

type MockQuestion struct {
	ID             uint   `json:"id"`
	QuestionText   string `json:"question_text"`
	QuestionType   string `json:"question_type"`
	Mandatory      bool   `json:"mandatory"`
	CorrectAnswers string `json:"correct_answers,omitempty"`
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
