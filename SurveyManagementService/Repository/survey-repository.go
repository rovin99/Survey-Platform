package repository

import (
	"context"
	"log"

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
	DeleteOptionsWithTx(ctx context.Context, tx *gorm.DB, surveyID uint) error
	GetCompletedSessions(ctx context.Context, surveyID uint) ([]models.SurveySession, error)
	GetAnswersForQuestion(ctx context.Context, questionID uint) ([]models.Answer, error)
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
	log.Printf("[DEBUG] Repository: Getting survey with ID: %d", id)
	
	// Try direct SQL query first
	var survey models.Survey
	query := "SELECT * FROM surveys WHERE survey_id = $1"
	log.Printf("[DEBUG] Repository: Executing query: %s with ID: %d", query, id)
	
	err := r.db.WithContext(ctx).Raw(query, id).Scan(&survey).Error
	if err != nil {
		log.Printf("[ERROR] Repository: Failed to get survey with raw SQL: %v", err)
		return nil, err
	}
	
	log.Printf("[DEBUG] Repository: Raw SQL found survey: %+v", survey)
	
	// Now get questions
	err = r.db.WithContext(ctx).Model(&survey).Association("Questions").Find(&survey.Questions)
	if err != nil {
		log.Printf("[ERROR] Repository: Failed to load questions: %v", err)
		return nil, err
	}
	
	log.Printf("[DEBUG] Repository: Loaded %d questions", len(survey.Questions))
	return &survey, nil
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

func (r *surveyRepository) DeleteOptionsWithTx(ctx context.Context, tx *gorm.DB, surveyID uint) error {
	return tx.Exec(`
		DELETE FROM options 
		WHERE question_id IN (
			SELECT question_id 
			FROM questions 
			WHERE survey_id = ?
		)`, surveyID).Error
}

func (r *surveyRepository) GetCompletedSessions(ctx context.Context, surveyID uint) ([]models.SurveySession, error) {
	log.Printf("[DEBUG] Repository: Getting completed sessions for survey %d", surveyID)
	var sessions []models.SurveySession
	
	// First, check what session statuses exist
	var statuses []string
	err := r.db.WithContext(ctx).Model(&models.SurveySession{}).Distinct().Pluck("session_status", &statuses).Error
	if err != nil {
		log.Printf("[ERROR] Repository: Failed to get session statuses: %v", err)
		return nil, err
	}
	log.Printf("[DEBUG] Repository: Found session statuses: %v", statuses)
	
	// Get completed sessions
	err = r.db.WithContext(ctx).
		Where("survey_id = ? AND session_status = ?", surveyID, "COMPLETED").
		Find(&sessions).Error
	
	if err != nil {
		log.Printf("[ERROR] Repository: Failed to get completed sessions: %v", err)
		return nil, err
	}
	
	log.Printf("[DEBUG] Repository: Found %d completed sessions", len(sessions))
	return sessions, nil
}

func (r *surveyRepository) GetAnswersForQuestion(ctx context.Context, questionID uint) ([]models.Answer, error) {
	log.Printf("[DEBUG] Repository: Getting answers for question %d", questionID)
	
	// Use raw SQL to see exactly what we're getting
	var answers []models.Answer
	query := "SELECT answer_id, session_id, question_id, response, created_at, updated_at FROM answers WHERE question_id = $1"
	
	err := r.db.WithContext(ctx).Raw(query, questionID).Scan(&answers).Error
	if err != nil {
		log.Printf("[ERROR] Repository: Failed to get answers: %v", err)
		return nil, err
	}
	
	log.Printf("[DEBUG] Repository: Found %d answers for question %d", len(answers), questionID)
	for i, ans := range answers {
		log.Printf("[DEBUG] Answer %d: response=%s", i+1, ans.Response)
	}
	
	return answers, nil
}
