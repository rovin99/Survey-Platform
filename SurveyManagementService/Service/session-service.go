package service
import (
	"context"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
)

type SessionService struct {
	sessionRepo repository.SurveySessionRepository
}

func NewSessionService(repo repository.SurveySessionRepository) *SessionService {
	return &SessionService{
		sessionRepo: repo,
	}
}

// Create a new survey session
func (s *SessionService) CreateSession(ctx context.Context, session *models.SurveySession) error {
	return s.sessionRepo.Create(ctx, session)
}

// Get a survey session by ID
func (s *SessionService) GetSessionByID(ctx context.Context, id uint) (*models.SurveySession, error) {
	return s.sessionRepo.GetByID(ctx, id)
}

// Update session status
func (s *SessionService) UpdateSessionStatus(ctx context.Context, id uint, status string) error {
	return s.sessionRepo.UpdateStatus(ctx, id, status)
}

// Update last answered question in session
func (s *SessionService) UpdateLastQuestion(ctx context.Context, id uint, questionID uint) error {
	return s.sessionRepo.UpdateLastQuestion(ctx, id, questionID)
}
