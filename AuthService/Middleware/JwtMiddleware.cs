using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using System.Text;
using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;


public class JwtMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<JwtMiddleware> _logger;

    public JwtMiddleware(RequestDelegate next, IConfiguration configuration, ILogger<JwtMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task Invoke(HttpContext context)
    {
        var token = context.Request.Headers["Authorization"].FirstOrDefault()?.Split(" ").Last();

        if (token != null)
            AttachUserToContext(context, token);

        await _next(context);
    }

    private void AttachUserToContext(HttpContext context, string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Key"]);
            var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidIssuer = _configuration["Jwt:Issuer"],
                ValidAudience = _configuration["Jwt:Audience"],
                ClockSkew = TimeSpan.Zero
            }, out SecurityToken validatedToken);

            var jwtToken = (JwtSecurityToken)validatedToken;
            var userIdClaim = jwtToken.Claims.FirstOrDefault(x => x.Type == ClaimTypes.NameIdentifier);
            
            if (userIdClaim == null)
            {
                _logger.LogWarning("JWT token validation failed: Missing user ID claim. IP: {RemoteIpAddress}", 
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
                return;
            }

            if (!int.TryParse(userIdClaim.Value, out int userId))
            {
                _logger.LogWarning("JWT token validation failed: Invalid user ID format. IP: {RemoteIpAddress}", 
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
                return;
            }

            context.User = principal;
            context.Items["UserId"] = userId;
            
            _logger.LogDebug("JWT token successfully validated for user {UserId}", userId);
        }
        catch (SecurityTokenExpiredException)
        {
            _logger.LogInformation("JWT token validation failed: Token expired. IP: {RemoteIpAddress}", 
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        }
        catch (SecurityTokenInvalidSignatureException)
        {
            _logger.LogWarning("JWT token validation failed: Invalid signature. Potential security threat. IP: {RemoteIpAddress}", 
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        }
        catch (SecurityTokenValidationException ex)
        {
            _logger.LogWarning("JWT token validation failed: {ErrorMessage}. IP: {RemoteIpAddress}", 
                ex.Message, context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during JWT token validation. IP: {RemoteIpAddress}", 
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        }
    }
}