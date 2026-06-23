package service

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"gorm.io/gorm"
)

// InvitationService handles bulk email invitations for surveys
type InvitationService struct {
	db           *gorm.DB
	emailService *EmailService
}

// NewInvitationService creates a new invitation service
func NewInvitationService(db *gorm.DB, emailService *EmailService) *InvitationService {
	return &InvitationService{
		db:           db,
		emailService: emailService,
	}
}

// SendBulkInvitations sends survey invitation emails to a list of email addresses
// Each invitation gets a unique token for tracking
func (s *InvitationService) SendBulkInvitations(ctx context.Context, surveyID, userID uint, emails []string, shareURL string) (*models.InvitationStats, error) {
	// Get survey details
	var survey models.Survey
	if err := s.db.WithContext(ctx).First(&survey, surveyID).Error; err != nil {
		return nil, fmt.Errorf("survey not found: %w", err)
	}

	// SECURITY: Verify ownership
	if survey.ConductorID != userID {
		return nil, fmt.Errorf("you do not have permission to manage this survey")
	}

	if survey.Status != "PUBLISHED" {
		return nil, fmt.Errorf("survey must be published before sending invitations")
	}

	stats := &models.InvitationStats{
		TotalInvited: len(emails),
	}

	// Get frontend URL for invitation links
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	// Process each email
	for _, email := range emails {
		// Generate unique invitation token
		invitationToken := uuid.New().String()

		invitation := &models.SurveyInvitation{
			SurveyID:        surveyID,
			Email:           email,
			InvitationToken: invitationToken, // Unique token for this invitation
			Status:          "PENDING",
		}

		// Save invitation record first
		if err := s.db.WithContext(ctx).Create(invitation).Error; err != nil {
			log.Printf("[ERROR] Failed to create invitation record for %s: %v", email, err)
			stats.TotalFailed++
			continue
		}

		// Generate unique invitation URL
		// Use invitation token instead of share URL for better tracking
		uniqueInvitationURL := fmt.Sprintf("%s/survey/public/%s?type=invitation", frontendURL, invitationToken)

		// Send email with unique link
		err := s.sendInvitationEmail(email, survey.Title, uniqueInvitationURL, survey.AllowAnonymous)
		now := time.Now()

		if err != nil {
			invitation.Status = "FAILED"
			invitation.ErrorMsg = err.Error()
			stats.TotalFailed++
			log.Printf("[ERROR] Failed to send invitation to %s: %v", email, err)
		} else {
			invitation.Status = "SENT"
			invitation.SentAt = &now
			stats.TotalSent++
			log.Printf("[SUCCESS] Invitation sent to %s for survey %d (token: %s...)", email, surveyID, invitationToken[:8])
		}

		// Update invitation status
		s.db.WithContext(ctx).Save(invitation)
	}

	stats.TotalPending = stats.TotalInvited - stats.TotalSent - stats.TotalFailed

	return stats, nil
}

// AssignedSurvey is a published survey assigned to a participant (via invitation) that they have
// not yet completed — surfaced on the participant dashboard's "Assigned to you" list.
type AssignedSurvey struct {
	SurveyID        uint      `json:"surveyId"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	IsQuiz          bool      `json:"isQuiz"`
	AssignedAt      time.Time `json:"assignedAt"`
	InvitationToken string    `json:"invitationToken"`
}

// ListAssignmentsByEmail returns published surveys assigned to this email that have a pending
// (non-COMPLETED) invitation and no COMPLETED invitation. One entry per survey (latest pending).
func (s *InvitationService) ListAssignmentsByEmail(ctx context.Context, email string) ([]AssignedSurvey, error) {
	var invites []models.SurveyInvitation
	if err := s.db.WithContext(ctx).
		Where("LOWER(email) = LOWER(?)", email).
		Order("created_at DESC").
		Find(&invites).Error; err != nil {
		return nil, err
	}

	completed := make(map[uint]bool)
	for _, inv := range invites {
		if inv.Status == "COMPLETED" {
			completed[inv.SurveyID] = true
		}
	}

	pending := make(map[uint]models.SurveyInvitation)
	order := make([]uint, 0)
	for _, inv := range invites { // already ordered newest first
		if inv.Status == "COMPLETED" {
			continue
		}
		if _, seen := pending[inv.SurveyID]; !seen {
			pending[inv.SurveyID] = inv
			order = append(order, inv.SurveyID)
		}
	}

	result := make([]AssignedSurvey, 0, len(order))
	for _, sid := range order {
		if completed[sid] {
			continue
		}
		var survey models.Survey
		if err := s.db.WithContext(ctx).First(&survey, sid).Error; err != nil {
			continue // survey gone
		}
		if survey.Status != "PUBLISHED" {
			continue
		}
		inv := pending[sid]
		result = append(result, AssignedSurvey{
			SurveyID:        survey.SurveyID,
			Title:           survey.Title,
			Description:     survey.Description,
			IsQuiz:          survey.IsQuiz,
			AssignedAt:      inv.CreatedAt,
			InvitationToken: inv.InvitationToken,
		})
	}
	return result, nil
}

// sendInvitationEmail sends a single invitation email
func (s *InvitationService) sendInvitationEmail(email, surveyTitle, shareURL string, allowAnonymous bool) error {
	subject := fmt.Sprintf("You're invited to take: %s", surveyTitle)

	var registrationNote string
	if allowAnonymous {
		registrationNote = "No registration required - click the link to start immediately!"
	} else {
		registrationNote = "You'll need to create a free account or sign in to participate."
	}

	body := fmt.Sprintf(`Hello,

You've been invited to participate in a survey/quiz:

📋 %s

Click the link below to get started:
%s

%s

This survey is being conducted via Survey Platform.

Best regards,
Survey Platform Team`, surveyTitle, shareURL, registrationNote)

	return s.emailService.sendEmail(s.emailService.Username, email, subject, body)
}

// GetInvitationStats returns statistics for a survey's invitations
func (s *InvitationService) GetInvitationStats(ctx context.Context, surveyID, userID uint) (*models.InvitationStats, error) {
	// SECURITY: Verify ownership
	var survey models.Survey
	if err := s.db.WithContext(ctx).First(&survey, surveyID).Error; err != nil {
		return nil, fmt.Errorf("survey not found: %w", err)
	}
	if survey.ConductorID != userID {
		return nil, fmt.Errorf("you do not have permission to view this survey")
	}

	stats := &models.InvitationStats{}

	var totalInvited, totalSent, totalFailed, totalPending, totalClicked, totalCompleted int64

	// Count total
	s.db.WithContext(ctx).Model(&models.SurveyInvitation{}).
		Where("survey_id = ?", surveyID).
		Count(&totalInvited)

	// Count sent (only those that haven't been clicked or completed yet)
	s.db.WithContext(ctx).Model(&models.SurveyInvitation{}).
		Where("survey_id = ? AND status = ?", surveyID, "SENT").
		Count(&totalSent)

	// Count failed
	s.db.WithContext(ctx).Model(&models.SurveyInvitation{}).
		Where("survey_id = ? AND status = ?", surveyID, "FAILED").
		Count(&totalFailed)

	// Count pending
	s.db.WithContext(ctx).Model(&models.SurveyInvitation{}).
		Where("survey_id = ? AND status = ?", surveyID, "PENDING").
		Count(&totalPending)

	// Count clicked
	s.db.WithContext(ctx).Model(&models.SurveyInvitation{}).
		Where("survey_id = ? AND status = ?", surveyID, "CLICKED").
		Count(&totalClicked)

	// Count completed
	s.db.WithContext(ctx).Model(&models.SurveyInvitation{}).
		Where("survey_id = ? AND status = ?", surveyID, "COMPLETED").
		Count(&totalCompleted)

	stats.TotalInvited = int(totalInvited)
	stats.TotalSent = int(totalSent)
	stats.TotalFailed = int(totalFailed)
	stats.TotalPending = int(totalPending)
	stats.TotalClicked = int(totalClicked)
	stats.TotalCompleted = int(totalCompleted)

	return stats, nil
}

// GetInvitations returns all invitations for a survey
func (s *InvitationService) GetInvitations(ctx context.Context, surveyID, userID uint) ([]models.SurveyInvitation, error) {
	// SECURITY: Verify ownership
	var survey models.Survey
	if err := s.db.WithContext(ctx).First(&survey, surveyID).Error; err != nil {
		return nil, fmt.Errorf("survey not found: %w", err)
	}
	if survey.ConductorID != userID {
		return nil, fmt.Errorf("you do not have permission to view this survey")
	}

	var invitations []models.SurveyInvitation
	err := s.db.WithContext(ctx).
		Where("survey_id = ?", surveyID).
		Order("created_at DESC").
		Find(&invitations).Error
	return invitations, err
}

// UpdateSurveyAnonymousSetting updates the allow_anonymous field for a survey
func (s *InvitationService) UpdateSurveyAnonymousSetting(ctx context.Context, surveyID, userID uint, allowAnonymous bool) error {
	// SECURITY: Verify ownership
	var survey models.Survey
	if err := s.db.WithContext(ctx).First(&survey, surveyID).Error; err != nil {
		return fmt.Errorf("survey not found: %w", err)
	}
	if survey.ConductorID != userID {
		return fmt.Errorf("you do not have permission to modify this survey")
	}

	return s.db.WithContext(ctx).
		Model(&models.Survey{}).
		Where("survey_id = ?", surveyID).
		Update("allow_anonymous", allowAnonymous).Error
}

// MarkInvitationCompleted marks an invitation as completed (internal service call)
func (s *InvitationService) MarkInvitationCompleted(ctx context.Context, surveyID uint, email string) error {
	now := time.Now()
	result := s.db.WithContext(ctx).
		Model(&models.SurveyInvitation{}).
		Where("survey_id = ? AND email = ? AND status IN ?", surveyID, email, []string{"SENT", "CLICKED"}).
		Updates(map[string]interface{}{
			"status":       "COMPLETED",
			"completed_at": now,
		})

	if result.Error != nil {
		return fmt.Errorf("failed to mark invitation completed: %w", result.Error)
	}

	if result.RowsAffected > 0 {
		log.Printf("[SUCCESS] Marked invitation as COMPLETED - SurveyID: %d, Email: %s", surveyID, email)
	}

	return nil
}