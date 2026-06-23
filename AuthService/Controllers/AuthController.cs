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
using AuthService.Repositories;

namespace AuthService.Controllers 
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase 
    {
        private readonly IAuthService _authService;
        private readonly IAntiforgery _antiforgery;
        private readonly ILogger<AuthController> _logger;
        private readonly IUserRepository _userRepository;

        public AuthController(IAuthService authService, IAntiforgery antiforgery, ILogger<AuthController> logger, IUserRepository userRepository)
        {
            _authService = authService;
            _antiforgery = antiforgery;
            _logger = logger;
            _userRepository = userRepository;
        }

        
        [HttpPost("register")]
        [EnableRateLimiting("AuthPolicy")]
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
                
                // For local HTTP: Use SameSite=Lax (works with HTTP, allows cross-subdomain)
                // For production HTTPS: Use SameSite=None + Secure=true (most restrictive but works everywhere)
                var isDevelopment = HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment();
                
                // Cookie options - SameSite=Lax for dev (HTTP), SameSite=None for prod (HTTPS)
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = !isDevelopment,  // false for dev, true for production
                    SameSite = SameSiteMode.Lax,  // Lax is secure and works for same-origin and subdomains
                    Path = "/"
                };
                
                // Set access token in HTTP-only cookie
                Response.Cookies.Append("accessToken", accessToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddMinutes(60),
                    Path = cookieOptions.Path
                });
                
                // Set refresh token in HTTP-only cookie
                Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddDays(7),
                    Path = "/api/auth" // Send refresh token to all auth endpoints
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
        [EnableRateLimiting("AuthPolicy")]
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
                
                // For local HTTP: Use SameSite=Lax (works with HTTP, allows cross-subdomain)
                // For production HTTPS: Use SameSite=None + Secure=true (most restrictive but works everywhere)
                var isDevelopment = HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment();
                
                // Cookie options - SameSite=Lax for dev (HTTP), SameSite=None for prod (HTTPS)
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = !isDevelopment,  // false for dev, true for production
                    SameSite = SameSiteMode.Lax,  // Lax is secure and works for same-origin and subdomains
                    Path = "/"
                };
                
                // Set access token in HTTP-only cookie
                Response.Cookies.Append("accessToken", accessToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddMinutes(60),
                    Path = cookieOptions.Path
                });
                
                // Set refresh token in HTTP-only cookie
                Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddDays(7),
                    Path = "/api/auth" // Send refresh token to all auth endpoints
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
        public async Task<ActionResult<ApiResponse<object>>> VerifyToken()
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

            try
            {
                // Get user ID from claims
                if (!int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(ResponseUtil.Error<object>(
                        "Invalid user ID in token",
                        "INVALID_USER_ID",
                        statusCode: (int)HttpStatusCode.Unauthorized
                    ));
                }

                // Get user data from database
                var user = await _userRepository.GetByIdAsync(userId);
                if (user == null)
                {
                    return Unauthorized(ResponseUtil.Error<object>(
                        "User not found",
                        "USER_NOT_FOUND",
                        statusCode: (int)HttpStatusCode.Unauthorized
                    ));
                }

                // Create user response object
                var userResponse = new
                {
                    user = new
                    {
                        userId = user.UserId,
                        username = user.Username,
                        email = user.Email,
                        roles = user.UserRoles?.Select(ur => ur.Role.RoleName).ToArray() ?? new string[0]
                    }
                };

                return Ok(ResponseUtil.Success<object>(
                    userResponse,
                    "Token is valid"
                ));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying token for user ID: {UserId}", userIdClaim.Value);
                return StatusCode(500, ResponseUtil.Error<object>(
                    "Internal server error",
                    "INTERNAL_ERROR",
                    statusCode: 500
                ));
            }
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
                
                // For local HTTP: Use SameSite=Lax (works with HTTP, allows cross-subdomain)
                // For production HTTPS: Use SameSite=None + Secure=true (most restrictive but works everywhere)
                var isDevelopment = HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment();
                
                // Cookie options - SameSite=Lax for dev (HTTP), SameSite=None for prod (HTTPS)
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = !isDevelopment,  // false for dev, true for production
                    SameSite = SameSiteMode.Lax,  // Lax is secure and works for same-origin and subdomains
                    Path = "/"
                };
                
                // Set new access token in HTTP-only cookie
                Response.Cookies.Append("accessToken", newAccessToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddMinutes(60),
                    Path = cookieOptions.Path
                });
                
                // Set new refresh token in HTTP-only cookie
                Response.Cookies.Append("refreshToken", newRefreshToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddDays(7),
                    Path = "/api/auth" // Send refresh token to all auth endpoints
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
        [HttpPost("change-password")]
        public async Task<ActionResult<ApiResponse<object>>> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            {
                return Unauthorized(ResponseUtil.Error<object>(
                    "Invalid token", "INVALID_TOKEN", statusCode: (int)HttpStatusCode.Unauthorized));
            }

            if (request == null || string.IsNullOrEmpty(request.NewPassword))
            {
                return BadRequest(ResponseUtil.Error<object>("New password is required", "VALIDATION_ERROR"));
            }

            try
            {
                await _authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword);
                return Ok(ResponseUtil.Success<object>(new {}, "Password changed successfully"));
            }
            catch (Exception ex)
            {
                return BadRequest(ResponseUtil.Error<object>(ex.Message, "CHANGE_PASSWORD_ERROR"));
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
                
                // Cookie delete options must match how they were set
                var isDevelopment = HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment();
                
                // Clear all auth cookies (SameSite must match how they were set)
                Response.Cookies.Delete("accessToken", new CookieOptions 
                { 
                    Path = "/",
                    Secure = !isDevelopment,
                    SameSite = SameSiteMode.Lax
                });
                
                Response.Cookies.Delete("refreshToken", new CookieOptions 
                { 
                    Path = "/api/auth",
                    Secure = !isDevelopment,
                    SameSite = SameSiteMode.Lax
                });
                
                Response.Cookies.Delete("csrf-token", new CookieOptions 
                { 
                    Secure = !isDevelopment,
                    SameSite = SameSiteMode.Lax
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

        [HttpPost("request-magic-link")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<ActionResult<ApiResponse<string>>> RequestMagicLink([FromBody] MagicLinkRequest request)
        {
            if (string.IsNullOrEmpty(request?.Email))
            {
                return BadRequest(ResponseUtil.Error<string>(
                    "Email address is required",
                    "VALIDATION_ERROR"
                ));
            }

            try
            {
                var message = await _authService.RequestMagicLinkAsync(request.Email, request.ReturnUrl);
                return Ok(ResponseUtil.Success(message, "Magic link request processed"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process magic link request for {Email}", request.Email);
                return BadRequest(ResponseUtil.Error<string>(
                    "Failed to process magic link request",
                    "MAGIC_LINK_ERROR",
                    ex.Message
                ));
            }
        }

        [HttpGet("verify-magic-link")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<ActionResult> VerifyMagicLink([FromQuery] string token, [FromQuery] string? returnUrl)
        {
            if (string.IsNullOrEmpty(token))
            {
                return Redirect($"{GetFrontendUrl()}/login?error=missing_token");
            }

            try
            {
                var (accessToken, refreshToken, user) = await _authService.VerifyMagicLinkAsync(token);
                
                // Generate anti-forgery token
                var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
                
                // For local HTTP: Use SameSite=Lax (works with HTTP, allows cross-subdomain)
                // For production HTTPS: Use SameSite=None + Secure=true (most restrictive but works everywhere)
                var isDevelopment = HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment();
                
                // Cookie options - SameSite=Lax for dev (HTTP), SameSite=None for prod (HTTPS)
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = !isDevelopment,  // false for dev, true for production
                    SameSite = SameSiteMode.Lax,  // Lax is secure and works for same-origin and subdomains
                    Path = "/"
                };
                
                // Set access token in HTTP-only cookie
                Response.Cookies.Append("accessToken", accessToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddMinutes(60),
                    Path = cookieOptions.Path
                });
                
                // Set refresh token in HTTP-only cookie
                Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddDays(7),
                    Path = "/api/auth" // Send refresh token to all auth endpoints
                });
                
                // Redirect to magic link verification page with success status
                // This allows the frontend to handle the authentication state properly
                var redirectUrl = $"{GetFrontendUrl()}/magic-link?status=success&userId={user.UserId}";

                // Only include returnUrl if it's a safe relative path (prevents open redirect)
                if (IsValidReturnUrl(returnUrl))
                {
                    redirectUrl += $"&returnUrl={Uri.EscapeDataString(returnUrl!)}";
                }
                return Redirect(redirectUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to verify magic link token: {Token}", token);
                return Redirect($"{GetFrontendUrl()}/login?error=invalid_token");
            }
        }

        [HttpPost("verify-magic-link")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<ActionResult<ApiResponse<LoginResponseDTO>>> VerifyMagicLinkPost([FromBody] TokenValidationRequest request)
        {
            if (string.IsNullOrEmpty(request?.Token))
            {
                return BadRequest(ResponseUtil.Error<LoginResponseDTO>(
                    "Token is required",
                    "VALIDATION_ERROR"
                ));
            }

            try
            {
                var (accessToken, refreshToken, user) = await _authService.VerifyMagicLinkAsync(request.Token);
                
                // Generate anti-forgery token
                var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
                
                // For local HTTP: Use SameSite=Lax (works with HTTP, allows cross-subdomain)
                // For production HTTPS: Use SameSite=None + Secure=true (most restrictive but works everywhere)
                var isDevelopment = HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment();
                
                // Cookie options - SameSite=Lax for dev (HTTP), SameSite=None for prod (HTTPS)
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    Secure = !isDevelopment,  // false for dev, true for production
                    SameSite = SameSiteMode.Lax,  // Lax is secure and works for same-origin and subdomains
                    Path = "/"
                };
                
                // Set access token in HTTP-only cookie
                Response.Cookies.Append("accessToken", accessToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddMinutes(60),
                    Path = cookieOptions.Path
                });
                
                // Set refresh token in HTTP-only cookie
                Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = cookieOptions.HttpOnly,
                    Secure = cookieOptions.Secure,
                    SameSite = cookieOptions.SameSite,
                    Expires = DateTime.UtcNow.AddDays(7),
                    Path = "/api/auth" // Send refresh token to all auth endpoints
                });

                var userDTO = new UserDTO
                {
                    UserId = user.UserId,
                    Username = user.Username,
                    Email = user.Email,
                    Roles = user.UserRoles?.Select(ur => ur.Role.RoleName).ToList() ?? new List<string>()
                };

                var responseData = new LoginResponseDTO
                {
                    CsrfToken = tokens.RequestToken ?? string.Empty,
                    User = userDTO
                };
                
                return Ok(ResponseUtil.Success(responseData, "Magic link verification successful"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to verify magic link token: {Token}", request.Token);
                return BadRequest(ResponseUtil.Error<LoginResponseDTO>(
                    "Invalid or expired magic link",
                    "MAGIC_LINK_ERROR",
                    ex.Message
                ));
            }
        }

        private string GetFrontendUrl()
        {
            // Check for FRONTEND_URL environment variable first (for cluster deployments)
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL");
            if (!string.IsNullOrEmpty(frontendUrl))
            {
                return frontendUrl;
            }

            // Fallback: Development vs Production
            return HttpContext.RequestServices.GetService<IWebHostEnvironment>()!.IsDevelopment()
                ? "http://localhost:3000"
                : Environment.GetEnvironmentVariable("PRODUCTION_URL") ?? "http://localhost:3000";
        }

        // Validate returnUrl to prevent open redirect attacks
        private bool IsValidReturnUrl(string? returnUrl)
        {
            if (string.IsNullOrEmpty(returnUrl))
                return false;

            // Must start with / (relative path)
            if (!returnUrl.StartsWith("/"))
                return false;

            // Must not have protocol (//example.com is a protocol-relative URL)
            if (returnUrl.StartsWith("//"))
                return false;

            // Must not contain backslashes (potential bypass)
            if (returnUrl.Contains("\\"))
                return false;

            return true;
        }
    }
    
    public class MagicLinkRequest
    {
        public string Email { get; set; } = string.Empty;
        public string? ReturnUrl { get; set; }
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
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