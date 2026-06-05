package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"log"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"gorm.io/gorm"
)

type SurveyDraftRepository interface {
	SaveDraft(ctx context.Context, draft *models.SurveyDraft) error
	CreateDraft(ctx context.Context, draft *models.SurveyDraft) (*models.SurveyDraft, error)
	GetByID(ctx context.Context, draftID uint) (*models.SurveyDraft, error)
	Update(ctx context.Context, draft *models.SurveyDraft) (*models.SurveyDraft, error)
	GetLatestDraft(ctx context.Context, surveyID uint) (*models.SurveyDraft, error)
	ListDrafts(ctx context.Context, surveyID uint) ([]models.SurveyDraft, error)
	ListByConductor(ctx context.Context, conductorID uint) ([]models.SurveyDraft, error)
	DeleteAllForSurveyWithTx(ctx context.Context, tx *gorm.DB, surveyID uint) error
	DeleteByIDWithTx(ctx context.Context, tx *gorm.DB, draftID uint) error
	Delete(ctx context.Context, draftID uint) error
}

type surveyDraftRepository struct {
	db *gorm.DB
}

func NewSurveyDraftRepository(db *gorm.DB) SurveyDraftRepository {
	return &surveyDraftRepository{db: db}
}

func (r *surveyDraftRepository) SaveDraft(ctx context.Context, draft *models.SurveyDraft) error {
	return r.db.WithContext(ctx).Create(draft).Error
}

// CreateDraft creates a new draft and returns it with the generated ID
func (r *surveyDraftRepository) CreateDraft(ctx context.Context, draft *models.SurveyDraft) (*models.SurveyDraft, error) {
	// Log the draft content before saving
	var prettyContent bytes.Buffer
	if len(draft.DraftContent) > 0 {
		if err := json.Indent(&prettyContent, []byte(draft.DraftContent), "", "  "); err == nil {
			log.Printf("Repository creating draft with content: %s", prettyContent.String())
		}
	}

	if err := r.db.WithContext(ctx).Create(draft).Error; err != nil {
		return nil, err
	}
	return draft, nil
}

func (r *surveyDraftRepository) GetLatestDraft(ctx context.Context, surveyID uint) (*models.SurveyDraft, error) {
	var draft models.SurveyDraft
	err := r.db.WithContext(ctx).
		Where("survey_id = ?", surveyID).
		Order("last_saved DESC").
		First(&draft).Error
	return &draft, err
}

func (r *surveyDraftRepository) ListDrafts(ctx context.Context, surveyID uint) ([]models.SurveyDraft, error) {
	var drafts []models.SurveyDraft
	err := r.db.WithContext(ctx).
		Where("survey_id = ?", surveyID).
		Order("last_saved DESC").
		Find(&drafts).Error
	return drafts, err
}

// GetByID retrieves a draft by its ID
func (r *surveyDraftRepository) GetByID(ctx context.Context, draftID uint) (*models.SurveyDraft, error) {
	var draft models.SurveyDraft
	err := r.db.WithContext(ctx).First(&draft, draftID).Error
	if err != nil {
		return nil, err
	}
	return &draft, nil
}

// Update updates an existing draft
func (r *surveyDraftRepository) Update(ctx context.Context, draft *models.SurveyDraft) (*models.SurveyDraft, error) {
	// Log the draft content before updating
	var prettyContent bytes.Buffer
	if len(draft.DraftContent) > 0 {
		if err := json.Indent(&prettyContent, []byte(draft.DraftContent), "", "  "); err == nil {
			log.Printf("Repository updating draft %d with content: %s", draft.DraftID, prettyContent.String())
		}
	}

	err := r.db.WithContext(ctx).Save(draft).Error
	if err != nil {
		return nil, err
	}
	return draft, nil
}

// DeleteAllForSurveyWithTx deletes all drafts for a specific survey within a transaction
func (r *surveyDraftRepository) DeleteAllForSurveyWithTx(ctx context.Context, tx *gorm.DB, surveyID uint) error {
	return tx.WithContext(ctx).Delete(&models.SurveyDraft{}, "survey_id = ?", surveyID).Error
}

// DeleteByIDWithTx deletes a single draft by its ID within a transaction
func (r *surveyDraftRepository) DeleteByIDWithTx(ctx context.Context, tx *gorm.DB, draftID uint) error {
	return tx.WithContext(ctx).Delete(&models.SurveyDraft{}, draftID).Error
}

// Delete removes a single draft by its ID
func (r *surveyDraftRepository) Delete(ctx context.Context, draftID uint) error {
	return r.db.WithContext(ctx).Delete(&models.SurveyDraft{}, draftID).Error
}

// ListByConductor returns all drafts owned by a conductor, most recently saved first
func (r *surveyDraftRepository) ListByConductor(ctx context.Context, conductorID uint) ([]models.SurveyDraft, error) {
	var drafts []models.SurveyDraft
	err := r.db.WithContext(ctx).
		Where("conductor_id = ?", conductorID).
		Order("last_saved DESC").
		Find(&drafts).Error
	return drafts, err
}
