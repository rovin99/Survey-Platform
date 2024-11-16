package middleware

func RequireAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Get("Authorization")
		if token == "" {
			return response.Unauthorized(c, "Missing authentication token")
		}

		// Validate token
		claims, err := validateToken(token)
		if err != nil {
			return response.Unauthorized(c, "Invalid authentication token")
		}

		c.Locals("userID", claims.UserID)
		return c.Next()
	}
}