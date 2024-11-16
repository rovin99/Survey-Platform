package repository

type SurveyRepository struct {
	db *gorm.DB
}

func NewSurveyRepository(db *gorm.DB) *SurveyRepository {
	return &SurveyRepository{db: db}
}

func (r *SurveyRepository) Create(survey *models.Survey) error {
	return r.db.Create(survey).Error
}

func (r *SurveyRepository) GetByID(id uint) (*models.Survey, error) {
	var survey models.Survey
	err := r.db.Preload("Questions").Preload("Requirements").First(&survey, id).Error
	if err != nil {
		return nil, err
	}
	return &survey, nil
}

func (r *SurveyRepository) Update(survey *models.Survey) error {
	return r.db.Save(survey).Error
}

func (r *SurveyRepository) Delete(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Delete related questions
		if err := tx.Where("survey_id = ?", id).Delete(&models.Question{}).Error; err != nil {
			return err
		}
		// Delete survey
		if err := tx.Delete(&models.Survey{}, id).Error; err != nil {
			return err
		}
		return nil
	})
}