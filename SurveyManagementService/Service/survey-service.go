// Description: This file contains the implementation of the SurveyService interface. It provides methods to create a survey, save a section, save a draft, publish a survey, get progress of a survey, and get a survey by ID.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
)

type SurveyService interface {
	CreateSurvey(ctx context.Context, survey *models.Survey) error
	SaveSection(ctx context.Context, surveyID uint, questions []models.Question, mediaFiles []models.SurveyMediaFile, branchingRules []models.BranchingRule) error
	SaveDraft(ctx context.Context, surveyID uint, content models.JSONContent, lastEditedQuestion uint) error
	CreateDraft(ctx context.Context, surveyID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error)
	UpdateDraft(ctx context.Context, draftID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error)
	PublishSurvey(ctx context.Context, surveyID uint) error
	GetProgress(ctx context.Context, surveyID uint) (*SurveyProgress, error)
	GetSurvey(ctx context.Context, surveyID uint) (*models.Survey, error)
	GetDraft(ctx context.Context, draftID uint) (*models.SurveyDraft, error)
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

func (s *surveyService) SaveDraft(ctx context.Context, surveyID uint, content models.JSONContent, lastEditedQuestion uint) error {
	draft := &models.SurveyDraft{
		SurveyID:           surveyID,
		DraftContent:       content,
		LastEditedQuestion: lastEditedQuestion,
		LastSaved:          time.Now(),
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
	return s.surveyDraftRepo.SaveDraft(ctx, draft)
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

func (s *surveyService) CreateDraft(ctx context.Context, surveyID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error) {
	// Log the content in a readable format
	var prettyContent bytes.Buffer
	if err := json.Indent(&prettyContent, []byte(content), "", "  "); err == nil {
		log.Printf("Service creating draft with content: %s", prettyContent.String())
	}

	draft := &models.SurveyDraft{
		SurveyID:           surveyID,
		DraftContent:       content,
		LastEditedQuestion: lastEditedQuestion,
		LastSaved:          time.Now(),
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
	return s.surveyDraftRepo.CreateDraft(ctx, draft)
}

func (s *surveyService) UpdateDraft(ctx context.Context, draftID uint, content models.JSONContent, lastEditedQuestion uint) (*models.SurveyDraft, error) {
	// Log the content in a readable format
	var prettyContent bytes.Buffer
	if err := json.Indent(&prettyContent, []byte(content), "", "  "); err == nil {
		log.Printf("Service updating draft %d with content: %s", draftID, prettyContent.String())
	}

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

func (s *surveyService) GetDraft(ctx context.Context, draftID uint) (*models.SurveyDraft, error) {
	return s.surveyDraftRepo.GetByID(ctx, draftID)
}
