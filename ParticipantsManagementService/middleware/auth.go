package middleware

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Claims struct to parse JWT token
type Claims struct {
	UserIDStr     string `json:"sub"`         // JWT sub claim is a string
	Username      string `json:"unique_name"`
	Email         string `json:"email"`
	ParticipantID uint   `json:"participant_id,omitempty"`
	jwt.RegisteredClaims
}

// GetUserID converts the string UserID to uint
func (c *Claims) GetUserID() uint {
	id, err := strconv.ParseUint(c.UserIDStr, 10, 32)
	if err != nil {
		return 0
	}
	return uint(id)
}

// OptionalAuthMiddleware extracts user info from JWT if present, but doesn't fail for anonymous users.
// Use this before SessionTokenMiddleware to allow both authenticated and anonymous access.
func OptionalAuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get token from Authorization header or cookie
		var tokenString string

		// Check Authorization header first
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				tokenString = parts[1]
			}
		}

		// If no header, check for cookie
		if tokenString == "" {
			tokenString = c.Cookies("accessToken")
		}

		// If no token, continue as anonymous (don't fail)
		if tokenString == "" {
			return c.Next()
		}

		// Get JWT secret from environment
		jwtSecret := os.Getenv("JWT_SECRET_KEY")
		if jwtSecret == "" {
			// Can't validate token, continue as anonymous
			return c.Next()
		}

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			// Invalid token, continue as anonymous
			return c.Next()
		}

		// Extract claims
		claims, ok := token.Claims.(*Claims)
		if !ok {
			return c.Next()
		}

		userID := claims.GetUserID()
		log.Printf("[AUTH-OPTIONAL] Authenticated user - UserID: %d, Username: %s", userID, claims.Username)

		// Set user info in context
		c.Locals("userId", userID)
		c.Locals("username", claims.Username)
		c.Locals("email", claims.Email)

		if claims.ParticipantID != 0 {
			c.Locals("participantId", claims.ParticipantID)
		} else {
			c.Locals("participantId", userID)
		}

		return c.Next()
	}
}

// AuthMiddleware authenticates the participant and sets the participantId in the context
func AuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
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
			if tokenString != "" {
				log.Printf("[AUTH] Found accessToken in cookie (length: %d)", len(tokenString))
			}
		}

		// If still no token, return unauthorized
		if tokenString == "" {
			log.Printf("[AUTH] No token found - Headers: Authorization=%s, Cookie=%s", authHeader, c.Get("Cookie"))
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
			log.Printf("[AUTH] Token parse error: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Invalid token",
				"message": err.Error(),
			})
		}

		// Extract claims
		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			log.Printf("[AUTH] Invalid claims or token not valid")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Invalid token claims",
				"message": "Token validation failed",
			})
		}

		userID := claims.GetUserID()
		log.Printf("[AUTH] Successfully parsed JWT - UserID: %d, Username: %s, Email: %s", userID, claims.Username, claims.Email)

		// Set user info in context
		c.Locals("userId", userID)
		c.Locals("username", claims.Username)
		c.Locals("email", claims.Email)
		// conductorId = userId for conductors (used by evaluation endpoints)
		c.Locals("conductorId", userID)

		// For participant endpoints, we need the participant ID
		// If not in token, we should query the database to get it
		if claims.ParticipantID != 0 {
			c.Locals("participantId", claims.ParticipantID)
		} else {
			// Set user ID as participant ID for now
			// In production, you should query AuthService to get participant ID by user ID
			c.Locals("participantId", userID)
		}

		return c.Next()
	}
}
