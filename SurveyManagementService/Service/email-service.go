package service

import (
	"fmt"
	"log"
	"net/smtp"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
)
type EmailService struct {
	
	SMTPServer string
    Port       string
    Username   string
    Password   string
}
// NewEmailService initializes a new email service
func NewEmailService() *EmailService {
	// Try to load .env file (optional - environment variables take precedence)
	_ = godotenv.Load()

	EMAIL := os.Getenv("EMAIL")
	APP_PASSWORD := os.Getenv("APP_PASS")
	SMTP_SERVER := os.Getenv("SMTP_SERVER")
	SMTP_PORT := os.Getenv("SMTP_PORT")

	// Defaults to Gmail if not specified
	if SMTP_SERVER == "" {
		SMTP_SERVER = "smtp.gmail.com"
	}
	if SMTP_PORT == "" {
		SMTP_PORT = "587"
	}

	if EMAIL != "" && APP_PASSWORD != "" {
		log.Printf("Email service configured: %s via %s:%s", EMAIL, SMTP_SERVER, SMTP_PORT)
	} else {
		log.Println("Email service not configured - EMAIL or APP_PASS not set")
		log.Println("Emails will be logged to console only")
	}

    return &EmailService{
        SMTPServer: SMTP_SERVER,
        Port:       SMTP_PORT,
        Username:   EMAIL,
        Password:   APP_PASSWORD,
    }
}

func (s *EmailService) SendVerificationEmail(email, code string) error {
	// Email content
	from := s.Username
	to := email
	subject := "Your Verification Code - Survey Platform"
	body := fmt.Sprintf("Hello,\n\nYour verification code is: %s\n\nThis code will expire in 10 minutes for security reasons.\n\nBest regards,\nSurvey Platform Team", code)

	return s.sendEmail(from, to, subject, body)
}

func (s *EmailService) SendMagicLinkEmail(email, magicLink, username string) error {
	from := s.Username
	to := email
	subject := "Sign in to Survey Platform"
	
	if username == "" {
		username = "there"
	}
	
	body := fmt.Sprintf("Hello %s,\n\nClick the link below to sign in to Survey Platform:\n\n%s\n\n⚠️ IMPORTANT: This link will expire in 15 minutes for security reasons.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nSurvey Platform Team", username, magicLink)

	return s.sendEmail(from, to, subject, body)
}

func (s *EmailService) CheckHealth() error {
	if s.Username == "" || s.Password == "" {
		return fmt.Errorf("email credentials not configured")
	}
	
	// You could add a test connection here if needed
	return nil
}

func (s *EmailService) SendGenericEmail(to, subject, body string) error {
	return s.sendEmail(s.Username, to, subject, body)
}

func (s *EmailService) sendEmail(from, to, subject, body string) error {
	if s.Username == "" || s.Password == "" {
		log.Printf("Email service not configured - would send email to %s with subject: %s", to, subject)
		log.Printf("Email body: %s", body)
		return nil // Don't fail in development
	}

	// Formatting the email message
	message := fmt.Sprintf("From: %s\nTo: %s\nSubject: %s\n\n%s", from, to, subject, body)

	// Set up authentication information
	auth := smtp.PlainAuth("", s.Username, s.Password, s.SMTPServer)

	// Send the email
	if err := smtp.SendMail(fmt.Sprintf("%s:%s", s.SMTPServer, s.Port), auth, from, []string{to}, []byte(message)); err != nil {
		log.Printf("SMTP Error: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	
	log.Printf("Email sent successfully to %s", to)
	return nil
}