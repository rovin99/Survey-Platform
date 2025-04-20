package middleware

import (
	"log"

	"github.com/gofiber/fiber/v2"
)

// AuthMiddleware authenticates the participant and sets the participantId in the context
func AuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Always set a mock participant ID for now
		c.Locals("participantId", uint(1))
		
		// Log the request
		log.Printf("Auth middleware: Setting participantId=1 for %s %s", c.Method(), c.Path())
		
		return c.Next()
	}
}
