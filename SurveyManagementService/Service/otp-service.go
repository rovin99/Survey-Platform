package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"
)

// OTPService handles email verification via OTP for organization access
type OTPService interface {
	SendOTP(ctx context.Context, email string, surveyTitle string) error
	VerifyOTP(ctx context.Context, email, otp string) (bool, error)
	IsEmailVerified(email string) bool
	GetVerificationToken(email string) string
}

type otpEntry struct {
	OTP        string
	ExpiresAt  time.Time
	Attempts   int
	Verified   bool
	VerifyToken string
}

type otpServiceImpl struct {
	emailService *EmailService
	// In-memory store for OTPs (for production, use Redis)
	otpStore     map[string]*otpEntry
	verifiedEmails map[string]string // email -> verification token
	mu           sync.RWMutex
}

func NewOTPService(emailService *EmailService) OTPService {
	return &otpServiceImpl{
		emailService:   emailService,
		otpStore:       make(map[string]*otpEntry),
		verifiedEmails: make(map[string]string),
	}
}

// generateOTP creates a 6-digit OTP
func generateOTP() (string, error) {
	max := big.NewInt(999999)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// generateToken creates a random verification token
func generateToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", b), nil
}

func (s *otpServiceImpl) SendOTP(ctx context.Context, email string, surveyTitle string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check rate limiting - max 3 OTPs per email per 10 minutes
	if existing, ok := s.otpStore[email]; ok {
		// Block if 3+ attempts and within the 10-minute window from last OTP
		if existing.Attempts >= 3 && time.Now().Before(existing.ExpiresAt) {
			return errors.New("too many OTP requests. Please wait before requesting again")
		}
		// Reset attempt count if the window has expired
		if time.Now().After(existing.ExpiresAt) {
			delete(s.otpStore, email)
		}
	}

	// Generate OTP
	otp, err := generateOTP()
	if err != nil {
		return fmt.Errorf("failed to generate OTP: %w", err)
	}

	// Store OTP with 10-minute expiry
	attempts := 0
	if existing, ok := s.otpStore[email]; ok {
		attempts = existing.Attempts
	}
	
	s.otpStore[email] = &otpEntry{
		OTP:       otp,
		ExpiresAt: time.Now().Add(10 * time.Minute),
		Attempts:  attempts + 1,
	}

	// Send email
	subject := fmt.Sprintf("Your Verification Code for %s", surveyTitle)
	body := fmt.Sprintf(`
Hello,

Your verification code to access "%s" is:

    %s

This code will expire in 10 minutes.

If you did not request this code, please ignore this email.

Best regards,
Survey Platform
`, surveyTitle, otp)

	if err := s.emailService.sendEmail(s.emailService.Username, email, subject, body); err != nil {
		log.Printf("[ERROR] Failed to send OTP email to %s: %v", email, err)
		return fmt.Errorf("failed to send verification email. Please try again")
	}

	log.Printf("[INFO] OTP sent to %s for survey: %s", email, surveyTitle)
	return nil
}

func (s *otpServiceImpl) VerifyOTP(ctx context.Context, email, otp string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	entry, ok := s.otpStore[email]
	if !ok {
		return false, errors.New("no OTP found. Please request a new code")
	}

	if time.Now().After(entry.ExpiresAt) {
		delete(s.otpStore, email)
		return false, errors.New("OTP has expired. Please request a new code")
	}

	if entry.OTP != otp {
		return false, errors.New("invalid OTP. Please check and try again")
	}

	// OTP is valid - generate verification token
	token, err := generateToken()
	if err != nil {
		return false, fmt.Errorf("failed to generate verification token: %w", err)
	}

	// Mark as verified and store token
	entry.Verified = true
	entry.VerifyToken = token
	s.verifiedEmails[email] = token

	log.Printf("[INFO] Email verified: %s", email)
	return true, nil
}

func (s *otpServiceImpl) IsEmailVerified(email string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	_, ok := s.verifiedEmails[email]
	return ok
}

func (s *otpServiceImpl) GetVerificationToken(email string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	return s.verifiedEmails[email]
}

