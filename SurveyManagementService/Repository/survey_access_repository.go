package repository

import (
	"context"
	"errors"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"gorm.io/gorm"
)

type SurveyAccessRepository interface {
	Create(ctx context.Context, control *models.SurveyAccessControl) error
	GetByToken(ctx context.Context, token string) (*models.SurveyAccessControl, error)
	GetBySurveyID(ctx context.Context, surveyID uint) (*models.SurveyAccessControl, error)
	Update(ctx context.Context, control *models.SurveyAccessControl) error
	Delete(ctx context.Context, surveyID uint) error
	CreateLog(ctx context.Context, log *models.SurveyAccessLog) error
	GetLogs(ctx context.Context, surveyID uint, limit, offset int) ([]models.SurveyAccessLog, error)
}

type surveyAccessRepository struct {
	db *gorm.DB
}

func NewSurveyAccessRepository(db *gorm.DB) SurveyAccessRepository {
	return &surveyAccessRepository{db: db}
}

func (r *surveyAccessRepository) Create(ctx context.Context, control *models.SurveyAccessControl) error {
	return r.db.WithContext(ctx).Create(control).Error
}

func (r *surveyAccessRepository) GetByToken(ctx context.Context, token string) (*models.SurveyAccessControl, error) {
	var control models.SurveyAccessControl
	err := r.db.WithContext(ctx).Where("share_token = ? AND is_active = ?", token, true).First(&control).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("share link not found or inactive")
		}
		return nil, err
	}
	return &control, nil
}

func (r *surveyAccessRepository) GetBySurveyID(ctx context.Context, surveyID uint) (*models.SurveyAccessControl, error) {
	var control models.SurveyAccessControl
	err := r.db.WithContext(ctx).Where("survey_id = ?", surveyID).First(&control).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("sharing not enabled for this survey")
		}
		return nil, err
	}
	return &control, nil
}

func (r *surveyAccessRepository) Update(ctx context.Context, control *models.SurveyAccessControl) error {
	return r.db.WithContext(ctx).Save(control).Error
}

func (r *surveyAccessRepository) Delete(ctx context.Context, surveyID uint) error {
	return r.db.WithContext(ctx).Where("survey_id = ?", surveyID).Delete(&models.SurveyAccessControl{}).Error
}

func (r *surveyAccessRepository) CreateLog(ctx context.Context, log *models.SurveyAccessLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *surveyAccessRepository) GetLogs(ctx context.Context, surveyID uint, limit, offset int) ([]models.SurveyAccessLog, error) {
	var logs []models.SurveyAccessLog
	err := r.db.WithContext(ctx).
		Where("survey_id = ?", surveyID).
		Order("accessed_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error
	return logs, err
}
