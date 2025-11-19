package handler

import (
	"log"
	"os"
	"strconv"
	"strings"

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
}

type UpdateSharingRequest struct {
	AccessType     string   `json:"accessType"`
	AllowedDomains []string `json:"allowedDomains"`
	IsActive       bool     `json:"isActive"`
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

	if req.AccessType != "PUBLIC" && req.AccessType != "ORGANIZATION" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid access type",
			"message": "Access type must be PUBLIC or ORGANIZATION",
		})
	}

	if req.AccessType == "ORGANIZATION" && len(req.AllowedDomains) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Validation error",
			"message": "allowedDomains required for organization-specific surveys",
		})
	}

	log.Printf("[INFO] Enabling sharing for survey %d by conductor %d", surveyID, conductorID)
	control, err := h.service.EnableSharing(c.Context(), uint(surveyID), conductorID, req.AccessType, req.AllowedDomains)
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

	conductorID := c.Locals("userId").(uint)

	var req UpdateSharingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	control, err := h.service.UpdateSharing(c.Context(), uint(surveyID), conductorID, req.AccessType, req.AllowedDomains, req.IsActive)
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

	conductorID := c.Locals("userId").(uint)

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

	conductorID := c.Locals("userId").(uint)

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

	// Get user info from context (may be anonymous)
	userEmail := c.Locals("email")
	email := "anonymous@guest.local" // Default for anonymous users
	if userEmail != nil {
		if emailStr, ok := userEmail.(string); ok && emailStr != "" {
			email = emailStr
		}
	}

	participantIDVal := c.Locals("participantId")
	participantID, _ := participantIDVal.(uint)
	// participantID will be 0 for anonymous users, which is fine

	ipAddress := c.IP()
	userAgent := c.Get("User-Agent")

	result, err := h.service.ValidateAccess(c.Context(), shareToken, email, participantID, ipAddress, userAgent)
	if err != nil || !result.Granted {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Access denied",
			"message": err.Error(),
			"reason":  result.DenialReason,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Access granted",
		"data": fiber.Map{
			"surveyId": result.SurveyID,
			"title":    result.SurveyTitle,
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

	conductorID := c.Locals("userId").(uint)

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
