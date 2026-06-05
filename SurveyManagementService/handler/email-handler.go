package handler

import (
    "os"

    "github.com/gofiber/fiber/v2"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/response"
	
   
)

type EmailHandler struct {
    emailService EmailServiceInterface
}

type EmailServiceInterface interface {
    SendVerificationEmail(email, code string) error
    SendMagicLinkEmail(email, magicLink, username string) error
    SendGenericEmail(to, subject, body string) error
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

// SendGenericEmail handles sending a generic email (used by other services for notifications)
// Requires X-Internal-API-Key header to prevent public abuse
func (h *EmailHandler) SendGenericEmail(c *fiber.Ctx) error {
    // Verify internal API key
    apiKey := c.Get("X-Internal-API-Key")
    expectedKey := os.Getenv("INTERNAL_API_KEY")
    if expectedKey != "" && apiKey != expectedKey {
        return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
            "success": false,
            "error":   "Unauthorized: valid internal API key required",
        })
    }

    var req struct {
        To      string `json:"to"`
        Subject string `json:"subject"`
        Body    string `json:"body"`
    }
    if err := c.BodyParser(&req); err != nil || req.To == "" || req.Subject == "" {
        return response.BadRequest(c, "Invalid request: to, subject, body required")
    }

    if err := h.emailService.SendGenericEmail(req.To, req.Subject, req.Body); err != nil {
        return response.InternalServerError(c, "Failed to send email")
    }

    return response.Success(c, nil, "Email sent successfully")
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


