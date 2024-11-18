// package service
// import (
	
// 	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
// 	"github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
// 	// "github.com/go-redis/redis/v8"
	
// 	"errors"
// )
// type SurveyService struct {
// 	surveyRepo   *repository.SurveyRepository
// 	questionRepo *repository.QuestionRepository
// }

// func NewSurveyService(sr *repository.SurveyRepository, qr *repository.QuestionRepository) *SurveyService {
// 	return &SurveyService{
// 		surveyRepo:   sr,
// 		questionRepo: qr,
// 	}
// }

// func (s *SurveyService) CreateSurvey(survey *models.Survey) error {
// 	// Validate survey data
// 	if err := s.validateSurvey(survey); err != nil {
// 		return err
// 	}
	
// 	return s.surveyRepo.Create(survey)
// }

// func (s *SurveyService) GetSurvey(id uint) (*models.Survey, error) {
// 	return s.surveyRepo.GetByID(id)
// }

// func (s *SurveyService) validateSurvey(survey *models.Survey) error {
// 	if survey.Title == "" {
// 		return errors.New("survey title is required")
// 	}
// 	if survey.ConductorID == 0 {
// 		return errors.New("conductor ID is required")
// 	}
// 	return nil
// }

package service

import (
    "github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

type SurveyService struct {
    surveyRepo   *repository.SurveyRepository
    questionRepo *repository.QuestionRepository
}

func NewSurveyService(sr *repository.SurveyRepository, qr *repository.QuestionRepository) *SurveyService {
    return &SurveyService{
        surveyRepo:   sr,
        questionRepo: qr,
    }
}

func (s *SurveyService) CreateSurvey(survey *models.Survey) error {
    return s.surveyRepo.Create(survey)
}

func (s *SurveyService) GetSurvey(id uint) (*models.Survey, error) {
    return s.surveyRepo.GetByID(id)
}

func (s *SurveyService) ListSurveys() ([]models.Survey, error) {
    return s.surveyRepo.GetAll()
}

func (s *SurveyService) UpdateSurvey(survey *models.Survey) error {
    return s.surveyRepo.Update(survey)
}

func (s *SurveyService) DeleteSurvey(id uint) error {
    return s.surveyRepo.Delete(id)
}

func (s *SurveyService) AddQuestion(question *models.Question) error {
    return s.questionRepo.Create(question)
}

func (s *SurveyService) GetQuestion(id uint) (*models.Question, error) {
    return s.questionRepo.GetByID(id)
}

func (s *SurveyService) UpdateQuestion(question *models.Question) error {
    return s.questionRepo.Update(question)
}

func (s *SurveyService) DeleteQuestion(id uint) error {
    return s.questionRepo.Delete(id)
}