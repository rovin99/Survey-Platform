package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/response"
)

type EmailHandler struct {
	emailService EmailServiceInterface
}

type EmailServiceInterface interface {
	SendVerificationEmail(email, code string) error
}

type EmailRequest struct {
	Email string `json:"email" validate:"required,email"`
	Code  string `json:"code" validate:"required,verification_code"`
}

// NewEmailHandler creates a new instance of EmailHandler
func NewEmailHandler(emailService EmailServiceInterface) *EmailHandler {
	return &EmailHandler{
		emailService: emailService,
	}
}

// SendVerificationEmail handles the email verification request
func (h *EmailHandler) SendVerificationEmail(c *fiber.Ctx) error {
	// Parse request body
	var req EmailRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request format")
	}

	// // Validate request
	// if err := validator.ValidateEmailRequest(req); err != nil {
	//     return response.ValidationError(c, err)
	// }

	// Send verification email
	if err := h.emailService.SendVerificationEmail(req.Email, req.Code); err != nil {
		return response.InternalServerError(c, "Failed to send verification email")
	}

	// Return success response
	return response.Success(c, nil, "Verification email sent successfully")
}
