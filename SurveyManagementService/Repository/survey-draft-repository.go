package repository

import (
	"context"
	"gorm.io/gorm"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

type SurveyDraftRepository interface {
    SaveDraft(ctx context.Context, draft *models.SurveyDraft) error
    GetLatestDraft(ctx context.Context, surveyID uint) (*models.SurveyDraft, error)
    ListDrafts(ctx context.Context, surveyID uint) ([]models.SurveyDraft, error)
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