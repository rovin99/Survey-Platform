// Description: This file contains the implementation of the SurveyService interface. It provides methods to create a survey, save a section, save a draft, publish a survey, get progress of a survey, and get a survey by ID.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Repository"
)

type SurveyService interface {
	CreateSurvey(ctx context.Context, survey *models.Survey) error
	SaveSection(ctx context.Context, surveyID uint, questions []models.Question, mediaFiles []models.SurveyMediaFile, branchingRules []models.BranchingRule) error
	CreateDraft(ctx context.Context, surveyID, conductorID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error)
	UpdateDraft(ctx context.Context, draftID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error)
	PublishSurvey(ctx context.Context, surveyID uint) error
	GetProgress(ctx context.Context, surveyID uint) (*SurveyProgress, error)
	GetSurvey(ctx context.Context, surveyID uint) (*models.Survey, error)
	GetDraft(ctx context.Context, draftID uint) (*models.SurveyDraft, error)
	PublishDraftToSurvey(ctx context.Context, draftID uint) (uint, error)
	GetLatestDraft(ctx context.Context, surveyID uint) (*models.SurveyDraft, error)
	ListSurveysByConductor(ctx context.Context, conductorID uint) ([]models.Survey, error)
	ListDraftsByConductor(ctx context.Context, conductorID uint) ([]models.SurveyDraft, error)
	DeleteDraft(ctx context.Context, draftID uint, conductorID uint) error
	DeleteSurvey(ctx context.Context, surveyID uint, conductorID uint) error
}

type SurveyProgress struct {
	SurveyID          uint      `json:"survey_id"`
	BasicInfoComplete bool      `json:"basic_info_complete"`
	QuestionsCount    int       `json:"questions_count"`
	MediaCount        int       `json:"media_count"`
	LastSaved         time.Time `json:"last_saved"`
	Status            string    `json:"status"`
}

type surveyService struct {
	surveyRepo      repository.SurveyRepository
	surveyDraftRepo repository.SurveyDraftRepository
}

func NewSurveyService(surveyRepo repository.SurveyRepository, surveyDraftRepo repository.SurveyDraftRepository) SurveyService {
	return &surveyService{
		surveyRepo:      surveyRepo,
		surveyDraftRepo: surveyDraftRepo,
	}
}

func (s *surveyService) CreateSurvey(ctx context.Context, survey *models.Survey) error {
	survey.Status = "DRAFT"
	survey.CreatedAt = time.Now()
	survey.UpdatedAt = time.Now()

	return s.surveyRepo.Create(ctx, survey)
}

func (s *surveyService) SaveSection(ctx context.Context, surveyID uint, questions []models.Question, mediaFiles []models.SurveyMediaFile, branchingRules []models.BranchingRule) error {
	return s.surveyRepo.Transaction(ctx, func(tx *gorm.DB) error {
		survey, err := s.surveyRepo.GetByID(ctx, surveyID)
		if err != nil {
			return err
		}

		// Save questions
		for i := range questions {
			questions[i].SurveyID = surveyID
			questions[i].CreatedAt = time.Now()
			questions[i].UpdatedAt = time.Now()
		}

		// Save media files
		for i := range mediaFiles {
			mediaFiles[i].SurveyID = surveyID
			mediaFiles[i].CreatedAt = time.Now()
		}

		// Save branching rules
		for i := range branchingRules {
			branchingRules[i].SurveyID = surveyID
			branchingRules[i].CreatedAt = time.Now()
			branchingRules[i].UpdatedAt = time.Now()
		}

		survey.Questions = append(survey.Questions, questions...)
		survey.UpdatedAt = time.Now()

		return s.surveyRepo.Update(ctx, survey)
	})
}

// Helper function to pretty print JSON content for logging
func prettyPrintJSON(content models.JSONContent) string {
	var prettyContent bytes.Buffer
	if err := json.Indent(&prettyContent, []byte(content), "", "  "); err == nil {
		return prettyContent.String()
	}
	return string(content)
}

// normalizeDisplayMode ensures a valid display mode (GORM's column default only applies on
// zero-value inserts, so an empty string on update would otherwise persist as blank).
func normalizeDisplayMode(mode string) string {
	if mode != "all_at_once" {
		return "one_by_one"
	}
	return mode
}

// Helper function to create a new draft object
func newDraft(surveyID, conductorID uint, content models.JSONContent, lastEditedQuestion uint) *models.SurveyDraft {
	now := time.Now()
	return &models.SurveyDraft{
		SurveyID:           surveyID,
		ConductorID:        conductorID, // 🔐 Track who owns this draft
		DraftContent:       content,
		LastEditedQuestion: lastEditedQuestion,
		LastSaved:          now,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}

func (s *surveyService) CreateDraft(ctx context.Context, surveyID, conductorID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error) {
	log.Printf("Service creating draft for conductor %d with content: %s", conductorID, prettyPrintJSON(content))
	draft := newDraft(surveyID, conductorID, content, lastEditedQuestion)
	return s.surveyDraftRepo.CreateDraft(ctx, draft)
}

func (s *surveyService) UpdateDraft(ctx context.Context, draftID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error) {
	log.Printf("Service updating draft %d with content: %s", draftID, prettyPrintJSON(content))

	draft, err := s.surveyDraftRepo.GetByID(ctx, draftID)
	if err != nil {
		return nil, err
	}

	draft.DraftContent = content
	draft.LastEditedQuestion = lastEditedQuestion
	draft.LastSaved = time.Now()
	draft.UpdatedAt = time.Now()

	return s.surveyDraftRepo.Update(ctx, draft)
}

func (s *surveyService) PublishSurvey(ctx context.Context, surveyID uint) error {
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return err
	}

	if len(survey.Questions) == 0 {
		return errors.New("cannot publish survey without questions")
	}

	survey.Status = "PUBLISHED"
	survey.UpdatedAt = time.Now()
	return s.surveyRepo.Update(ctx, survey)
}

func (s *surveyService) GetProgress(ctx context.Context, surveyID uint) (*SurveyProgress, error) {
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return nil, err
	}

	// Count media files (assuming we have a method to get media files)
	mediaCount := 0 // Implementation needed

	return &SurveyProgress{
		SurveyID:          survey.SurveyID,
		BasicInfoComplete: survey.Title != "" && survey.Description != "",
		QuestionsCount:    len(survey.Questions),
		MediaCount:        mediaCount,
		LastSaved:         survey.UpdatedAt,
		Status:            survey.Status,
	}, nil
}

func (s *surveyService) GetSurvey(ctx context.Context, surveyID uint) (*models.Survey, error) {
	return s.surveyRepo.GetByID(ctx, surveyID)
}

func (s *surveyService) GetDraft(ctx context.Context, draftID uint) (*models.SurveyDraft, error) {
	return s.surveyDraftRepo.GetByID(ctx, draftID)
}

func (s *surveyService) PublishDraftToSurvey(ctx context.Context, draftID uint) (uint, error) {
	// Get the draft by ID
	draft, err := s.surveyDraftRepo.GetByID(ctx, draftID)
	if err != nil {
		return 0, err
	}

	// Parse the draft content
	var draftContent struct {
		BasicInfo struct {
			Title                  string `json:"title"`
			Description            string `json:"description"`
			IsSelfRecruitment      bool   `json:"is_self_recruitment"`
			ConductorID            uint   `json:"conductor_id"`
			Status                 string `json:"status"`
			// Distribution settings
			AllowAnonymous         bool   `json:"allow_anonymous"`
			// Display mode
			QuestionDisplayMode    string `json:"question_display_mode"`
			// Quiz-specific fields
			IsQuiz                   bool   `json:"is_quiz"`
			TimeLimitMinutes         *int   `json:"time_limit_minutes"`
			PassingScorePercentage   *int   `json:"passing_score_percentage"`
			ShowCorrectAnswers       bool   `json:"show_correct_answers"`
			ShuffleQuestions         bool   `json:"shuffle_questions"`
			ShuffleOptions           bool   `json:"shuffle_options"`
			MaxAttempts              *int   `json:"max_attempts"`
			RequiresManualEvaluation bool   `json:"requires_manual_evaluation"`
			// Custom participant fields
			ParticipantFields      datatypes.JSON `json:"participant_fields"`
		} `json:"basicInfo"`
		Questions []struct {
			QuestionID     uint   `json:"question_id"`
			QuestionText   string `json:"question_text"`
			QuestionType   string `json:"question_type"`
			Mandatory      bool   `json:"mandatory"`
			BranchingLogic string `json:"branching_logic"`
			CorrectAnswers string `json:"correct_answers"`
			// Quiz-specific fields
			Points      int    `json:"points"`
			Explanation string `json:"explanation"`
			// Participant justification settings (choice questions)
			RequiresJustification bool `json:"requires_justification"`
			JustificationRequired bool `json:"justification_required"`
		} `json:"questions"`
		Options []struct {
			OptionText string `json:"option_text"`
			QuestionID uint   `json:"question_id"`
		} `json:"options"`
		MediaFiles []struct {
			QuestionID uint   `json:"question_id"`
			FileURL    string `json:"file_url"`
			FileType   string `json:"file_type"`
		} `json:"mediaFiles"`
	}

	// Unmarshal the JSON content
	if err := json.Unmarshal([]byte(draft.DraftContent), &draftContent); err != nil {
		log.Printf("Error unmarshaling draft content: %v", err)
		log.Printf("Draft content: %s", draft.DraftContent)
		return 0, err
	}

	// SECURITY: Use ConductorID from draft record (set at creation), NOT from request body
	// This prevents conductor ID spoofing attacks
	trustedConductorID := draft.ConductorID

	// Begin a transaction
	return s.surveyRepo.TransactionWithResult(ctx, func(tx *gorm.DB) (uint, error) {
		// Check if survey exists or create a new one
		var survey models.Survey
		var surveyID uint

		// Try to update existing survey if survey ID is provided and valid
		if draft.SurveyID > 0 {
			existingSurvey, err := s.surveyRepo.GetByIDWithTx(ctx, tx, draft.SurveyID)
			if err == nil {
				// Survey exists, update it
				log.Printf("Updating existing survey with ID %d", draft.SurveyID)

				// Update basic info
				existingSurvey.Title = draftContent.BasicInfo.Title
				existingSurvey.Description = draftContent.BasicInfo.Description
				existingSurvey.IsSelfRecruitment = draftContent.BasicInfo.IsSelfRecruitment
				existingSurvey.Status = "PUBLISHED"
				existingSurvey.UpdatedAt = time.Now()
				// Update distribution settings
				existingSurvey.AllowAnonymous = draftContent.BasicInfo.AllowAnonymous
				existingSurvey.QuestionDisplayMode = normalizeDisplayMode(draftContent.BasicInfo.QuestionDisplayMode)
				// Update quiz-specific fields
				existingSurvey.IsQuiz = draftContent.BasicInfo.IsQuiz
				existingSurvey.TimeLimitMinutes = draftContent.BasicInfo.TimeLimitMinutes
				existingSurvey.PassingScorePercentage = draftContent.BasicInfo.PassingScorePercentage
				existingSurvey.ShowCorrectAnswers = draftContent.BasicInfo.ShowCorrectAnswers
				existingSurvey.ShuffleQuestions = draftContent.BasicInfo.ShuffleQuestions
				existingSurvey.ShuffleOptions = draftContent.BasicInfo.ShuffleOptions
				existingSurvey.MaxAttempts = draftContent.BasicInfo.MaxAttempts
				existingSurvey.RequiresManualEvaluation = draftContent.BasicInfo.RequiresManualEvaluation
				// Update custom participant fields
				if len(draftContent.BasicInfo.ParticipantFields) > 0 {
					existingSurvey.ParticipantFields = draftContent.BasicInfo.ParticipantFields
				}

				if err := s.surveyRepo.UpdateWithTx(ctx, tx, existingSurvey); err != nil {
					return 0, err
				}

				surveyID = existingSurvey.SurveyID

				// First delete options, then questions
				if err := s.surveyRepo.DeleteOptionsWithTx(ctx, tx, surveyID); err != nil {
					return 0, err
				}

				if err := s.surveyRepo.DeleteQuestionsWithTx(ctx, tx, surveyID); err != nil {
					return 0, err
				}

				// Delete existing media files
				if err := s.surveyRepo.DeleteMediaFilesWithTx(ctx, tx, surveyID); err != nil {
					return 0, err
				}
			} else {
				// If survey doesn't exist, treat as new survey
				log.Printf("Survey with ID %d not found, creating new survey instead", draft.SurveyID)

				// SECURITY: Use trustedConductorID from draft, not from request body
				survey = models.Survey{
					Title:                    draftContent.BasicInfo.Title,
					Description:              draftContent.BasicInfo.Description,
					IsSelfRecruitment:        draftContent.BasicInfo.IsSelfRecruitment,
					ConductorID:              trustedConductorID, // SECURITY: Use trusted ID
					Status:                   "PUBLISHED",
					AllowAnonymous:           draftContent.BasicInfo.AllowAnonymous,
					QuestionDisplayMode:      normalizeDisplayMode(draftContent.BasicInfo.QuestionDisplayMode),
					IsQuiz:                   draftContent.BasicInfo.IsQuiz,
					TimeLimitMinutes:         draftContent.BasicInfo.TimeLimitMinutes,
					PassingScorePercentage:   draftContent.BasicInfo.PassingScorePercentage,
					ShowCorrectAnswers:       draftContent.BasicInfo.ShowCorrectAnswers,
					ShuffleQuestions:         draftContent.BasicInfo.ShuffleQuestions,
					ShuffleOptions:           draftContent.BasicInfo.ShuffleOptions,
					MaxAttempts:              draftContent.BasicInfo.MaxAttempts,
					RequiresManualEvaluation: draftContent.BasicInfo.RequiresManualEvaluation,
					ParticipantFields:        draftContent.BasicInfo.ParticipantFields,
					CreatedAt:                time.Now(),
					UpdatedAt:                time.Now(),
				}

				if err := s.surveyRepo.CreateWithTx(ctx, tx, &survey); err != nil {
					return 0, err
				}

				surveyID = survey.SurveyID
			}
		} else {
			// SECURITY: Use trustedConductorID from draft, not from request body
			survey = models.Survey{
				Title:                    draftContent.BasicInfo.Title,
				Description:              draftContent.BasicInfo.Description,
				IsSelfRecruitment:        draftContent.BasicInfo.IsSelfRecruitment,
				ConductorID:              trustedConductorID, // SECURITY: Use trusted ID
				Status:                   "PUBLISHED",
				AllowAnonymous:           draftContent.BasicInfo.AllowAnonymous,
				QuestionDisplayMode:      normalizeDisplayMode(draftContent.BasicInfo.QuestionDisplayMode),
				IsQuiz:                   draftContent.BasicInfo.IsQuiz,
				TimeLimitMinutes:         draftContent.BasicInfo.TimeLimitMinutes,
				PassingScorePercentage:   draftContent.BasicInfo.PassingScorePercentage,
				ShowCorrectAnswers:       draftContent.BasicInfo.ShowCorrectAnswers,
				ShuffleQuestions:         draftContent.BasicInfo.ShuffleQuestions,
				ShuffleOptions:           draftContent.BasicInfo.ShuffleOptions,
				MaxAttempts:              draftContent.BasicInfo.MaxAttempts,
				RequiresManualEvaluation: draftContent.BasicInfo.RequiresManualEvaluation,
				ParticipantFields:        draftContent.BasicInfo.ParticipantFields,
				CreatedAt:                time.Now(),
				UpdatedAt:                time.Now(),
			}

			if err := s.surveyRepo.CreateWithTx(ctx, tx, &survey); err != nil {
				return 0, err
			}

			surveyID = survey.SurveyID
		}

		// Create a map to store question objects by ID for later reference
		questionMap := make(map[uint]models.Question)

		// Add questions (skip blank questions with no text)
		for _, q := range draftContent.Questions {
			if strings.TrimSpace(q.QuestionText) == "" {
				log.Printf("Skipping blank question with ID %d (no question text)", q.QuestionID)
				continue
			}

			points := q.Points
			if points == 0 {
				points = 1
			}

			question := models.Question{
				SurveyID:       surveyID,
				QuestionText:   q.QuestionText,
				QuestionType:   q.QuestionType,
				Mandatory:      q.Mandatory,
				BranchingLogic: q.BranchingLogic,
				CorrectAnswers: q.CorrectAnswers,
				// Quiz-specific fields
				Points:      points,
				Explanation: q.Explanation,
				// Participant justification settings
				RequiresJustification: q.RequiresJustification,
				JustificationRequired: q.JustificationRequired,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}

			if err := s.surveyRepo.CreateQuestionWithTx(ctx, tx, &question); err != nil {
				return 0, err
			}

			// Store the created question with its new ID
			questionMap[q.QuestionID] = question
		}

		// Add options for multiple-choice questions
		for _, opt := range draftContent.Options {
			// Get the created question using the original question_id
			question, exists := questionMap[opt.QuestionID]
			if !exists {
				// Skip if question doesn't exist (should not happen with valid data)
				log.Printf("Warning: Option references non-existent question ID: %d", opt.QuestionID)
				continue
			}

			option := models.Option{
				QuestionID: question.QuestionID, // Use the new question ID
				OptionText: opt.OptionText,
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
			}

			if err := tx.Create(&option).Error; err != nil {
				return 0, err
			}
		}

		// Add media files
		for _, m := range draftContent.MediaFiles {
			// Get the created question using the original question_id
			question, exists := questionMap[m.QuestionID]
			if !exists {
				// Skip if question doesn't exist
				log.Printf("Warning: Media file references non-existent question ID: %d", m.QuestionID)
				continue
			}

			mediaFile := models.SurveyMediaFile{
				SurveyID:   surveyID,
				QuestionID: question.QuestionID, // Use the new question ID
				FileURL:    m.FileURL,
				FileType:   m.FileType,
				CreatedAt:  time.Now(),
			}

			if err := s.surveyRepo.CreateMediaFileWithTx(ctx, tx, &mediaFile); err != nil {
				return 0, err
			}
		}

		// Delete all drafts for this survey
		if err := s.surveyDraftRepo.DeleteAllForSurveyWithTx(ctx, tx, surveyID); err != nil {
			return 0, err
		}

		// Also delete the originating draft by ID. For a brand-new survey the draft's survey_id is 0,
		// so the survey-id sweep above wouldn't catch it — without this the draft lingers on the dashboard.
		if err := s.surveyDraftRepo.DeleteByIDWithTx(ctx, tx, draft.DraftID); err != nil {
			return 0, err
		}

		return surveyID, nil
	})
}

func (s *surveyService) GetLatestDraft(ctx context.Context, surveyID uint) (*models.SurveyDraft, error) {
	return s.surveyDraftRepo.GetLatestDraft(ctx, surveyID)
}

func (s *surveyService) ListSurveysByConductor(ctx context.Context, conductorID uint) ([]models.Survey, error) {
	return s.surveyRepo.List(ctx, conductorID)
}

func (s *surveyService) ListDraftsByConductor(ctx context.Context, conductorID uint) ([]models.SurveyDraft, error) {
	return s.surveyDraftRepo.ListByConductor(ctx, conductorID)
}

func (s *surveyService) DeleteDraft(ctx context.Context, draftID uint, conductorID uint) error {
	draft, err := s.surveyDraftRepo.GetByID(ctx, draftID)
	if err != nil {
		return errors.New("draft not found")
	}
	if draft.ConductorID != conductorID {
		return errors.New("unauthorized: you do not own this draft")
	}
	return s.surveyDraftRepo.Delete(ctx, draftID)
}

func (s *surveyService) DeleteSurvey(ctx context.Context, surveyID uint, conductorID uint) error {
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return errors.New("survey not found")
	}

	if survey.ConductorID != conductorID {
		return errors.New("unauthorized: you do not own this survey")
	}

	return s.surveyRepo.Transaction(ctx, func(tx *gorm.DB) error {
		sid := surveyID

		// Delete in dependency order (children first)
		tablesToClean := []struct {
			query string
			desc  string
		}{
			// Answers belong to sessions which belong to survey
			{`DELETE FROM answers WHERE session_id IN (SELECT session_id FROM survey_sessions WHERE survey_id = ?)`, "answers"},
			// Participant drafts belong to sessions
			{`DELETE FROM participant_survey_drafts WHERE session_id IN (SELECT session_id FROM survey_sessions WHERE survey_id = ?)`, "participant drafts"},
			// Question evaluations belong to sessions
			{`DELETE FROM question_evaluations WHERE session_id IN (SELECT session_id FROM survey_sessions WHERE survey_id = ?)`, "question evaluations"},
			// Sessions
			{`DELETE FROM survey_sessions WHERE survey_id = ?`, "sessions"},
			// Options belong to questions which belong to survey
			{`DELETE FROM options WHERE question_id IN (SELECT question_id FROM questions WHERE survey_id = ?)`, "options"},
			// Media files
			{`DELETE FROM survey_media_files WHERE survey_id = ?`, "media files"},
			// Branching rules
			{`DELETE FROM branching_rules WHERE survey_id = ?`, "branching rules"},
			// Questions
			{`DELETE FROM questions WHERE survey_id = ?`, "questions"},
			// Access controls & logs
			{`DELETE FROM survey_access_logs WHERE survey_id = ?`, "access logs"},
			{`DELETE FROM survey_access_controls WHERE survey_id = ?`, "access controls"},
			// Invitations
			{`DELETE FROM survey_invitations WHERE survey_id = ?`, "invitations"},
			// Requirements
			{`DELETE FROM survey_requirements WHERE survey_id = ?`, "requirements"},
			// Drafts
			{`DELETE FROM survey_drafts WHERE survey_id = ?`, "drafts"},
			// Survey itself
			{`DELETE FROM surveys WHERE survey_id = ?`, "survey"},
		}

		for _, t := range tablesToClean {
			if err := tx.Exec(t.query, sid).Error; err != nil {
				log.Printf("Error deleting %s for survey %d: %v", t.desc, sid, err)
				return err
			}
		}

		log.Printf("Survey %d and all related data deleted successfully", sid)
		return nil
	})
}
