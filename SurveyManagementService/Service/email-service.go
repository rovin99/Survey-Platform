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
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file:", err)
	}

	EMAIL := os.Getenv("EMAIL")
	APP_PASSWORD := os.Getenv("APP_PASS")
    return &EmailService{
        SMTPServer: "smtp.gmail.com", 
        Port:       "587",
        Username:   EMAIL,
        Password:   APP_PASSWORD,    
    }
}

func (s *EmailService) SendVerificationEmail(email, code string) error {
	// Email content
	from := s.Username
	to := email
	subject := "Your Verification Code"
	body := fmt.Sprintf("Hello,\n\nYour verification code is: %s\n\nBest regards,\nTeam", code)

	// Formatting the email message
	message := fmt.Sprintf("From: %s\nTo: %s\nSubject: %s\n\n%s", from, to, subject, body)

	// Set up authentication information
	auth := smtp.PlainAuth("", s.Username, s.Password, s.SMTPServer)

	// Send the email
	
	if err := smtp.SendMail(fmt.Sprintf("%s:%s", s.SMTPServer, s.Port), auth, from, []string{to}, []byte(message)); err != nil {
		log.Printf("SMTP Error: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	

	return nil
}