package service

import (
	"context"
	"errors"
	"time"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Repository"
)

type OptionService interface {
	CreateOption(ctx context.Context, option *models.Option) error
	GetOptionByID(ctx context.Context, id uint) (*models.Option, error)
	GetOptionsByQuestionID(ctx context.Context, questionID uint) ([]models.Option, error)
	UpdateOption(ctx context.Context, option *models.Option) error
	DeleteOption(ctx context.Context, id uint) error
	BatchCreateOptions(ctx context.Context, options []models.Option) error
}

type optionService struct {
	optionRepo repository.OptionRepository
}

func NewOptionService(repo repository.OptionRepository) OptionService {
	return &optionService{
		optionRepo: repo,
	}
}

func (s *optionService) CreateOption(ctx context.Context, option *models.Option) error {
	if option == nil {
		return errors.New("nil option provided")
	}

	if option.QuestionID == 0 {
		return errors.New("question ID is required")
	}

	if option.OptionText == "" {
		return errors.New("option text is required")
	}

	option.CreatedAt = time.Now()
	option.UpdatedAt = time.Now()

	return s.optionRepo.Create(ctx, option)
}

func (s *optionService) GetOptionByID(ctx context.Context, id uint) (*models.Option, error) {
	if id == 0 {
		return nil, errors.New("invalid option ID")
	}

	return s.optionRepo.GetByID(ctx, id)
}

func (s *optionService) GetOptionsByQuestionID(ctx context.Context, questionID uint) ([]models.Option, error) {
	if questionID == 0 {
		return nil, errors.New("invalid question ID")
	}

	return s.optionRepo.GetByQuestionID(ctx, questionID)
}

func (s *optionService) UpdateOption(ctx context.Context, option *models.Option) error {
	if option == nil || option.OptionID == 0 {
		return errors.New("invalid option provided")
	}

	if option.OptionText == "" {
		return errors.New("option text is required")
	}

	option.UpdatedAt = time.Now()

	return s.optionRepo.Update(ctx, option)
}

func (s *optionService) DeleteOption(ctx context.Context, id uint) error {
	if id == 0 {
		return errors.New("invalid option ID")
	}

	return s.optionRepo.Delete(ctx, id)
}

func (s *optionService) BatchCreateOptions(ctx context.Context, options []models.Option) error {
	if options == nil || len(options) == 0 {
		return errors.New("no options provided")
	}

	// Validate and set timestamps for all options
	now := time.Now()
	for i := range options {
		if options[i].QuestionID == 0 {
			return errors.New("question ID is required for all options")
		}

		if options[i].OptionText == "" {
			return errors.New("option text is required for all options")
		}

		options[i].CreatedAt = now
		options[i].UpdatedAt = now
	}

	return s.optionRepo.BatchCreate(ctx, options)
}
