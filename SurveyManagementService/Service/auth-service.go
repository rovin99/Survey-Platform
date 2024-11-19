// // auth_service.go
// package service

// import (
//     "bytes"
//     "encoding/json"
//     "fmt"
//     "net/http"
// )

// type AuthService struct {
//     authServiceURL string
// }

// func NewAuthService(baseURL string) *AuthService {
//     return &AuthService{
//         authServiceURL: baseURL,
//     }
// }

// type RoleAssignmentRequest struct {
//     UserID   uint   `json:"userId"`
//     RoleName string `json:"roleName"`
// }

// func (s *AuthService) AssignConductorRole(userID uint) error {
//     reqBody := RoleAssignmentRequest{
//         UserID:   userID,
//         RoleName: "Conducting",
//     }

//     jsonBody, err := json.Marshal(reqBody)
//     if err != nil {
//         return err
//     }

//     url := fmt.Sprintf("%s/api/Auth/users/%d/roles", s.authServiceURL, userID)
//     req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
//     if err != nil {
//         return err
//     }

//     req.Header.Set("Content-Type", "application/json")

//     client := &http.Client{}
//     resp, err := client.Do(req)
//     if err != nil {
//         return err
//     }
//     defer resp.Body.Close()

//     if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
//         return fmt.Errorf("failed to assign conductor role: status %d", resp.StatusCode)
//     }

//     return nil
// }

package service

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type AuthService struct {
    authServiceURL string
    authToken     string  // Add token field for service-to-service auth
}

type AuthServiceConfig struct {
    BaseURL string
    Token   string  // JWT token for service authentication
}

// Enhanced error type for better error handling
type AuthError struct {
    StatusCode int
    Message    string
}

func (e *AuthError) Error() string {
    return fmt.Sprintf("auth service error: %s (status: %d)", e.Message, e.StatusCode)
}

type RoleAssignmentRequest struct {
    UserID   uint   `json:"userId"`
    RoleName string `json:"roleName"`
}

type ErrorResponse struct {
    Success bool `json:"success"`
    Message string `json:"message"`
    Error   struct {
        Message string `json:"message"`
        Code    string `json:"code"`
    } `json:"error"`
    StatusCode int `json:"statusCode"`
}

// NewAuthService creates a new instance of AuthService with configuration
func NewAuthService(config AuthServiceConfig) *AuthService {
    return &AuthService{
        authServiceURL: config.BaseURL,
        authToken:     config.Token,
    }
}

// AssignConductorRole assigns the conductor role to a user
func (s *AuthService) AssignConductorRole(userID uint) error {
    reqBody := RoleAssignmentRequest{
        UserID:   userID,
        RoleName: "Conducting",
    }

    jsonBody, err := json.Marshal(reqBody)
    if err != nil {
        return fmt.Errorf("failed to marshal request: %w", err)
    }

    url := fmt.Sprintf("%s/api/Auth/users/%d/roles", s.authServiceURL, userID)
    req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonBody))
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }

    // Set headers
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.authToken))

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return fmt.Errorf("failed to send request: %w", err)
    }
    defer resp.Body.Close()

    // Read response body
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return fmt.Errorf("failed to read response body: %w", err)
    }

    // Handle non-success status codes
    if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
        // Try to parse error response
        var errorResp ErrorResponse
        if err := json.Unmarshal(body, &errorResp); err == nil {
            return &AuthError{
                StatusCode: resp.StatusCode,
                Message:    errorResp.Message,
            }
        }
        // Fallback error if response parsing fails
        return &AuthError{
            StatusCode: resp.StatusCode,
            Message:    fmt.Sprintf("failed to assign conductor role: status %d", resp.StatusCode),
        }
    }

    return nil
}