package service

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
	// Validate survey data
	if err := s.validateSurvey(survey); err != nil {
		return err
	}
	
	return s.surveyRepo.Create(survey)
}

func (s *SurveyService) GetSurvey(id uint) (*models.Survey, error) {
	return s.surveyRepo.GetByID(id)
}

func (s *SurveyService) validateSurvey(survey *models.Survey) error {
	if survey.Title == "" {
		return errors.New("survey title is required")
	}
	if survey.ConductorID == 0 {
		return errors.New("conductor ID is required")
	}
	return nil
}