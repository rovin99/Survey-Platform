package middlewares

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/response"
)

func AuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Load configuration from environment variables
		jwtSecret := os.Getenv("JWT_SECRET_KEY")
		jwtIssuer := os.Getenv("JWT_ISSUER")
		jwtAudience := os.Getenv("JWT_AUDIENCE")

		if jwtSecret == "" {
			return response.InternalServerError(c, "JWT secret key not configured on server")
		}

		// Get token from Authorization header OR cookie
		var tokenString string

		// First check Authorization header
		authHeader := c.Get("Authorization")
		if authHeader != "" {
		parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		// If no header, check for accessToken cookie (set by AuthService)
		if tokenString == "" {
			tokenString = c.Cookies("accessToken")
		}

		if tokenString == "" {
			return response.Unauthorized(c, "Missing or malformed JWT")
		}

		// Parse and validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate the algorithm
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		}, jwt.WithIssuer(jwtIssuer), jwt.WithAudience(jwtAudience))

		if err != nil {
			return response.Unauthorized(c, "Invalid or expired JWT")
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			// Extract User ID from "sub" claim
			userIdStr, ok := claims["sub"].(string)
			if !ok {
				return response.Unauthorized(c, "Invalid token: sub claim is missing or not a string")
			}
			userId, err := strconv.ParseUint(userIdStr, 10, 64)
			if err != nil {
				return response.Unauthorized(c, "Invalid token: sub claim is not a valid user ID")
			}

			// Extract conductor ID if present (for Conducting role)
			// Use conductorId as userId for survey operations
			var effectiveUserId uint = uint(userId)
			if conductorIdClaim, ok := claims["conductorId"].(string); ok {
				conductorId, err := strconv.ParseUint(conductorIdClaim, 10, 64)
				if err == nil {
					effectiveUserId = uint(conductorId)
					log.Printf("Using conductorId %d for survey operations (userId: %d)", conductorId, userId)
				}
			}

			// Extract roles
			roles, ok := claims["role"].([]interface{})
			if !ok {
				// It might be a single string
				role, ok := claims["role"].(string)
				if !ok {
					return response.Unauthorized(c, "Invalid token: role claim is missing or invalid")
				}
				c.Locals("roles", []string{role})
			} else {
				var roleStrings []string
				for _, r := range roles {
					if roleStr, ok := r.(string); ok {
						roleStrings = append(roleStrings, roleStr)
					}
				}
				c.Locals("roles", roleStrings)
			}

			// Extract email (used to scope a participant's assigned surveys)
			if emailClaim, ok := claims["email"].(string); ok {
				c.Locals("email", emailClaim)
			}

			c.Locals("userId", effectiveUserId)
			return c.Next()
		}

		return response.Unauthorized(c, "Invalid JWT")
	}
}

// ConductorRoleMiddleware ensures the user has "Conducting" role
func ConductorRoleMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		roles, ok := c.Locals("roles").([]string)
		if !ok {
			return response.Unauthorized(c, "No roles found in token")
		}
		
		// Debug: Log the roles
		log.Printf("ConductorRoleMiddleware: User has roles: %v", roles)

		// Check if user has Conducting or Admin role
		hasRequiredRole := false
		for _, role := range roles {
			if role == "Conducting" || role == "Admin" {
				hasRequiredRole = true
				break
			}
		}

		if !hasRequiredRole {
			return response.Forbidden(c, "Conducting or Admin role required to access this resource")
		}

		return c.Next()
	}
}

// RequireRole middleware factory for specific role requirements
func RequireRole(requiredRole string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		roles, ok := c.Locals("roles").([]string)
		if !ok {
			return response.Unauthorized(c, "No roles found in token")
		}

		// Check if user has the required role
		hasRole := false
		for _, role := range roles {
			if role == requiredRole {
				hasRole = true
				break
			}
		}

		if !hasRole {
			return response.Forbidden(c, fmt.Sprintf("%s role required to access this resource", requiredRole))
		}

		return c.Next()
	}
}

// InternalAPIKeyMiddleware validates internal service-to-service API calls
// Uses a shared API key for authentication between microservices
func InternalAPIKeyMiddleware() fiber.Handler {
	// Load and validate key once at startup, not per-request
	expectedAPIKey := os.Getenv("INTERNAL_API_KEY")
	env := os.Getenv("ENVIRONMENT")
	isProduction := env == "production" || env == "prod"

	if expectedAPIKey == "" {
		if isProduction {
			log.Fatal("FATAL: INTERNAL_API_KEY environment variable is required in production")
		}
		log.Println("WARNING: INTERNAL_API_KEY not set. Internal API endpoints are UNPROTECTED!")
		log.Println("WARNING: Set INTERNAL_API_KEY for production deployments")
	} else if len(expectedAPIKey) < 32 {
		if isProduction {
			log.Fatal("FATAL: INTERNAL_API_KEY must be at least 32 characters in production")
		}
		log.Printf("WARNING: INTERNAL_API_KEY should be at least 32 characters (got %d)", len(expectedAPIKey))
	}

	return func(c *fiber.Ctx) error {
		// If no key configured (dev mode), allow all internal calls with warning
		if expectedAPIKey == "" {
			log.Printf("WARNING: Internal API call allowed without key (dev mode): %s %s", c.Method(), c.Path())
			c.Locals("isInternalCall", true)
			return c.Next()
		}

		// Check X-Internal-API-Key header
		providedKey := c.Get("X-Internal-API-Key")
		if providedKey == "" {
			return response.Unauthorized(c, "Internal API key required")
		}

		// Use constant-time comparison to prevent timing attacks
		if !secureCompareStrings(providedKey, expectedAPIKey) {
			log.Printf("SECURITY: Invalid internal API key from IP %s for %s", c.IP(), c.Path())
			return response.Forbidden(c, "Invalid internal API key")
		}

		// Mark this as an internal service call
		c.Locals("isInternalCall", true)
		return c.Next()
	}
}

// secureCompareStrings performs constant-time string comparison
func secureCompareStrings(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var result byte
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}
