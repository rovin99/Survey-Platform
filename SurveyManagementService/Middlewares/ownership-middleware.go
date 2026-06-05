package middlewares

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/response"
)

// GetUserIDFromContext extracts the authenticated user's ID from the context
// This is set by AuthMiddleware and should be used for all ownership checks
func GetUserIDFromContext(c *fiber.Ctx) (uint, error) {
	userID, ok := c.Locals("userId").(uint)
	if !ok || userID == 0 {
		return 0, fiber.NewError(fiber.StatusUnauthorized, "User ID not found in token")
	}
	return userID, nil
}

// VerifyOwnership checks if the provided ownerID matches the authenticated user's ID
// Returns an error response if ownership verification fails
func VerifyOwnership(c *fiber.Ctx, resourceOwnerID uint, resourceType string) error {
	userID, err := GetUserIDFromContext(c)
	if err != nil {
		return response.Unauthorized(c, "Authentication required")
	}

	if resourceOwnerID != userID {
		return response.Forbidden(c, "You do not have permission to access this "+resourceType)
	}

	return nil // Ownership verified
}
