package handler

import (
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	service "github.com/rovin99/Survey-Platform/SurveyManagementService/Service"
)

type OTPHandler struct {
	otpService    service.OTPService
	accessService service.SurveyAccessService
}

func NewOTPHandler(otpService service.OTPService, accessService service.SurveyAccessService) *OTPHandler {
	return &OTPHandler{
		otpService:    otpService,
		accessService: accessService,
	}
}

// POST /api/v1/surveys/public/send-otp
// Sends OTP to email for organization access verification
func (h *OTPHandler) SendOTP(c *fiber.Ctx) error {
	var req struct {
		Email      string `json:"email"`
		ShareToken string `json:"shareToken"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request body",
		})
	}

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Email is required",
		})
	}

	if req.ShareToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Share token is required",
		})
	}

	// Validate share token and optionally check domain restrictions
	sharingInfo, err := h.accessService.GetByShareToken(c.Context(), req.ShareToken)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid share token",
		})
	}

	// For organization surveys, validate email domain
	if sharingInfo.AccessType == "ORGANIZATION" && sharingInfo.AllowedDomains != "" {
		emailDomain := extractDomain(req.Email)
		allowedDomains := strings.Split(sharingInfo.AllowedDomains, ",")

		domainAllowed := false
		for _, domain := range allowedDomains {
			if strings.EqualFold(emailDomain, strings.TrimSpace(domain)) {
				domainAllowed = true
				break
			}
		}

		if !domainAllowed {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success":        false,
				"error":          "Email domain not allowed",
				"message":        "Your email domain is not authorized for this survey",
				"allowedDomains": sharingInfo.AllowedDomains,
			})
		}
	}

	surveyTitle := "Survey"

	// Send OTP
	if err := h.otpService.SendOTP(c.Context(), req.Email, surveyTitle); err != nil {
		log.Printf("[ERROR] Failed to send OTP: %v", err)
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Verification code sent to your email",
	})
}

// POST /api/v1/surveys/public/verify-otp
// Verifies OTP and returns a verification token
func (h *OTPHandler) VerifyOTP(c *fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
		OTP   string `json:"otp"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request body",
		})
	}

	if req.Email == "" || req.OTP == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Email and OTP are required",
		})
	}

	// Verify OTP
	valid, err := h.otpService.VerifyOTP(c.Context(), req.Email, req.OTP)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	if !valid {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid OTP",
		})
	}

	// Get verification token
	token := h.otpService.GetVerificationToken(req.Email)

	return c.JSON(fiber.Map{
		"success":           true,
		"message":           "Email verified successfully",
		"verificationToken": token,
		"verifiedEmail":     req.Email,
	})
}

func extractDomain(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return ""
	}
	return parts[1]
}

