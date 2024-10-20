
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AuthService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authorization;

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
    public async Task<IActionResult> Register(RegisterModel model)
    {
        try
        {
            var user = await _authService.RegisterUserAsync(model.Username, model.Email, model.Password, "User");
            return Ok("User registered successfully.");
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginModel model)
    {   if (model == null)
    {
        return BadRequest("Invalid login data");
    }
        try
        {
            var token = await _authService.LoginAsync(model.Username,model.Password);
            return Ok(new { Token = token });
        }
        catch (Exception ex)
        {
            return Unauthorized(ex.Message);
        }
    }

    [Authorize]
    [HttpGet("user")]
    public async Task<IActionResult> GetUser()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        var user = await _authService.GetUserByIdAsync(userId);
        return Ok(user);
    }
}
}