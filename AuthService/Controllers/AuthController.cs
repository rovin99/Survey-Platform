using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AuthService.Models;
using AuthService.Utils;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authorization;
using AuthService.Models.DTOs;
using System.ComponentModel.DataAnnotations;
using System.Net;
using Microsoft.AspNetCore.Http;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Hosting;

namespace AuthService.Controllers 
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase 
    {
        private readonly IAuthService _authService;
        private readonly IAntiforgery _antiforgery;

        public AuthController(IAuthService authService, IAntiforgery antiforgery)
        {
            _authService = authService;
            _antiforgery = antiforgery;
        }

        
        [HttpPost("register")]
        // [EnableRateLimiting("AuthPolicy")] // Temporarily commented out
        public async Task<ActionResult<ApiResponse<UserDTO>>> Register([FromBody] RegisterUserDTO model)
        {
            // Validation
            var validationErrors = ValidateRegistration(model);
            if (validationErrors.Any())
            {
                return BadRequest(ResponseUtil.Error<UserDTO>(
                    "Validation failed",
                    "VALIDATION_ERROR",
                    validationErrors
                ));
            }

            try
            {
                var (user, accessToken, refreshToken) = await _authService.RegisterUserAsync(model.Username, model.Email, model.Password, "User");
                var userDto = UserDTO.FromUser(user);
                
                // Generate anti-forgery token
                var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
                
                // Cookie options - secure in production, allow HTTP in development
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = !HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment(),
                    SameSite = SameSiteMode.Strict,
                    Path = "/"
                };
                
                // Set access token in HTTP-only cookie
                Response.Cookies.Append("accessToken", accessToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddMinutes(15),
                    Path = cookieOptions.Path
                });
                
                // Set refresh token in HTTP-only cookie
                Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddDays(7),
                    Path = "/api/auth/refresh" // Only send refresh token to refresh endpoint
                });
                
                // Anti-forgery token is automatically set in cookie by ASP.NET Core
                // Add CSRF token to response for initial setup
                userDto.CsrfToken = tokens.RequestToken;
                
                return Ok(ResponseUtil.Success(
                    userDto,
                    "User registered successfully"
                ));
            }
            catch (Exception ex) when (ex.Message.Contains("duplicate"))
            {
                return Conflict(ResponseUtil.Error<UserDTO>(
                    "Username or email already exists",
                    "DUPLICATE_ERROR",
                    statusCode: (int)HttpStatusCode.Conflict
                ));
            }
            catch (Exception ex)
            {
                return BadRequest(ResponseUtil.Error<UserDTO>(
                    "Registration failed",
                    "REGISTRATION_ERROR",
                    ex.Message
                ));
            }
        }

        [HttpPost("login")]
        public async Task<ActionResult<ApiResponse<LoginResponseDTO>>> Login([FromBody] LoginModel model)
        {
            if (string.IsNullOrEmpty(model?.Username) || string.IsNullOrEmpty(model?.Password))
            {
                return BadRequest(ResponseUtil.Error<LoginResponseDTO>(
                    "Username and password are required",
                    "VALIDATION_ERROR"
                ));
            }

            try
            {
                var (accessToken, refreshToken, user) = await _authService.LoginAsync(model.Username, model.Password);
                
                // Generate anti-forgery token
                var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
                
                // Cookie options - secure in production, allow HTTP in development
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = !HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment(),
                    SameSite = SameSiteMode.Strict,
                    Path = "/"
                };
                
                // Set access token in HTTP-only cookie
                Response.Cookies.Append("accessToken", accessToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddMinutes(15),
                    Path = cookieOptions.Path
                });
                
                // Set refresh token in HTTP-only cookie
                Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddDays(7),
                    Path = "/api/auth/refresh" // Only send refresh token to refresh endpoint
                });
                
                // Anti-forgery token is automatically set in cookie by ASP.NET Core
                var response = new LoginResponseDTO { 
                    CsrfToken = tokens.RequestToken,
                    User = UserDTO.FromUser(user)
                    // Don't return tokens in response body for security
                };
                
                return Ok(ResponseUtil.Success(response, "Login successful"));
            }
            catch (Exception)
            {
                return Unauthorized(ResponseUtil.Error<LoginResponseDTO>(
                    "Invalid username or password",
                    "INVALID_CREDENTIALS",
                    statusCode: (int)HttpStatusCode.Unauthorized
                ));
            }
        }

        [Authorize]
        [HttpGet("user")]
        public async Task<ActionResult<ApiResponse<UserDTO>>> GetUser()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            {
                return BadRequest(ResponseUtil.Error<UserDTO>(
                    "Invalid user identifier in token",
                    "INVALID_TOKEN"
                ));
            }

            var user = await _authService.GetUserByIdAsync(userId);
            if (user == null)
            {
                return NotFound(ResponseUtil.NotFound<UserDTO>("User not found"));
            }

            var userDto = UserDTO.FromUser(user);
            return Ok(ResponseUtil.Success(userDto, "User profile retrieved successfully"));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("users")]
        public async Task<ActionResult<ApiResponse<List<UserDTO>>>> GetAllUsers()
        {
            try
            {
                var users = await _authService.GetAllUsersAsync();
                var userDtos = users.Select(UserDTO.FromUser).ToList();
                return Ok(ResponseUtil.Success(userDtos, "Users retrieved successfully"));
            }
            catch (Exception ex)
            {
                return BadRequest(ResponseUtil.Error<List<UserDTO>>(
                    "Failed to retrieve users",
                    "RETRIEVAL_ERROR",
                    ex.Message
                ));
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("users/roles")]
        public async Task<ActionResult<ApiResponse<object>>> AddUserRole([FromBody] UserRoleUpdateModel model)
        {
            try
            {
                await _authService.AddUserRoleAsync(model.UserId, model.RoleName);
                return Ok(ResponseUtil.Success<object>(
                    new {}, // Empty object instead of null
                    $"Role '{model.RoleName}' added to user successfully"
                ));
            }
            catch (Exception ex)
            {
                return BadRequest(ResponseUtil.Error<object>(
                    "Failed to add role",
                    "ROLE_UPDATE_ERROR",
                    ex.Message
                ));
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("users/roles")]
        public async Task<ActionResult<ApiResponse<object>>> RemoveUserRole([FromBody] UserRoleUpdateModel model)
        {
            
            try
            {
                await _authService.RemoveUserRoleAsync(model.UserId, model.RoleName);
                return Ok(ResponseUtil.Success<object>(
                    new {}, // Empty object instead of null
                    $"Role '{model.RoleName}' removed from user successfully"
                ));
            }
            catch (Exception ex)
            {
                return BadRequest(ResponseUtil.Error<object>(
                    "Failed to remove role",
                    "ROLE_UPDATE_ERROR",
                    ex.Message
                ));
            }
        }

        private List<string> ValidateRegistration(RegisterUserDTO model)
        {
            var errors = new List<string>();

            if (string.IsNullOrEmpty(model.Username) || model.Username.Length < 2 || model.Username.Length > 20)
            {
                errors.Add("Username must be between 2 and 20 characters");
            }

            if (!System.Text.RegularExpressions.Regex.IsMatch(model.Username, @"^[a-zA-Z0-9_]+$"))
            {
                errors.Add("Username must contain only letters, numbers and underscore");
            }

            if (string.IsNullOrEmpty(model.Email) || !new EmailAddressAttribute().IsValid(model.Email))
            {
                errors.Add("A valid email address is required");
            }

            if (string.IsNullOrEmpty(model.Password) || model.Password.Length < 8)
            {
                errors.Add("Password must be at least 8 characters long");
            }
            
            // Check password complexity
            if (!string.IsNullOrEmpty(model.Password))
            {
                var passwordRegex = @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$";
                if (!System.Text.RegularExpressions.Regex.IsMatch(model.Password, passwordRegex))
                {
                    errors.Add("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
                }
            }

            return errors;
        }

        [Authorize]
        [HttpGet("verify")]
        public ActionResult<ApiResponse<object>> VerifyToken()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                return Unauthorized(ResponseUtil.Error<object>(
                    "Invalid token",
                    "INVALID_TOKEN",
                    statusCode: (int)HttpStatusCode.Unauthorized
                ));
            }

            // If we reach here, the token is valid
            return Ok(ResponseUtil.Success<object>(
                new {}, // Empty object instead of null
                "Token is valid"
            ));
        }

        [HttpPost("validate")]
        public async Task<ActionResult<ApiResponse<TokenValidationResponse>>> ValidateToken([FromBody] TokenValidationRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request?.Token))
                {
                    return BadRequest(ResponseUtil.Error<TokenValidationResponse>(
                        "Token is required",
                        "VALIDATION_ERROR"
                    ));
                }

                // Validate the token using the AuthService
                var principal = _authService.ValidateToken(request.Token);
                
                // Extract user information from claims
                var userId = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
                var username = principal.FindFirst(JwtRegisteredClaimNames.UniqueName)?.Value;
                var email = principal.FindFirst(JwtRegisteredClaimNames.Email)?.Value;
                var roles = principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

                var response = new TokenValidationResponse
                {
                    IsValid = true,
                    UserId = userId,
                    Username = username,
                    Email = email,
                    Roles = roles
                };

                return Ok(ResponseUtil.Success(response, "Token is valid"));
            }
            catch (Exception ex)
            {
                var response = new TokenValidationResponse
                {
                    IsValid = false,
                    Error = ex.Message
                };

                return Ok(ResponseUtil.Success(response, "Token validation completed"));
            }
        }

        [HttpPost("refresh-token")]
        public async Task<ActionResult<ApiResponse<string>>> RefreshToken()
        {
            try
            {
                // Get refresh token from cookie
                var refreshToken = Request.Cookies["refreshToken"];
                if (string.IsNullOrEmpty(refreshToken))
                {
                    return Unauthorized(ResponseUtil.Error<string>(
                        "No refresh token found",
                        "MISSING_REFRESH_TOKEN",
                        statusCode: (int)HttpStatusCode.Unauthorized
                    ));
                }

                // Refresh tokens using the new system
                var (newAccessToken, newRefreshToken) = await _authService.RefreshTokenAsync(refreshToken);
                
                // Generate new anti-forgery token
                var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
                
                // Cookie options - secure in production, allow HTTP in development
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = !HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment(),
                    SameSite = SameSiteMode.Strict,
                    Path = "/"
                };
                
                // Set new access token in HTTP-only cookie
                Response.Cookies.Append("accessToken", newAccessToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddMinutes(15),
                    Path = cookieOptions.Path
                });
                
                // Set new refresh token in HTTP-only cookie
                Response.Cookies.Append("refreshToken", newRefreshToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddDays(7),
                    Path = "/api/auth/refresh" // Only send refresh token to refresh endpoint
                });
                
                // Anti-forgery token is automatically set in cookie by ASP.NET Core
                
                // Return the CSRF token to the client
                return Ok(ResponseUtil.Success(tokens.RequestToken, "Token refreshed successfully"));
            }
            catch (Exception ex)
            {
                return Unauthorized(ResponseUtil.Error<string>(
                    ex.Message,
                    "REFRESH_ERROR",
                    statusCode: (int)HttpStatusCode.Unauthorized
                ));
            }
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<ActionResult<ApiResponse<object>>> Logout()
        {
            try
            {
                // Get refresh token from cookie to invalidate it
                var refreshToken = Request.Cookies["refreshToken"];
                
                // Call the LogoutAsync method with refresh token
                await _authService.LogoutAsync(refreshToken);
                
                // Cookie options for clearing - secure in production, allow HTTP in development
                var isDevelopment = HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment();
                
                // Clear all auth cookies
                Response.Cookies.Delete("accessToken", new CookieOptions 
                { 
                    Path = "/",
                    Secure = !isDevelopment,
                    SameSite = SameSiteMode.Strict
                });
                
                Response.Cookies.Delete("refreshToken", new CookieOptions 
                { 
                    Path = "/api/auth/refresh",
                    Secure = !isDevelopment,
                    SameSite = SameSiteMode.Strict
                });
                
                Response.Cookies.Delete("csrf-token", new CookieOptions 
                { 
                    Secure = !isDevelopment,
                    SameSite = SameSiteMode.Strict
                });
                
                return Ok(ResponseUtil.Success<object>(
                    new {}, // Empty object instead of null
                    "Logged out successfully"
                ));
            }
            catch (Exception ex)
            {
                return BadRequest(ResponseUtil.Error<object>(
                    ex.Message,
                    "LOGOUT_ERROR"
                ));
            }
        }
    }
    
    public class LoginResponseDTO
    {
        public string CsrfToken { get; set; } = string.Empty;
        public UserDTO User { get; set; } = new UserDTO();
    }

    public class TokenValidationRequest
    {
        public string Token { get; set; } = string.Empty;
    }

    public class TokenValidationResponse
    {
        public bool IsValid { get; set; }
        public string? UserId { get; set; }
        public string? Username { get; set; }
        public string? Email { get; set; }
        public List<string> Roles { get; set; } = new List<string>();
        public string? Error { get; set; }
    }
}