package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Repository"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/useragent"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"golang.org/x/crypto/bcrypt"
)

// SharingOptions contains optional settings for survey sharing
type SharingOptions struct {
	Password   string     // Optional password protection
	ExpiresAt  *time.Time // Optional expiration date
	MaxResponses *int     // Optional response limit
}

type SurveyAccessService interface {
	EnableSharing(ctx context.Context, surveyID, conductorID uint, accessType string, allowedDomains []string, options *SharingOptions) (*models.SurveyAccessControl, error)
	UpdateSharing(ctx context.Context, surveyID, conductorID uint, accessType string, allowedDomains []string, isActive bool, options *SharingOptions) (*models.SurveyAccessControl, error)
	DisableSharing(ctx context.Context, surveyID, conductorID uint) error
	ValidateAccess(ctx context.Context, shareToken, userEmail, password string, participantID uint, ipAddress, userAgent string) (*AccessValidationResult, error)
	ValidateInvitation(ctx context.Context, invitationToken, userEmail, password, ipAddress, userAgent string) (*AccessValidationResult, error)
	GetSharingInfo(ctx context.Context, surveyID, conductorID uint) (*models.SurveyAccessControl, error)
	GetAccessLogs(ctx context.Context, surveyID, conductorID uint, limit, offset int) ([]models.SurveyAccessLog, error)
	GetAccessLogsInternal(ctx context.Context, surveyID uint, limit, offset int) ([]models.SurveyAccessLog, error)
	GetByShareToken(ctx context.Context, shareToken string) (*models.SurveyAccessControl, error)
}

type AccessValidationResult struct {
	Granted          bool
	SurveyID         uint
	SurveyTitle      string
	DenialReason     string
	RequiresPassword bool   // Indicates if password is needed
	AllowAnonymous   bool   // Indicates if anonymous access is allowed
	InvitationID     *uint  // Links to specific invitation if applicable
	AccessType       string // PUBLIC, ORGANIZATION, or INVITED_ONLY
	RequiresLogin    bool   // Indicates if user must login (for ORGANIZATION type)
	AllowedDomains   string // Allowed email domains (for ORGANIZATION type)
	InvitedEmail     string // Email the invitation was sent to (for invitation tokens)
}

type surveyAccessService struct {
	accessRepo repository.SurveyAccessRepository
	surveyRepo repository.SurveyRepository
}

func NewSurveyAccessService(accessRepo repository.SurveyAccessRepository, surveyRepo repository.SurveyRepository) SurveyAccessService {
	return &surveyAccessService{
		accessRepo: accessRepo,
		surveyRepo: surveyRepo,
	}
}

func (s *surveyAccessService) EnableSharing(ctx context.Context, surveyID, userID uint, accessType string, allowedDomains []string, options *SharingOptions) (*models.SurveyAccessControl, error) {
	// Verify survey exists
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return nil, errors.New("survey not found")
	}

	// SECURITY: Verify ownership - user must own this survey
	if survey.ConductorID != userID {
		return nil, errors.New("you do not have permission to manage this survey")
	}

	// Check if sharing already enabled
	existing, _ := s.accessRepo.GetBySurveyID(ctx, surveyID)
	if existing != nil {
		return nil, errors.New("sharing already enabled for this survey")
	}

	// Validate access type
	if accessType != "PUBLIC" && accessType != "ORGANIZATION" && accessType != "INVITED_ONLY" {
		return nil, errors.New("access type must be PUBLIC, ORGANIZATION, or INVITED_ONLY")
	}

	// For ORGANIZATION, validate domains
	var domainsStr string
	if accessType == "ORGANIZATION" {
		if len(allowedDomains) == 0 {
			return nil, errors.New("allowed domains required for organization surveys")
		}
		allowedDomains = normalizeDomains(allowedDomains)
		domainsStr = strings.Join(allowedDomains, ",")
	}

	// Create access control
	control := &models.SurveyAccessControl{
		SurveyID:       surveyID,
		AccessType:     accessType,
		ShareToken:     uuid.New().String(),
		IsActive:       true,
		AllowedDomains: domainsStr,
		CreatedBy:      userID,
	}

	// Apply optional settings
	if options != nil {
		if options.Password != "" {
			hashedPassword, err := hashPassword(options.Password)
			if err != nil {
				return nil, errors.New("failed to secure password")
			}
			control.PasswordHash = hashedPassword
		}
		if options.ExpiresAt != nil {
			control.ExpiresAt = options.ExpiresAt
		}
		if options.MaxResponses != nil {
			control.MaxResponses = options.MaxResponses
		}
	}

	err = s.accessRepo.Create(ctx, control)
	if err != nil {
		return nil, err
	}

	// Update survey
	now := time.Now()
	survey.IsShareable = true
	survey.ShareEnabledAt = &now
	s.surveyRepo.Update(ctx, survey)

	return control, nil
}

func (s *surveyAccessService) UpdateSharing(ctx context.Context, surveyID, userID uint, accessType string, allowedDomains []string, isActive bool, options *SharingOptions) (*models.SurveyAccessControl, error) {
	// SECURITY: Verify ownership
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return nil, errors.New("survey not found")
	}
	if survey.ConductorID != userID {
		return nil, errors.New("you do not have permission to manage this survey")
	}

	control, err := s.accessRepo.GetBySurveyID(ctx, surveyID)
	if err != nil {
		return nil, err
	}

	// Update fields
	control.AccessType = accessType
	control.IsActive = isActive

	if accessType == "ORGANIZATION" {
		allowedDomains = normalizeDomains(allowedDomains)
		control.AllowedDomains = strings.Join(allowedDomains, ",")
	} else {
		control.AllowedDomains = ""
	}

	// Apply optional settings
	if options != nil {
		if options.Password != "" {
			hashedPassword, err := hashPassword(options.Password)
			if err != nil {
				return nil, errors.New("failed to secure password")
			}
			control.PasswordHash = hashedPassword
		} else if options.Password == "" && control.PasswordHash != "" {
			// Clear password if empty string explicitly provided
			// Note: nil options means "don't change"
			control.PasswordHash = ""
		}
		if options.ExpiresAt != nil {
			control.ExpiresAt = options.ExpiresAt
		}
		if options.MaxResponses != nil {
			control.MaxResponses = options.MaxResponses
		}
	}

	err = s.accessRepo.Update(ctx, control)
	return control, err
}

func (s *surveyAccessService) DisableSharing(ctx context.Context, surveyID, userID uint) error {
	// SECURITY: Verify ownership
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return errors.New("survey not found")
	}
	if survey.ConductorID != userID {
		return errors.New("you do not have permission to manage this survey")
	}

	return s.accessRepo.Delete(ctx, surveyID)
}

func (s *surveyAccessService) ValidateAccess(ctx context.Context, shareToken, userEmail, password string, participantID uint, ipAddress, userAgentStr string) (*AccessValidationResult, error) {
	result := &AccessValidationResult{Granted: false}

	// Skip access logging for anonymous users (privacy)
	isAnonymous := participantID == 0 && (userEmail == "" || userEmail == "anonymous@guest.local")

	// Parse User-Agent
	parsedUA := useragent.Parse(userAgentStr)

	// Create log entry with parsed browser/device info (only for authenticated users)
	log := &models.SurveyAccessLog{
		UserEmail:     userEmail,
		AccessGranted: false,
		IPAddress:     ipAddress,
		UserAgent:     userAgentStr,
		BrowserName:   parsedUA.BrowserName,
		DeviceType:    parsedUA.DeviceType,
	}
	if participantID > 0 {
		log.ParticipantID = &participantID
	}

	// Get access control
	control, err := s.accessRepo.GetByToken(ctx, shareToken)
	if err != nil {
		result.DenialReason = "INVALID_SHARE_TOKEN"
		log.DenialReason = result.DenialReason
		if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
		return result, err
	}

	log.SurveyID = control.SurveyID

	// Check if active
	if !control.IsActive {
		result.DenialReason = "LINK_INACTIVE"
		log.DenialReason = result.DenialReason
		if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
		return result, errors.New("share link is inactive")
	}

	// Check expiration
	if control.ExpiresAt != nil && time.Now().After(*control.ExpiresAt) {
		result.DenialReason = "LINK_EXPIRED"
		log.DenialReason = result.DenialReason
		if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
		return result, errors.New("share link has expired")
	}

	// Get survey
	survey, err := s.surveyRepo.GetByID(ctx, control.SurveyID)
	if err != nil {
		result.DenialReason = "SURVEY_NOT_FOUND"
		log.DenialReason = result.DenialReason
		if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
		return result, errors.New("survey not found")
	}

	if survey.Status != "PUBLISHED" {
		result.DenialReason = "SURVEY_NOT_PUBLISHED"
		log.DenialReason = result.DenialReason
		if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
		return result, errors.New("survey is not published")
	}

	// Check MaxResponses limit (count actual completed sessions, not access attempts)
	if control.MaxResponses != nil && *control.MaxResponses > 0 {
		completedSessions, err := s.accessRepo.CountCompletedSessions(ctx, control.SurveyID)
		if err == nil && completedSessions >= int64(*control.MaxResponses) {
			result.DenialReason = "MAX_RESPONSES_REACHED"
			log.DenialReason = result.DenialReason
			if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
			return result, errors.New("this survey has reached its maximum number of responses")
		}
	}

	// Set access type info for frontend
	result.AccessType = control.AccessType
	result.AllowedDomains = control.AllowedDomains
	
	// For ORGANIZATION type, check if login is required
	if control.AccessType == "ORGANIZATION" {
		result.RequiresLogin = true
		
		// If no verified email provided, return early to prompt login
		if userEmail == "" || userEmail == "anonymous@guest.local" {
			result.SurveyID = survey.SurveyID
			result.SurveyTitle = survey.Title
			result.AllowAnonymous = false // Organization requires verified email
			result.RequiresPassword = control.PasswordHash != ""
			return result, nil // Not an error, just needs login
		}
	}

	// Check if password is required
	if control.PasswordHash != "" {
		result.RequiresPassword = true
		if password == "" {
			// Return early to let frontend know password is needed
			result.SurveyID = survey.SurveyID
			result.SurveyTitle = survey.Title
			result.AllowAnonymous = survey.AllowAnonymous
			return result, nil // Not an error, just needs password
		}

		// Validate password
		if !checkPassword(password, control.PasswordHash) {
			result.DenialReason = "INVALID_PASSWORD"
			log.DenialReason = result.DenialReason
			if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
			return result, errors.New("incorrect password")
		}
	}

	// Validate based on access type
	if control.AccessType == "ORGANIZATION" {
		// ORGANIZATION access requires a valid organizational email - anonymous access is not allowed
		if userEmail == "" || userEmail == "anonymous@guest.local" || !strings.Contains(userEmail, "@") {
			result.DenialReason = "EMAIL_REQUIRED_FOR_ORGANIZATION"
			log.DenialReason = result.DenialReason
			if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
			return result, errors.New("this survey requires a valid organizational email address")
		}

		emailDomain := extractDomain(userEmail)
		allowedDomains := strings.Split(control.AllowedDomains, ",")

		domainAllowed := false
		for _, domain := range allowedDomains {
			if strings.EqualFold(emailDomain, strings.TrimSpace(domain)) {
				domainAllowed = true
				break
			}
		}

		if !domainAllowed {
			result.DenialReason = "INVALID_EMAIL_DOMAIN"
			log.DenialReason = result.DenialReason
			if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
			return result, errors.New("your email domain is not authorized for this survey. Allowed domains: " + control.AllowedDomains)
		}
	}

	// INVITED_ONLY access requires a personal invitation link - share links are not allowed
	if control.AccessType == "INVITED_ONLY" {
		result.DenialReason = "INVITATION_REQUIRED"
		log.DenialReason = result.DenialReason
		if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
		return result, errors.New("this survey is invitation-only. Please use the personal invitation link sent to your email")
	}

	// Access granted
	result.Granted = true
	result.SurveyID = survey.SurveyID
	result.SurveyTitle = survey.Title
	result.AllowAnonymous = survey.AllowAnonymous
	log.AccessGranted = true
	if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }

	return result, nil
}

func (s *surveyAccessService) GetSharingInfo(ctx context.Context, surveyID, userID uint) (*models.SurveyAccessControl, error) {
	// SECURITY: Verify ownership
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return nil, errors.New("survey not found")
	}
	if survey.ConductorID != userID {
		return nil, errors.New("you do not have permission to view this survey")
	}

	return s.accessRepo.GetBySurveyID(ctx, surveyID)
}

func (s *surveyAccessService) GetAccessLogs(ctx context.Context, surveyID, userID uint, limit, offset int) ([]models.SurveyAccessLog, error) {
	// SECURITY: Verify ownership
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return nil, errors.New("survey not found")
	}
	if survey.ConductorID != userID {
		return nil, errors.New("you do not have permission to view this survey")
	}

	return s.accessRepo.GetLogs(ctx, surveyID, limit, offset)
}

// GetAccessLogsInternal retrieves access logs for internal service-to-service calls (no ownership check)
func (s *surveyAccessService) GetAccessLogsInternal(ctx context.Context, surveyID uint, limit, offset int) ([]models.SurveyAccessLog, error) {
	return s.accessRepo.GetLogs(ctx, surveyID, limit, offset)
}

// GetByShareToken retrieves access control info by share token (public, no auth required)
func (s *surveyAccessService) GetByShareToken(ctx context.Context, shareToken string) (*models.SurveyAccessControl, error) {
	return s.accessRepo.GetByToken(ctx, shareToken)
}

// ValidateInvitation validates a unique invitation token and grants access
func (s *surveyAccessService) ValidateInvitation(ctx context.Context, invitationToken, userEmail, password, ipAddress, userAgentStr string) (*AccessValidationResult, error) {
	result := &AccessValidationResult{Granted: false}
	isAnonymous := false // Invitations are always email-based, always log

	// Get invitation by token
	invitation, err := s.accessRepo.GetInvitationByToken(ctx, invitationToken)
	if err != nil {
		result.DenialReason = "INVALID_INVITATION_TOKEN"
		return result, errors.New("invalid or expired invitation token")
	}

	result.InvitationID = &invitation.ID

	// SECURITY: Check if invitation was already completed (prevent reuse)
	if invitation.Status == "COMPLETED" {
		result.DenialReason = "INVITATION_ALREADY_USED"
		return result, errors.New("this invitation has already been used to complete a survey")
	}

	// SECURITY: Verify email matches invitation (prevent sharing invitation links)
	// Only enforce if userEmail is provided (first request may not have email)
	if userEmail != "" && !strings.EqualFold(userEmail, invitation.Email) {
		result.DenialReason = "EMAIL_MISMATCH"
		return result, errors.New("this invitation was sent to a different email address")
	}

	// Get survey
	survey, err := s.surveyRepo.GetByID(ctx, invitation.SurveyID)
	if err != nil {
		result.DenialReason = "SURVEY_NOT_FOUND"
		return result, errors.New("survey not found")
	}

	if survey.Status != "PUBLISHED" {
		result.DenialReason = "SURVEY_NOT_PUBLISHED"
		return result, errors.New("survey is not published")
	}

	// Get access control for password check and MaxResponses
	control, _ := s.accessRepo.GetBySurveyID(ctx, invitation.SurveyID)

	// Check MaxResponses limit (count actual completed sessions, not access attempts)
	if control != nil && control.MaxResponses != nil && *control.MaxResponses > 0 {
		completedSessions, err := s.accessRepo.CountCompletedSessions(ctx, invitation.SurveyID)
		if err == nil && completedSessions >= int64(*control.MaxResponses) {
			result.DenialReason = "MAX_RESPONSES_REACHED"
			return result, errors.New("this survey has reached its maximum number of responses")
		}
	}

	// Parse User-Agent
	parsedUA := useragent.Parse(userAgentStr)

	// Create log entry with parsed browser/device info
	log := &models.SurveyAccessLog{
		SurveyID:      invitation.SurveyID,
		UserEmail:     userEmail,
		AccessGranted: false,
		IPAddress:     ipAddress,
		UserAgent:     userAgentStr,
		BrowserName:   parsedUA.BrowserName,
		DeviceType:    parsedUA.DeviceType,
		InvitationID:  &invitation.ID,
	}

	// Check if password is required
	if control != nil && control.PasswordHash != "" {
		result.RequiresPassword = true
		if password == "" {
			// Return early to let frontend know password is needed
			result.SurveyID = survey.SurveyID
			result.SurveyTitle = survey.Title
			result.AllowAnonymous = survey.AllowAnonymous
			return result, nil // Not an error, just needs password
		}

		// Validate password
		if !checkPassword(password, control.PasswordHash) {
			result.DenialReason = "INVALID_PASSWORD"
			log.DenialReason = result.DenialReason
			if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
			return result, errors.New("incorrect password")
		}
	}

	// Check expiration
	if control != nil && control.ExpiresAt != nil && time.Now().After(*control.ExpiresAt) {
		result.DenialReason = "LINK_EXPIRED"
		log.DenialReason = result.DenialReason
		if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }
		return result, errors.New("invitation has expired")
	}

	// Mark invitation as clicked
	now := time.Now()
	invitation.ClickedAt = &now
	if invitation.Status == "SENT" {
		invitation.Status = "CLICKED"
	}
	s.accessRepo.UpdateInvitation(ctx, invitation)

	// Access granted
	result.Granted = true
	result.SurveyID = survey.SurveyID
	result.SurveyTitle = survey.Title
	result.AllowAnonymous = survey.AllowAnonymous
	result.InvitedEmail = invitation.Email // Return the invited email for session tracking
	log.AccessGranted = true
	if !isAnonymous { s.accessRepo.CreateLog(ctx, log) }

	return result, nil
}

// checkPassword compares a plain password with a bcrypt hash
func checkPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// hashPassword hashes a password using bcrypt
func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// Helper functions
func normalizeDomains(domains []string) []string {
	normalized := make([]string, 0, len(domains))
	for _, domain := range domains {
		domain = strings.TrimSpace(domain)
		domain = strings.ToLower(domain)
		domain = strings.TrimPrefix(domain, "@")
		if domain != "" {
			normalized = append(normalized, domain)
		}
	}
	return normalized
}

func extractDomain(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) == 2 {
		return strings.ToLower(strings.TrimSpace(parts[1]))
	}
	return ""
}
