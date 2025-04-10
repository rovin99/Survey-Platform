package middleware

import (
	"os"

	"github.com/gofiber/fiber/v2"
)

// AuthMiddleware authenticates the participant and sets the participantId in the context
func AuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check if we're in development mode
		isDev := os.Getenv("APP_ENV") == "development" || os.Getenv("APP_ENV") == ""

		// In development mode, we'll allow requests without authentication
		if isDev {
			// For development, always set a mock participant ID
			c.Locals("participantId", uint(1))
			return c.Next()
		}

		// For production, implement actual JWT token validation
		token := c.Get("Authorization")
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
		}

		// TODO: Implement proper JWT validation here
		// This is a placeholder - replace with actual auth logic

		// Set participantId in context for handlers to use
		c.Locals("participantId", uint(1))

		return c.Next()
	}
}
