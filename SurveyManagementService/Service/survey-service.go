// Description: This file contains the implementation of the SurveyService interface. It provides methods to create a survey, save a section, save a draft, publish a survey, get progress of a survey, and get a survey by ID.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Repository"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/types"
)

type SurveyService interface {
	CreateSurvey(ctx context.Context, survey *models.Survey) error
	SaveSection(ctx context.Context, surveyID uint, questions []models.Question, mediaFiles []models.SurveyMediaFile, branchingRules []models.BranchingRule) error
	CreateDraft(ctx context.Context, surveyID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error)
	UpdateDraft(ctx context.Context, draftID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error)
	PublishSurvey(ctx context.Context, surveyID uint) error
	GetProgress(ctx context.Context, surveyID uint) (*SurveyProgress, error)
	GetSurvey(ctx context.Context, surveyID uint) (*models.Survey, error)
	GetDraft(ctx context.Context, draftID uint) (*models.SurveyDraft, error)
	PublishDraftToSurvey(ctx context.Context, draftID uint) (uint, error)
	GetLatestDraft(ctx context.Context, surveyID uint) (*models.SurveyDraft, error)
	GetSurveyResults(ctx context.Context, surveyID uint) (*types.SurveyResults, error)
	GetSurveySummary(ctx context.Context, surveyID uint) (*types.SurveySummary, error)
	GetDetailedResults(ctx context.Context, surveyID uint) (*types.DetailedResults, error)
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

// Helper function to create a new draft object
func newDraft(surveyID uint, content models.JSONContent, lastEditedQuestion uint) *models.SurveyDraft {
	now := time.Now()
	return &models.SurveyDraft{
		SurveyID:           surveyID,
		DraftContent:       content,
		LastEditedQuestion: lastEditedQuestion,
		LastSaved:          now,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}

func (s *surveyService) CreateDraft(ctx context.Context, surveyID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error) {
	log.Printf("Service creating draft with content: %s", prettyPrintJSON(content))
	draft := newDraft(surveyID, content, lastEditedQuestion)
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
			Title             string `json:"title"`
			Description       string `json:"description"`
			IsSelfRecruitment bool   `json:"is_self_recruitment"`
			ConductorID       uint   `json:"conductor_id"`
			Status            string `json:"status"`
		} `json:"basicInfo"`
		Questions []struct {
			QuestionID     uint   `json:"question_id"`
			QuestionText   string `json:"question_text"`
			QuestionType   string `json:"question_type"`
			Mandatory      bool   `json:"mandatory"`
			BranchingLogic string `json:"branching_logic"`
			CorrectAnswers string `json:"correct_answers"`
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

	// Begin a transaction
	return s.surveyRepo.TransactionWithResult(ctx, func(tx *gorm.DB) (uint, error) {
		// Check if survey exists or create a new one
		var survey models.Survey
		var surveyID uint

		if draft.SurveyID > 0 {
			// Update existing survey
			existingSurvey, err := s.surveyRepo.GetByIDWithTx(ctx, tx, draft.SurveyID)
			if err != nil {
				return 0, err
			}

			// Update basic info
			existingSurvey.Title = draftContent.BasicInfo.Title
			existingSurvey.Description = draftContent.BasicInfo.Description
			existingSurvey.IsSelfRecruitment = draftContent.BasicInfo.IsSelfRecruitment
			existingSurvey.Status = "PUBLISHED"
			existingSurvey.UpdatedAt = time.Now()

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
			// Create new survey
			survey = models.Survey{
				Title:             draftContent.BasicInfo.Title,
				Description:       draftContent.BasicInfo.Description,
				IsSelfRecruitment: draftContent.BasicInfo.IsSelfRecruitment,
				ConductorID:       draftContent.BasicInfo.ConductorID,
				Status:            "PUBLISHED",
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			}

			if err := s.surveyRepo.CreateWithTx(ctx, tx, &survey); err != nil {
				return 0, err
			}

			surveyID = survey.SurveyID
		}

		// Create a map to store question objects by ID for later reference
		questionMap := make(map[uint]models.Question)

		// Add questions
		for _, q := range draftContent.Questions {
			question := models.Question{
				SurveyID:       surveyID,
				QuestionText:   q.QuestionText,
				QuestionType:   q.QuestionType,
				Mandatory:      q.Mandatory,
				BranchingLogic: q.BranchingLogic,
				CorrectAnswers: q.CorrectAnswers,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
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

		return surveyID, nil
	})
}

func (s *surveyService) GetLatestDraft(ctx context.Context, surveyID uint) (*models.SurveyDraft, error) {
	return s.surveyDraftRepo.GetLatestDraft(ctx, surveyID)
}

func (s *surveyService) GetSurveySummary(ctx context.Context, surveyID uint) (*types.SurveySummary, error) {
	// Get the survey to verify it exists and get questions
	log.Printf("[DEBUG] Service: Getting survey with ID: %d", surveyID)
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		log.Printf("[ERROR] Service: Failed to get survey: %v", err)
		return nil, err
	}

	// Get all completed sessions for this survey
	log.Printf("[DEBUG] Service: Getting completed sessions for survey %d", surveyID)
	sessions, err := s.surveyRepo.GetCompletedSessions(ctx, surveyID)
	if err != nil {
		log.Printf("[ERROR] Service: Failed to get completed sessions: %v", err)
		return nil, err
	}

	// Calculate total responses and average time
	totalResponses := len(sessions)
	var totalTimeSeconds float64

	// Process timeline data
	timelineMap := make(map[string]int)
	for _, session := range sessions {
		duration := session.UpdatedAt.Sub(session.CreatedAt)
		totalTimeSeconds += duration.Seconds()

		// Format date as YYYY-MM-DD for timeline
		date := session.CreatedAt.Format("2006-01-02")
		timelineMap[date]++
	}

	averageTimeSeconds := 0.0
	if totalResponses > 0 {
		averageTimeSeconds = totalTimeSeconds / float64(totalResponses)
	}

	// Convert timeline map to sorted array
	timelineData := make([]types.TimelinePoint, 0)
	for dateStr, count := range timelineMap {
		date, _ := time.Parse("2006-01-02", dateStr)
		timelineData = append(timelineData, types.TimelinePoint{
			Date:      date.Format("2006-01-02"),
			Responses: count,
		})
	}

	// Sort timeline data by date
	sort.Slice(timelineData, func(i, j int) bool {
		return timelineData[i].Date < timelineData[j].Date
	})

	// Process demographic questions
	var demographics types.SurveyDemographics

	for _, question := range survey.Questions {
		// Get all answers for this question
		answers, err := s.surveyRepo.GetAnswersForQuestion(ctx, question.QuestionID)
		if err != nil {
			log.Printf("[ERROR] Service: Failed to get answers for question %d: %v", question.QuestionID, err)
			return nil, err
		}

		// Process responses
		responseMap := make(map[string]int)
		for _, answer := range answers {
			responseMap[answer.Response]++
		}

		// Convert to ResponseSummary array
		responses := make([]types.ResponseSummary, 0)
		for responseText, count := range responseMap {
			percentage := float64(count) / float64(totalResponses) * 100
			responses = append(responses, types.ResponseSummary{
				ResponseText: responseText,
				Count:        count,
				Percentage:   percentage,
			})
		}

		// Assign to appropriate demographic category
		questionText := strings.ToLower(question.QuestionText)
		switch {
		case strings.Contains(questionText, "gender"):
			demographics.Gender = responses
		case strings.Contains(questionText, "location") || strings.Contains(questionText, "geography"):
			demographics.Geography = responses
		case strings.Contains(questionText, "age"):
			demographics.AgeGroups = responses
		}
	}

	// Construct final results
	results := &types.SurveySummary{
		TotalResponses:     totalResponses,
		AverageTimeSeconds: averageTimeSeconds,
		TimelineData:       timelineData,
		Demographics:       demographics,
	}

	return results, nil
}

func (s *surveyService) GetDetailedResults(ctx context.Context, surveyID uint) (*types.DetailedResults, error) {
	// Get the survey to verify it exists and get questions
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return nil, err
	}

	// Get all completed sessions for this survey
	sessions, err := s.surveyRepo.GetCompletedSessions(ctx, surveyID)
	if err != nil {
		return nil, err
	}

	totalResponses := len(sessions)
	questionResponses := make([]types.QuestionResponseStats, 0)

	// Process each question
	for _, question := range survey.Questions {
		// Skip demographic questions
		questionText := strings.ToLower(question.QuestionText)
		if strings.Contains(questionText, "gender") ||
			strings.Contains(questionText, "location") ||
			strings.Contains(questionText, "geography") ||
			strings.Contains(questionText, "age") {
			continue
		}

		// Get all answers for this question
		answers, err := s.surveyRepo.GetAnswersForQuestion(ctx, question.QuestionID)
		if err != nil {
			return nil, err
		}

		// Process responses
		responseMap := make(map[string]int)
		for _, answer := range answers {
			responseMap[answer.Response]++
		}

		// Convert to ResponseSummary array
		responses := make([]types.ResponseSummary, 0)
		for responseText, count := range responseMap {
			percentage := float64(count) / float64(totalResponses) * 100
			responses = append(responses, types.ResponseSummary{
				ResponseText: responseText,
				Count:        count,
				Percentage:   percentage,
			})
		}

		// Add question stats
		questionResponses = append(questionResponses, types.QuestionResponseStats{
			QuestionID:   question.QuestionID,
			QuestionText: question.QuestionText,
			QuestionType: question.QuestionType,
			Responses:    responses,
		})
	}

	// Construct final results
	results := &types.DetailedResults{
		TotalResponses:    totalResponses,
		QuestionResponses: questionResponses,
	}

	return results, nil
}

func (s *surveyService) GetSurveyResults(ctx context.Context, surveyID uint) (*types.SurveyResults, error) {
	// This method is kept for backward compatibility
	// It combines both summary and detailed results
	summary, err := s.GetSurveySummary(ctx, surveyID)
	if err != nil {
		return nil, err
	}

	detailed, err := s.GetDetailedResults(ctx, surveyID)
	if err != nil {
		return nil, err
	}

	return &types.SurveyResults{
		TotalResponses:     summary.TotalResponses,
		AverageTimeSeconds: summary.AverageTimeSeconds,
		QuestionResponses:  detailed.QuestionResponses,
	}, nil
}
