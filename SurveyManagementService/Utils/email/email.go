package email

import (
    "log"
    "net/smtp"
	"github.com/joho/godotenv"
	"os"
)

// EmailService represents a service for sending emails
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
        SMTPServer: "smtp.example.com", 
        Port:       "587",
        Username:   EMAIL,
        Password:   APP_PASSWORD,    
    }
}

// SendEmail sends an email using SMTP
func (es *EmailService) SendEmail(to string, subject string, body string) error {
    auth := smtp.PlainAuth("", es.Username, es.Password, es.SMTPServer)
    msg := []byte("To: " + to + "\r\n" +
        "Subject: " + subject + "\r\n" +
        "\r\n" +
        body + "\r\n")

    err := smtp.SendMail(es.SMTPServer+":"+es.Port, auth, es.Username, []string{to}, msg)
    if err != nil {
        log.Printf("Error sending email: %v", err)
        return err
    }
    return nil
}
