package middleware

import (
	"fmt"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Claims struct to parse JWT token
type Claims struct {
	UserID        uint   `json:"sub"`
	Username      string `json:"unique_name"`
	Email         string `json:"email"`
	ParticipantID uint   `json:"participant_id,omitempty"`
	jwt.RegisteredClaims
}

// AuthMiddleware authenticates the participant and sets the participantId in the context
func AuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check if we're in development mode
		isDev := os.Getenv("APP_ENV") == "development" || os.Getenv("APP_ENV") == ""

		// In development mode, we'll allow requests without authentication
		if isDev {
			// For development, always set a mock participant ID
			c.Locals("participantId", uint(1))
			c.Locals("userId", uint(1))
			return c.Next()
		}

		// Production mode - validate JWT token
		// Get token from Authorization header or cookie
		var tokenString string

		// Check Authorization header first
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			// Extract bearer token
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				tokenString = parts[1]
			}
		}

		// If no header, check for cookie
		if tokenString == "" {
			tokenString = c.Cookies("accessToken")
		}

		// If still no token, return unauthorized
		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Authentication required",
				"message": "No authentication token provided",
			})
		}

		// Get JWT secret from environment
		jwtSecret := os.Getenv("JWT_SECRET_KEY")
		if jwtSecret == "" {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Server configuration error",
				"message": "JWT secret not configured",
			})
		}

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			// Validate signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Invalid token",
				"message": err.Error(),
			})
		}

		// Extract claims
		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Invalid token claims",
				"message": "Token validation failed",
			})
		}

		// Set user info in context
		c.Locals("userId", claims.UserID)
		c.Locals("username", claims.Username)
		c.Locals("email", claims.Email)

		// For participant endpoints, we need the participant ID
		// If not in token, we should query the database to get it
		if claims.ParticipantID != 0 {
			c.Locals("participantId", claims.ParticipantID)
		} else {
			// Set user ID as participant ID for now
			// In production, you should query AuthService to get participant ID by user ID
			c.Locals("participantId", claims.UserID)
		}

		return c.Next()
	}
}
