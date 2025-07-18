package middlewares

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/utils/response"
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

		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return response.Unauthorized(c, "Missing or malformed JWT")
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return response.Unauthorized(c, "Missing or malformed JWT")
		}
		tokenString := parts[1]

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

			c.Locals("user_id", uint(userId))
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

		// Check if user has Conducting role
		hasConductingRole := false
		for _, role := range roles {
			if role == "Conducting" {
				hasConductingRole = true
				break
			}
		}

		if !hasConductingRole {
			return response.Forbidden(c, "Conducting role required to access this resource")
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
