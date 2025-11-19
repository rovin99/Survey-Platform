package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Repository"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

type SurveyAccessService interface {
	EnableSharing(ctx context.Context, surveyID, conductorID uint, accessType string, allowedDomains []string) (*models.SurveyAccessControl, error)
	UpdateSharing(ctx context.Context, surveyID, conductorID uint, accessType string, allowedDomains []string, isActive bool) (*models.SurveyAccessControl, error)
	DisableSharing(ctx context.Context, surveyID, conductorID uint) error
	ValidateAccess(ctx context.Context, shareToken, userEmail string, participantID uint, ipAddress, userAgent string) (*AccessValidationResult, error)
	GetSharingInfo(ctx context.Context, surveyID, conductorID uint) (*models.SurveyAccessControl, error)
	GetAccessLogs(ctx context.Context, surveyID, conductorID uint, limit, offset int) ([]models.SurveyAccessLog, error)
}

type AccessValidationResult struct {
	Granted      bool
	SurveyID     uint
	SurveyTitle  string
	DenialReason string
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

func (s *surveyAccessService) EnableSharing(ctx context.Context, surveyID, conductorID uint, accessType string, allowedDomains []string) (*models.SurveyAccessControl, error) {
	// Verify survey exists and belongs to conductor
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil {
		return nil, errors.New("survey not found")
	}
	if survey.ConductorID != conductorID {
		return nil, errors.New("unauthorized: survey does not belong to conductor")
	}

	// Check if sharing already enabled
	existing, _ := s.accessRepo.GetBySurveyID(ctx, surveyID)
	if existing != nil {
		return nil, errors.New("sharing already enabled for this survey")
	}

	// Validate access type
	if accessType != "PUBLIC" && accessType != "ORGANIZATION" {
		return nil, errors.New("access type must be PUBLIC or ORGANIZATION")
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
		CreatedBy:      conductorID,
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

func (s *surveyAccessService) UpdateSharing(ctx context.Context, surveyID, conductorID uint, accessType string, allowedDomains []string, isActive bool) (*models.SurveyAccessControl, error) {
	// Verify ownership
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil || survey.ConductorID != conductorID {
		return nil, errors.New("unauthorized")
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

	err = s.accessRepo.Update(ctx, control)
	return control, err
}

func (s *surveyAccessService) DisableSharing(ctx context.Context, surveyID, conductorID uint) error {
	// Verify ownership
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil || survey.ConductorID != conductorID {
		return errors.New("unauthorized")
	}

	return s.accessRepo.Delete(ctx, surveyID)
}

func (s *surveyAccessService) ValidateAccess(ctx context.Context, shareToken, userEmail string, participantID uint, ipAddress, userAgent string) (*AccessValidationResult, error) {
	result := &AccessValidationResult{Granted: false}

	// Create log entry
	log := &models.SurveyAccessLog{
		UserEmail:     userEmail,
		AccessGranted: false,
		IPAddress:     ipAddress,
		UserAgent:     userAgent,
	}
	if participantID > 0 {
		log.ParticipantID = &participantID
	}

	// Get access control
	control, err := s.accessRepo.GetByToken(ctx, shareToken)
	if err != nil {
		result.DenialReason = "INVALID_SHARE_TOKEN"
		log.DenialReason = result.DenialReason
		s.accessRepo.CreateLog(ctx, log)
		return result, err
	}

	log.SurveyID = control.SurveyID

	// Check if active
	if !control.IsActive {
		result.DenialReason = "LINK_INACTIVE"
		log.DenialReason = result.DenialReason
		s.accessRepo.CreateLog(ctx, log)
		return result, errors.New("share link is inactive")
	}

	// Check expiration
	if control.ExpiresAt != nil && time.Now().After(*control.ExpiresAt) {
		result.DenialReason = "LINK_EXPIRED"
		log.DenialReason = result.DenialReason
		s.accessRepo.CreateLog(ctx, log)
		return result, errors.New("share link has expired")
	}

	// Get survey
	survey, err := s.surveyRepo.GetByID(ctx, control.SurveyID)
	if err != nil {
		result.DenialReason = "SURVEY_NOT_FOUND"
		log.DenialReason = result.DenialReason
		s.accessRepo.CreateLog(ctx, log)
		return result, errors.New("survey not found")
	}

	if survey.Status != "PUBLISHED" {
		result.DenialReason = "SURVEY_NOT_PUBLISHED"
		log.DenialReason = result.DenialReason
		s.accessRepo.CreateLog(ctx, log)
		return result, errors.New("survey is not published")
	}

	// Validate based on access type
	if control.AccessType == "ORGANIZATION" {
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
			s.accessRepo.CreateLog(ctx, log)
			return result, errors.New("your email domain is not authorized for this survey")
		}
	}

	// Access granted
	result.Granted = true
	result.SurveyID = survey.SurveyID
	result.SurveyTitle = survey.Title
	log.AccessGranted = true
	s.accessRepo.CreateLog(ctx, log)

	return result, nil
}

func (s *surveyAccessService) GetSharingInfo(ctx context.Context, surveyID, conductorID uint) (*models.SurveyAccessControl, error) {
	// Verify ownership
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil || survey.ConductorID != conductorID {
		return nil, errors.New("unauthorized")
	}

	return s.accessRepo.GetBySurveyID(ctx, surveyID)
}

func (s *surveyAccessService) GetAccessLogs(ctx context.Context, surveyID, conductorID uint, limit, offset int) ([]models.SurveyAccessLog, error) {
	// Verify ownership
	survey, err := s.surveyRepo.GetByID(ctx, surveyID)
	if err != nil || survey.ConductorID != conductorID {
		return nil, errors.New("unauthorized")
	}

	return s.accessRepo.GetLogs(ctx, surveyID, limit, offset)
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
