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

namespace AuthService.Controllers 
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase 
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        
        [HttpPost("register")]
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
            var (user, accessToken) = await _authService.RegisterUserAsync(model.Username, model.Email, model.Password, "User");
            var userDto = UserDTO.FromUser(user);
            userDto.Token = accessToken; // Assuming UserDTO has a Token property
            
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
            var (accessToken, user) = await _authService.LoginAsync(model.Username, model.Password);
            
            // Set access token in HTTP-only cookie
            Response.Cookies.Append("accessToken", accessToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.None,
                Expires = DateTime.Now.AddMinutes(15),
                Path = "/"
            });
            
            var response = new LoginResponseDTO { Token = accessToken };
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

        // [Authorize(Roles = "Admin")]
        [HttpPost("users/roles")]
        public async Task<ActionResult<ApiResponse<object>>> AddUserRole([FromBody] UserRoleUpdateModel model)
        {
            try
            {
                await _authService.AddUserRoleAsync(model.UserId, model.RoleName);
                return Ok(ResponseUtil.Success<object>(
                    null,
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

        // [Authorize(Roles = "Admin")]
        [HttpDelete("users/roles")]
        public async Task<ActionResult<ApiResponse<object>>> RemoveUserRole([FromBody] UserRoleUpdateModel model)
        {
            
            try
            {
                await _authService.RemoveUserRoleAsync(model.UserId, model.RoleName);
                return Ok(ResponseUtil.Success<object>(
                    null,
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

            if (string.IsNullOrEmpty(model.Password) || model.Password.Length < 6)
            {
                errors.Add("Password must be at least 6 characters long");
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
        null,
        "Token is valid"
    ));
}

       
        [HttpPost("refresh-token")]
public async Task<ActionResult<ApiResponse<string>>> RefreshToken()
{
    try
    {
        var newAccessToken = await _authService.RefreshTokenAsync();
        
        // Set the new access token in an HTTP-only cookie
        Response.Cookies.Append("accessToken", newAccessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTime.Now.AddMinutes(15),
            Path = "/"
        });
        
        return Ok(ResponseUtil.Success(
            new { token = newAccessToken },
            "Token refreshed successfully"
        ));
    }
    catch (Exception ex)
    {
        return Unauthorized(ResponseUtil.Error<string>(
            ex.Message,
            "REFRESH_TOKEN_ERROR",
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
                await _authService.LogoutAsync();
                
                // Clear the access token cookie
                Response.Cookies.Delete("accessToken", new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Path = "/"
                });
                
                // Clear the refresh token cookie
                Response.Cookies.Delete("refreshToken", new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Path = "/"
                });
                
                return Ok(ResponseUtil.Success<object>(
                    null,
                    "Logged out successfully"
                ));
            }
            catch (Exception ex)
            {
                return BadRequest(ResponseUtil.Error<object>(
                    "Logout failed",
                    "LOGOUT_ERROR",
                    ex.Message
                ));
            }
        }
        
    }

    public class LoginResponseDTO
    {
        public string Token { get; set; }
    }
}