package middleware

import (
	"crypto/subtle"
	"log"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository"
)

// SessionTokenMiddleware validates session ownership for draft/submit/evaluate endpoints.
// For authenticated users: validates participantID matches session owner OR email matches for anonymous sessions.
// For anonymous users: requires valid X-Session-Token header.
func SessionTokenMiddleware(repo repository.ParticipantRepository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Parse session ID from URL
		sessionIDStr := c.Params("sessionId")
		sessionID, err := strconv.ParseUint(sessionIDStr, 10, 64)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":   "Invalid session ID",
				"message": "Session ID must be a valid number",
			})
		}

		// Get session from database
		session, err := repo.GetSessionByID(c.Context(), uint(sessionID))
		if err != nil {
			log.Printf("[SESSION_AUTH] Session not found: %d", sessionID)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "Session not found",
				"message": "The requested session does not exist",
			})
		}

		// Check if user is authenticated (set by OptionalAuthMiddleware)
		participantIDVal := c.Locals("participantId")
		participantID, isAuthenticated := participantIDVal.(uint)

		// Get user's email from JWT (set by OptionalAuthMiddleware)
		userEmail := ""
		if emailVal := c.Locals("email"); emailVal != nil {
			userEmail, _ = emailVal.(string)
		}

		// Case 1: Authenticated session (participant_id != 0) - verify user owns this session
		if session.ParticipantID != 0 && isAuthenticated && participantID != 0 {
			if session.ParticipantID != participantID {
				log.Printf("[SESSION_AUTH] Participant %d tried to access session %d owned by %d",
					participantID, sessionID, session.ParticipantID)
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error":   "Access denied",
					"message": "You don't have permission to access this session",
				})
			}
			// Authenticated user owns the session - allow access
			c.Locals("session", session)
			return c.Next()
		}

		// Case 2: Anonymous session (participant_id == 0) with authenticated user
		// Allow access if user's email matches the session's participant_email
		// This enables users to view their quiz results from dashboard after registering
		if session.ParticipantID == 0 && isAuthenticated && userEmail != "" {
			if session.ParticipantEmail != "" && strings.EqualFold(session.ParticipantEmail, userEmail) {
				log.Printf("[SESSION_AUTH] Email match - User %s accessing anonymous session %d (email: %s)",
					userEmail, sessionID, session.ParticipantEmail)
				c.Locals("session", session)
				return c.Next()
			}
		}

		// Case 3: Anonymous access - must provide valid session token
		sessionToken := c.Get("X-Session-Token")
		if sessionToken == "" {
			log.Printf("[SESSION_AUTH] Anonymous access without token for session %d (user email: %s, session email: %s)",
				sessionID, userEmail, session.ParticipantEmail)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Session token required",
				"message": "Anonymous users must provide X-Session-Token header",
			})
		}

		// Validate token using constant-time comparison (prevents timing attacks)
		if session.SessionToken == "" || !secureCompare(sessionToken, session.SessionToken) {
			log.Printf("[SESSION_AUTH] Invalid token for session %d from IP %s", sessionID, c.IP())
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "Invalid session token",
				"message": "The provided session token is invalid",
			})
		}

		// Valid token - allow access
		c.Locals("session", session)
		return c.Next()
	}
}

// secureCompare performs constant-time string comparison to prevent timing attacks
func secureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
