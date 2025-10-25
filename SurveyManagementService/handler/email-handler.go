package handler

import (
    "github.com/gofiber/fiber/v2"
    
	"github.com/rovin99/Survey-Platform/SurveyManagementService/utils/response"
	
   
)

type EmailHandler struct {
    emailService EmailServiceInterface
}

type EmailServiceInterface interface {
    SendVerificationEmail(email, code string) error
    SendMagicLinkEmail(email, magicLink, username string) error
    CheckHealth() error
}

type EmailRequest struct {
    Email string `json:"email" validate:"required,email"`
    Code  string `json:"code" validate:"required,verification_code"`
}

type MagicLinkRequest struct {
    Email     string `json:"email" validate:"required,email"`
    MagicLink string `json:"magicLink" validate:"required"`
    Username  string `json:"username"`
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

// SendMagicLinkEmail handles magic link email requests
func (h *EmailHandler) SendMagicLinkEmail(c *fiber.Ctx) error {
    var req MagicLinkRequest
    if err := c.BodyParser(&req); err != nil {
        return response.BadRequest(c, "Invalid request format")
    }

    if err := h.emailService.SendMagicLinkEmail(req.Email, req.MagicLink, req.Username); err != nil {
        return response.InternalServerError(c, "Failed to send magic link email")
    }

    return response.Success(c, nil, "Magic link email sent successfully")
}

// CheckEmailHealth checks if email service is working
func (h *EmailHandler) CheckEmailHealth(c *fiber.Ctx) error {
    if err := h.emailService.CheckHealth(); err != nil {
        return response.InternalServerError(c, "Email service not healthy")
    }

    return response.Success(c, fiber.Map{
        "status": "healthy",
        "service": "email-service",
    }, "Email service is healthy")
}


