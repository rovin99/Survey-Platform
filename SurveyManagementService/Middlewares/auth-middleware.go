// package middleware

// import (
//     "github.com/gofiber/fiber/v2"
//     "github.com/golang-jwt/jwt/v4"
//     "github.com/rovin99/Survey-Platform/SurveyManagementService/utils/response"
// )

// // Secret key to validate the JWT token
// var jwtSecret = []byte("ThisIsASecretKeyWithAtLeast128Bits") // Replace with your actual secret

// func RequireAuth() fiber.Handler {
//     return func(c *fiber.Ctx) error {
//         // Get the Authorization header
//         authHeader := c.Get("Authorization")
//         if authHeader == "" {
//             return response.Unauthorized(c, "Missing authentication token")
//         }

//         // Check for "Bearer " prefix
//         const bearerPrefix = "Bearer "
//         if len(authHeader) <= len(bearerPrefix) || authHeader[:len(bearerPrefix)] != bearerPrefix {
//             return response.Unauthorized(c, "Invalid token format")
//         }

//         // Extract token string
//         tokenString := authHeader[len(bearerPrefix):]

//         // Parse and validate the JWT token
//         token, err := jwt.ParseWithClaims(tokenString, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
//             // Ensure the signing method is valid
//             if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
//                 return nil, fiber.NewError(fiber.StatusUnauthorized, "Unexpected signing method")
//             }
//             return jwtSecret, nil
//         })

//         if err != nil || !token.Valid {
//             return response.Unauthorized(c, "Invalid or expired token")
//         }

//         // Extract claims and set the userID in context
//         claims, ok := token.Claims.(*jwt.MapClaims)
//         if !ok {
//             return response.Unauthorized(c, "Invalid token claims")
//         }

//         userID, ok := (*claims)["userID"].(float64) // JWT numbers are float64 by default
//         if !ok {
//             return response.Unauthorized(c, "Invalid user ID in token")
//         }

//         c.Locals("userID", uint(userID)) // Convert to uint if needed
//         return c.Next()
//     }
// }


package middlewares

import (
	"time"
    "fmt"
    "github.com/gofiber/fiber/v2"
    "github.com/golang-jwt/jwt/v4"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/utils/response"
)

// CustomClaims defines a struct for JWT claims
type CustomClaims struct {
    UserID uint `json:"userID"`
    jwt.RegisteredClaims
}

// Secret key to validate the JWT token
var jwtSecret = []byte("ThisIsASecretKeyWithAtLeast128Bits") // Replace with your actual secret

func RequireAuth() fiber.Handler {
    return func(c *fiber.Ctx) error {
        // Get the Authorization header
        authHeader := c.Get("Authorization")
        if authHeader == "" {
            return response.Unauthorized(c, "Missing authentication token")
        }

        // Check for "Bearer " prefix
        const bearerPrefix = "Bearer "
        if len(authHeader) <= len(bearerPrefix) || authHeader[:len(bearerPrefix)] != bearerPrefix {
            return response.Unauthorized(c, "Invalid token format")
        }

        // Extract token string
        tokenString := authHeader[len(bearerPrefix):]

        // Parse and validate the JWT token using CustomClaims
        token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
            // Ensure the signing method is valid
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
            }
            return jwtSecret, nil
        })

        if err != nil {
            return response.Unauthorized(c, fmt.Sprintf("Token validation failed: %v", err))
        }

        if !token.Valid {
            return response.Unauthorized(c, "Invalid token")
        }

        // Extract claims using the CustomClaims struct
        claims, ok := token.Claims.(*CustomClaims)
        if !ok {
            return response.Unauthorized(c, "Invalid token claims structure")
        }

        // Set the userID in context
        c.Locals("userID", claims.UserID)
        
        return c.Next()
    }
}

// Helper function to generate a token (for reference)
func GenerateToken(userID uint) (string, error) {
    claims := &CustomClaims{
        UserID: userID,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)), // Token expires in 24 hours
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(jwtSecret)
}