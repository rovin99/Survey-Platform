using System.Net;

namespace AuthService.Utils
{
    public class ApiResponse<T>
    {
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }
        public ErrorDetail? Error { get; set; }
        public int StatusCode { get; set; }
        public bool Success { get; set; }
    }

    public class ErrorDetail
    {
        public string Message { get; set; } = string.Empty;
        public string? Code { get; set; }
        public object? Details { get; set; }
    }

    public static class ResponseUtil
    {
        public static ApiResponse<T> Success<T>(T data, string message = "Operation successful", int statusCode = (int)HttpStatusCode.OK)
        {
            return new ApiResponse<T>
            {
                Success = true,
                Message = message,
                Data = data,
                StatusCode = statusCode,
                Error = null
            };
        }

        public static ApiResponse<T> Error<T>(string message, 
            string? errorCode = null, 
            object? errorDetails = null, 
            int statusCode = (int)HttpStatusCode.BadRequest,
            T? data = default)
        {
            return new ApiResponse<T>
            {
                Success = false,
                Message = message,
                Data = data,
                StatusCode = statusCode,
                Error = new ErrorDetail
                {
                    Message = message,
                    Code = errorCode,
                    Details = errorDetails
                }
            };
        }

        // Commonly used HTTP status code helper methods
        public static ApiResponse<T> NotFound<T>(string message = "Resource not found")
            => Error<T>(message, "NOT_FOUND", statusCode: (int)HttpStatusCode.NotFound);

        public static ApiResponse<T> BadRequest<T>(string message = "Invalid request")
            => Error<T>(message, "BAD_REQUEST", statusCode: (int)HttpStatusCode.BadRequest);

        public static ApiResponse<T> Unauthorized<T>(string message = "Unauthorized access")
            => Error<T>(message, "UNAUTHORIZED", statusCode: (int)HttpStatusCode.Unauthorized);

        public static ApiResponse<T> Forbidden<T>(string message = "Access forbidden")
            => Error<T>(message, "FORBIDDEN", statusCode: (int)HttpStatusCode.Forbidden);
    }
}