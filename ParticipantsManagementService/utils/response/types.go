package response


type ErrorDetail struct {
	Message string      `json:"message"`
	Code    string      `json:"code"`
	Details interface{} `json:"details,omitempty"`
}

type ApiResponse struct {
	Success    bool        `json:"success"`
	Message    string      `json:"message"`
	Data       interface{} `json:"data,omitempty"`
	Error      *ErrorDetail `json:"error,omitempty"`
	StatusCode int         `json:"statusCode"`
}