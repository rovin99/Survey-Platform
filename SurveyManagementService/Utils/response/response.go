package response

import (
	"github.com/gofiber/fiber/v2"
)

// Success creates a successful API response
func Success(c *fiber.Ctx, data interface{}, message string, statusCode ...int) error {
	code := http.StatusOK
	if len(statusCode) > 0 {
		code = statusCode[0]
	}

	return c.Status(code).JSON(ApiResponse{
		Success:    true,
		Message:    message,
		Data:      data,
		StatusCode: code,
	})
}

// Error creates an error API response
func Error(c *fiber.Ctx, message string, errorCode string, statusCode int, details interface{}) error {
	return c.Status(statusCode).JSON(ApiResponse{
		Success:    false,
		Message:    message,
		StatusCode: statusCode,
		Error: &ErrorDetail{
			Message: message,
			Code:    errorCode,
			Details: details,
		},
	})
}

// Commonly used HTTP status code helper methods

// NotFound returns a 404 Not Found response
func NotFound(c *fiber.Ctx, message string) error {
	if message == "" {
		message = "Resource not found"
	}
	return Error(c, message, "NOT_FOUND", http.StatusNotFound, nil)
}

// BadRequest returns a 400 Bad Request response
func BadRequest(c *fiber.Ctx, message string) error {
	if message == "" {
		message = "Invalid request"
	}
	return Error(c, message, "BAD_REQUEST", http.StatusBadRequest, nil)
}

// Unauthorized returns a 401 Unauthorized response
func Unauthorized(c *fiber.Ctx, message string) error {
	if message == "" {
		message = "Unauthorized access"
	}
	return Error(c, message, "UNAUTHORIZED", http.StatusUnauthorized, nil)
}

// Forbidden returns a 403 Forbidden response
func Forbidden(c *fiber.Ctx, message string) error {
	if message == "" {
		message = "Access forbidden"
	}
	return Error(c, message, "FORBIDDEN", http.StatusForbidden, nil)
}

// InternalServerError returns a 500 Internal Server Error response
func InternalServerError(c *fiber.Ctx, message string) error {
	if message == "" {
		message = "Internal server error"
	}
	return Error(c, message, "INTERNAL_SERVER_ERROR", http.StatusInternalServerError, nil)
}

// ValidationError returns a 422 Unprocessable Entity response
func ValidationError(c *fiber.Ctx, details interface{}) error {
	return Error(c, "Validation failed", "VALIDATION_ERROR", http.StatusUnprocessableEntity, details)
}