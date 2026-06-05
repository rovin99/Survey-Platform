package handler

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Service"
)

type SurveyAccessHandler struct {
	service service.SurveyAccessService
}

func NewSurveyAccessHandler(service service.SurveyAccessService) *SurveyAccessHandler {
	return &SurveyAccessHandler{service: service}
}

// DTOs
type EnableSharingRequest struct {
	AccessType     string   `json:"accessType"`
	AllowedDomains []string `json:"allowedDomains"`
	Password       string   `json:"password,omitempty"`       // Optional password protection
	ExpiresAt      string   `json:"expiresAt,omitempty"`      // Optional expiration (ISO 8601 format)
	MaxResponses   *int     `json:"maxResponses,omitempty"`   // Optional response limit
}

type UpdateSharingRequest struct {
	AccessType     string   `json:"accessType"`
	AllowedDomains []string `json:"allowedDomains"`
	IsActive       bool     `json:"isActive"`
	Password       string   `json:"password,omitempty"`       // Optional password (empty string to clear)
	ExpiresAt      string   `json:"expiresAt,omitempty"`      // Optional expiration (ISO 8601 format)
	MaxResponses   *int     `json:"maxResponses,omitempty"`   // Optional response limit
}

// POST /api/surveys/:surveyId/sharing/enable
func (h *SurveyAccessHandler) EnableSharing(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil || surveyID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid survey ID",
			"message": "Survey ID must be a valid positive integer",
		})
	}

	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Valid authentication required",
		})
	}

	var req EnableSharingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
	}

	if req.AccessType != "PUBLIC" && req.AccessType != "ORGANIZATION" && req.AccessType != "INVITED_ONLY" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid access type",
			"message": "Access type must be PUBLIC, ORGANIZATION, or INVITED_ONLY",
		})
	}

	if req.AccessType == "ORGANIZATION" && len(req.AllowedDomains) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Validation error",
			"message": "allowedDomains required for organization-specific surveys",
		})
	}

	// Parse options
	var options *service.SharingOptions
	if req.Password != "" || req.ExpiresAt != "" || req.MaxResponses != nil {
		options = &service.SharingOptions{
			Password:     req.Password,
			MaxResponses: req.MaxResponses,
		}
		if req.ExpiresAt != "" {
			expiresAt, err := time.Parse(time.RFC3339, req.ExpiresAt)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error":   "Invalid expiration date",
					"message": "expiresAt must be in ISO 8601 format (e.g., 2024-12-31T23:59:59Z)",
				})
			}
			options.ExpiresAt = &expiresAt
		}
	}

	log.Printf("[INFO] Enabling sharing for survey %d by conductor %d", surveyID, conductorID)
	control, err := h.service.EnableSharing(c.Context(), uint(surveyID), conductorID, req.AccessType, req.AllowedDomains, options)
	if err != nil {
		log.Printf("[ERROR] Failed to enable sharing: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to enable sharing",
			"message": err.Error(),
		})
	}

	// Generate share URL
	shareURL := generateShareURL(c, control.ShareToken)

	// Parse allowed domains
	var allowedDomains []string
	if control.AllowedDomains != "" {
		allowedDomains = strings.Split(control.AllowedDomains, ",")
	}

	log.Printf("[SUCCESS] Sharing enabled - SurveyID: %d, Token: %s", surveyID, control.ShareToken)
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Sharing enabled successfully",
		"data": fiber.Map{
			"id":             control.ID,
			"surveyId":       control.SurveyID,
			"accessType":     control.AccessType,
			"shareToken":     control.ShareToken,
			"shareUrl":       shareURL,
			"isActive":       control.IsActive,
			"allowedDomains": allowedDomains,
			"hasPassword":    control.PasswordHash != "",
			"expiresAt":      control.ExpiresAt,
			"maxResponses":   control.MaxResponses,
			"createdAt":      control.CreatedAt,
		},
	})
}

// PUT /api/surveys/:surveyId/sharing
func (h *SurveyAccessHandler) UpdateSharing(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Valid authentication required",
		})
	}

	var req UpdateSharingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Parse options
	var options *service.SharingOptions
	if req.Password != "" || req.ExpiresAt != "" || req.MaxResponses != nil {
		options = &service.SharingOptions{
			Password:     req.Password,
			MaxResponses: req.MaxResponses,
		}
		if req.ExpiresAt != "" {
			expiresAt, err := time.Parse(time.RFC3339, req.ExpiresAt)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error":   "Invalid expiration date",
					"message": "expiresAt must be in ISO 8601 format (e.g., 2024-12-31T23:59:59Z)",
				})
			}
			options.ExpiresAt = &expiresAt
		}
	}

	control, err := h.service.UpdateSharing(c.Context(), uint(surveyID), conductorID, req.AccessType, req.AllowedDomains, req.IsActive, options)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	shareURL := generateShareURL(c, control.ShareToken)
	var allowedDomains []string
	if control.AllowedDomains != "" {
		allowedDomains = strings.Split(control.AllowedDomains, ",")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":             control.ID,
			"surveyId":       control.SurveyID,
			"accessType":     control.AccessType,
			"shareToken":     control.ShareToken,
			"shareUrl":       shareURL,
			"isActive":       control.IsActive,
			"allowedDomains": allowedDomains,
			"hasPassword":    control.PasswordHash != "",
			"expiresAt":      control.ExpiresAt,
			"maxResponses":   control.MaxResponses,
		},
	})
}

// DELETE /api/surveys/:surveyId/sharing
func (h *SurveyAccessHandler) DisableSharing(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Valid authentication required",
		})
	}

	err = h.service.DisableSharing(c.Context(), uint(surveyID), conductorID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Sharing disabled successfully",
	})
}

// GET /api/surveys/:surveyId/sharing
func (h *SurveyAccessHandler) GetSharingInfo(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Valid authentication required",
		})
	}

	control, err := h.service.GetSharingInfo(c.Context(), uint(surveyID), conductorID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Sharing not enabled for this survey",
		})
	}

	shareURL := generateShareURL(c, control.ShareToken)
	var allowedDomains []string
	if control.AllowedDomains != "" {
		allowedDomains = strings.Split(control.AllowedDomains, ",")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":             control.ID,
			"surveyId":       control.SurveyID,
			"accessType":     control.AccessType,
			"shareToken":     control.ShareToken,
			"shareUrl":       shareURL,
			"isActive":       control.IsActive,
			"allowedDomains": allowedDomains,
			"hasPassword":    control.PasswordHash != "",
			"expiresAt":      control.ExpiresAt,
			"maxResponses":   control.MaxResponses,
			"createdAt":      control.CreatedAt,
		},
	})
}

// POST /api/surveys/public/validate-access
func (h *SurveyAccessHandler) ValidateAccess(c *fiber.Ctx) error {
	shareToken := c.Query("token")
	if shareToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Share token required",
		})
	}

	// Parse request body for email and password
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	c.BodyParser(&req) // Optional body, so ignore error

	// Get user info from context or request body
	email := req.Email
	if email == "" {
		userEmail := c.Locals("email")
		if userEmail != nil {
			if emailStr, ok := userEmail.(string); ok && emailStr != "" {
				email = emailStr
			}
		}
	}
	if email == "" {
		email = "anonymous@guest.local" // Default for anonymous users
	}

	participantIDVal := c.Locals("participantId")
	participantID, _ := participantIDVal.(uint)
	// participantID will be 0 for anonymous users, which is fine

	// Get client IP - check forwarded headers first (for requests through proxy/nginx)
	ipAddress := c.Get("X-Forwarded-For")
	if ipAddress == "" {
		ipAddress = c.Get("X-Real-IP")
	}
	if ipAddress == "" {
		ipAddress = c.IP()
	}
	userAgent := c.Get("User-Agent")

	result, err := h.service.ValidateAccess(c.Context(), shareToken, email, req.Password, participantID, ipAddress, userAgent)
	
	// Handle login required case for ORGANIZATION type (not an error, just needs login)
	if result.RequiresLogin && !result.Granted && err == nil && (email == "" || email == "anonymous@guest.local") {
		return c.JSON(fiber.Map{
			"success":          false,
			"requiresLogin":    true,
			"requiresPassword": result.RequiresPassword,
			"accessType":       result.AccessType,
			"allowedDomains":   result.AllowedDomains,
			"data": fiber.Map{
				"surveyId":       result.SurveyID,
				"title":          result.SurveyTitle,
				"allowAnonymous": false,
			},
		})
	}
	
	// Handle password required case (not an error, just needs more info)
	if result.RequiresPassword && !result.Granted && err == nil {
		return c.JSON(fiber.Map{
			"success":          false,
			"requiresPassword": true,
			"accessType":       result.AccessType,
			"data": fiber.Map{
				"surveyId":       result.SurveyID,
				"title":          result.SurveyTitle,
				"allowAnonymous": result.AllowAnonymous,
			},
		})
	}

	if err != nil || !result.Granted {
		errMsg := "Access denied"
		if err != nil {
			errMsg = err.Error()
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success":        false,
			"error":          "Access denied",
			"message":        errMsg,
			"reason":         result.DenialReason,
			"accessType":     result.AccessType,
			"allowedDomains": result.AllowedDomains,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Access granted",
		"data": fiber.Map{
			"surveyId":       result.SurveyID,
			"title":          result.SurveyTitle,
			"allowAnonymous": result.AllowAnonymous,
		},
	})
}

// POST /api/v1/surveys/public/validate-invitation
// Validates a unique invitation token and grants access
func (h *SurveyAccessHandler) ValidateInvitation(c *fiber.Ctx) error {
	invitationToken := c.Query("token")
	if invitationToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Missing invitation token",
			"message": "Invitation token is required",
		})
	}

	// Get email from request body (required for anonymous access)
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"` // Optional, for password-protected surveys
	}
	c.BodyParser(&req)

	ipAddress := c.IP()
	userAgent := c.Get("User-Agent")

	log.Printf("[INFO] Validating invitation token: %s, Email: %s, IP: %s", invitationToken, req.Email, ipAddress)

	result, err := h.service.ValidateInvitation(c.Context(), invitationToken, req.Email, req.Password, ipAddress, userAgent)
	if err != nil {
		log.Printf("[ERROR] Invitation validation failed: %v", err)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"error":   "Access denied",
			"message": err.Error(),
			"reason":  result.DenialReason,
		})
	}

	if !result.Granted {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"error":   "Access denied",
			"message": result.DenialReason,
			"reason":  result.DenialReason,
		})
	}

	log.Printf("[SUCCESS] Invitation validated - SurveyID: %d, Email: %s, InvitedEmail: %s", result.SurveyID, req.Email, result.InvitedEmail)
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Access granted",
		"data": fiber.Map{
			"surveyId":         result.SurveyID,
			"title":            result.SurveyTitle,
			"requiresPassword": result.RequiresPassword,
			"allowAnonymous":   result.AllowAnonymous,
			"invitedEmail":     result.InvitedEmail, // Email the invitation was sent to
		},
	})
}

// GET /api/surveys/:surveyId/sharing/logs
func (h *SurveyAccessHandler) GetAccessLogs(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	conductorIDVal := c.Locals("userId")
	conductorID, ok := conductorIDVal.(uint)
	if !ok || conductorID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Valid authentication required",
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	logs, err := h.service.GetAccessLogs(c.Context(), uint(surveyID), conductorID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
		"pagination": fiber.Map{
			"limit":  limit,
			"offset": offset,
			"count":  len(logs),
		},
	})
}

// GET /internal/api/v1/surveys/:surveyId/access-logs
// Internal endpoint for service-to-service calls - no JWT required
func (h *SurveyAccessHandler) GetAccessLogsInternal(c *fiber.Ctx) error {
	surveyIDStr := c.Params("surveyId")
	surveyID, err := strconv.ParseUint(surveyIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid survey ID",
		})
	}

	// No ownership check for internal API - trusting internal service calls
	logs, err := h.service.GetAccessLogsInternal(c.Context(), uint(surveyID), 1000, 0)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
	})
}

// Helper function
func generateShareURL(c *fiber.Ctx, token string) string {
	// Use frontend URL from environment or header
	frontendURL := c.Get("X-Frontend-URL")
	if frontendURL == "" {
		// Check for environment variable
		frontendURL = os.Getenv("FRONTEND_URL")
		if frontendURL == "" {
			// Default to localhost:3000 for local development
			hostname := c.Hostname()
			if hostname == "localhost" || strings.Contains(hostname, "localhost") ||
			   hostname == "127.0.0.1" || strings.Contains(hostname, "127.0.0.1") {
				frontendURL = "http://localhost:3000"
			} else {
				scheme := "http"
				if c.Protocol() == "https" {
					scheme = "https"
				}
				frontendURL = scheme + "://" + hostname
			}
		}
	}

	return frontendURL + "/survey/public/" + token
}
