package service

type EmailService struct {
	// Add your email service configuration here (e.g., SMTP settings)
}

func NewEmailService() *EmailService {
	return &EmailService{}
}

func (s *EmailService) SendVerificationEmail(email, code string) error {
	// Implement email sending logic here
	// You can use packages like gomail or AWS SES
	return nil
}