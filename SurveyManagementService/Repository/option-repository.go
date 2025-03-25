package repository

import (
	"context"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"gorm.io/gorm"
)

type OptionRepository interface {
	Create(ctx context.Context, option *models.Option) error
	GetByID(ctx context.Context, id uint) (*models.Option, error)
	GetByQuestionID(ctx context.Context, questionID uint) ([]models.Option, error)
	Update(ctx context.Context, option *models.Option) error
	Delete(ctx context.Context, id uint) error
	BatchCreate(ctx context.Context, options []models.Option) error
}

type optionRepository struct {
	db *gorm.DB
}

func NewOptionRepository(db *gorm.DB) OptionRepository {
	return &optionRepository{db: db}
}

func (r *optionRepository) Create(ctx context.Context, option *models.Option) error {
	return r.db.WithContext(ctx).Create(option).Error
}

func (r *optionRepository) GetByID(ctx context.Context, id uint) (*models.Option, error) {
	var option models.Option
	err := r.db.WithContext(ctx).First(&option, id).Error
	return &option, err
}

func (r *optionRepository) GetByQuestionID(ctx context.Context, questionID uint) ([]models.Option, error) {
	var options []models.Option
	err := r.db.WithContext(ctx).Where("question_id = ?", questionID).Find(&options).Error
	return options, err
}

func (r *optionRepository) Update(ctx context.Context, option *models.Option) error {
	return r.db.WithContext(ctx).Save(option).Error
}

func (r *optionRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Option{}, id).Error
}

func (r *optionRepository) BatchCreate(ctx context.Context, options []models.Option) error {
	return r.db.WithContext(ctx).CreateInBatches(options, len(options)).Error
}
