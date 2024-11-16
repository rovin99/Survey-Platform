package service

import (
	"crypto/rand"
	"encoding/hex"
)

type ConductorService struct {
	conductorRepo *repository.ConductorRepository
	emailService *EmailService
	cache        *redis.Client // For storing verification codes
}

func NewConductorService(cr *repository.ConductorRepository, es *EmailService, cache *redis.Client) *ConductorService {
	return &ConductorService{
		conductorRepo: cr,
		emailService: es,
		cache: cache,
	}
}

func (s *ConductorService) RegisterConductor(userID uint, req *ConductorRegistrationRequest) error {
	// Validate conductor type
	if req.Type != models.ConductorTypeInstitute && req.Type != models.ConductorTypeCompany {
		return errors.New("invalid conductor type")
	}

	// Check email domain based on type
	if err := s.validateOfficialEmail(req.OfficialEmail, req.Type); err != nil {
		return err
	}

	conductor := &models.Conductor{
		UserID:        userID,
		Name:          req.Name,
		Type:          req.Type,
		Description:   req.Description,
		ContactEmail:  req.ContactEmail,
		ContactPhone:  req.ContactPhone,
		Address:       req.Address,
		OfficialEmail: req.OfficialEmail,
		IsVerified:    false,
	}

	if err := s.conductorRepo.Create(conductor); err != nil {
		return err
	}

	// Generate and send verification code
	return s.sendVerificationCode(conductor)
}

func (s *ConductorService) validateOfficialEmail(email string, conductorType models.ConductorType) error {
	// Add your email validation logic here
	// Example: Check for educational institution domains for INSTITUTE type
	if conductorType == models.ConductorTypeInstitute {
		if !strings.HasSuffix(email, ".edu") && !strings.HasSuffix(email, ".ac.in") {
			return errors.New("invalid institution email domain")
		}
	}
	return nil
}

func (s *ConductorService) generateVerificationCode() (string, error) {
	bytes := make([]byte, 3) // 6 hex characters
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (s *ConductorService) sendVerificationCode(conductor *models.Conductor) error {
	code, err := s.generateVerificationCode()
	if err != nil {
		return err
	}

	// Store code in Redis with expiration
	err = s.cache.Set(context.Background(), 
		fmt.Sprintf("conductor_verification:%d", conductor.ID),
		code,
		15*time.Minute).Err()
	if err != nil {
		return err
	}

	return s.emailService.SendVerificationEmail(conductor.OfficialEmail, code)
}

func (s *ConductorService) VerifyEmail(conductorID uint, code string) error {
	storedCode, err := s.cache.Get(context.Background(), 
		fmt.Sprintf("conductor_verification:%d", conductorID)).Result()
	if err != nil {
		return errors.New("invalid or expired verification code")
	}

	if code != storedCode {
		return errors.New("invalid verification code")
	}

	// Mark conductor as verified
	if err := s.conductorRepo.UpdateVerificationStatus(conductorID, true); err != nil {
		return err
	}

	// Delete verification code
	return s.cache.Del(context.Background(), 
		fmt.Sprintf("conductor_verification:%d", conductorID)).Err()
}