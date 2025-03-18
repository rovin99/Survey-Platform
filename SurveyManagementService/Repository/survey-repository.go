package repository

import (
	"context"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"gorm.io/gorm"
)

type SurveyRepository interface {
	Create(ctx context.Context, survey *models.Survey) error
	GetByID(ctx context.Context, id uint) (*models.Survey, error)
	Update(ctx context.Context, survey *models.Survey) error
	Delete(ctx context.Context, id uint) error
	List(ctx context.Context, conductorID uint) ([]models.Survey, error)
	Transaction(ctx context.Context, fn func(tx *gorm.DB) error) error
	TransactionWithResult(ctx context.Context, fn func(tx *gorm.DB) (uint, error)) (uint, error)
	GetByIDWithTx(ctx context.Context, tx *gorm.DB, id uint) (*models.Survey, error)
	UpdateWithTx(ctx context.Context, tx *gorm.DB, survey *models.Survey) error
	CreateWithTx(ctx context.Context, tx *gorm.DB, survey *models.Survey) error
	DeleteQuestionsWithTx(ctx context.Context, tx *gorm.DB, surveyID uint) error
	DeleteMediaFilesWithTx(ctx context.Context, tx *gorm.DB, surveyID uint) error
	CreateQuestionWithTx(ctx context.Context, tx *gorm.DB, question *models.Question) error
	CreateMediaFileWithTx(ctx context.Context, tx *gorm.DB, mediaFile *models.SurveyMediaFile) error
}

type Transaction interface {
	Create(value interface{}) error
	Save(value interface{}) error
	Delete(value interface{}) error
}

type surveyRepository struct {
	db *gorm.DB
}

func NewSurveyRepository(db *gorm.DB) SurveyRepository {
	return &surveyRepository{db: db}
}

func (r *surveyRepository) Transaction(ctx context.Context, fn func(tx *gorm.DB) error) error {
	return r.db.WithContext(ctx).Transaction(fn)
}

func (r *surveyRepository) Create(ctx context.Context, survey *models.Survey) error {
	return r.db.WithContext(ctx).Create(survey).Error
}

func (r *surveyRepository) GetByID(ctx context.Context, id uint) (*models.Survey, error) {
	var survey models.Survey
	err := r.db.WithContext(ctx).Preload("Questions").First(&survey, id).Error
	return &survey, err
}

func (r *surveyRepository) Update(ctx context.Context, survey *models.Survey) error {
	return r.db.WithContext(ctx).Save(survey).Error
}

func (r *surveyRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Survey{}, id).Error
}

func (r *surveyRepository) List(ctx context.Context, conductorID uint) ([]models.Survey, error) {
	var surveys []models.Survey
	err := r.db.WithContext(ctx).Where("conductor_id = ?", conductorID).Find(&surveys).Error
	return surveys, err
}

func (r *surveyRepository) TransactionWithResult(ctx context.Context, fn func(tx *gorm.DB) (uint, error)) (uint, error) {
	var result uint
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = fn(tx)
		return err
	})
	return result, err
}

func (r *surveyRepository) GetByIDWithTx(ctx context.Context, tx *gorm.DB, id uint) (*models.Survey, error) {
	var survey models.Survey
	err := tx.WithContext(ctx).Preload("Questions").First(&survey, id).Error
	return &survey, err
}

func (r *surveyRepository) UpdateWithTx(ctx context.Context, tx *gorm.DB, survey *models.Survey) error {
	return tx.WithContext(ctx).Save(survey).Error
}

func (r *surveyRepository) CreateWithTx(ctx context.Context, tx *gorm.DB, survey *models.Survey) error {
	return tx.WithContext(ctx).Create(survey).Error
}

func (r *surveyRepository) DeleteQuestionsWithTx(ctx context.Context, tx *gorm.DB, surveyID uint) error {
	return tx.WithContext(ctx).Delete(&models.Question{}, "survey_id = ?", surveyID).Error
}

func (r *surveyRepository) DeleteMediaFilesWithTx(ctx context.Context, tx *gorm.DB, surveyID uint) error {
	return tx.WithContext(ctx).Delete(&models.SurveyMediaFile{}, "survey_id = ?", surveyID).Error
}

func (r *surveyRepository) CreateQuestionWithTx(ctx context.Context, tx *gorm.DB, question *models.Question) error {
	return tx.WithContext(ctx).Create(question).Error
}

func (r *surveyRepository) CreateMediaFileWithTx(ctx context.Context, tx *gorm.DB, mediaFile *models.SurveyMediaFile) error {
	return tx.WithContext(ctx).Create(mediaFile).Error
}
