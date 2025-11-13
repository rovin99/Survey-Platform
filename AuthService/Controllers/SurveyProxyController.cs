using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using AuthService.Utils;
using System.Text.Json;
using System.Text;
using System.Security.Claims;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SurveyProxyController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<SurveyProxyController> _logger;

        public SurveyProxyController(
            IHttpClientFactory httpClientFactory, 
            IConfiguration configuration,
            ILogger<SurveyProxyController> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        private async Task<string> GenerateBearerToken()
        {
            // Get current user info from token
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("unique_name")?.Value;
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

            // Create a new JWT token for service-to-service communication
            var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Key"]);

            var claims = new List<Claim>
            {
                new Claim("sub", userId ?? ""),
                new Claim("unique_name", username ?? ""),
                new Claim("email", email ?? ""),
                new Claim("jti", Guid.NewGuid().ToString()),
                new Claim("iat", new DateTimeOffset(DateTime.UtcNow).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            };

            _logger.LogInformation("Generating token for user {UserId} with roles: {Roles}", 
                userId, string.Join(", ", roles));

            foreach (var role in roles)
            {
                claims.Add(new Claim("role", role));
            }

            var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(15), // Short-lived token for service calls
                SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                    new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key), 
                    Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"]
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        [HttpPost("drafts")]
        public async Task<IActionResult> CreateDraft([FromBody] object draftData)
        {
            return await ProxyRequest("POST", "api/v1/drafts", draftData);
        }

        [HttpPut("drafts/{id}")]
        public async Task<IActionResult> UpdateDraft(string id, [FromBody] object draftData)
        {
            return await ProxyRequest("PUT", $"api/v1/drafts/{id}", draftData);
        }

        [HttpGet("drafts/{id}")]
        public async Task<IActionResult> GetDraft(string id)
        {
            return await ProxyRequest("GET", $"api/v1/drafts/{id}", null);
        }

        [HttpHead("drafts/{id}")]
        public async Task<IActionResult> CheckDraft(string id)
        {
            return await ProxyRequest("HEAD", $"api/v1/drafts/{id}", null);
        }

        [HttpDelete("drafts/{id}")]
        public async Task<IActionResult> DeleteDraft(string id)
        {
            return await ProxyRequest("DELETE", $"api/v1/drafts/{id}", null);
        }

        [HttpPost("drafts/{id}/publish")]
        public async Task<IActionResult> PublishDraft(string id, [FromBody] object publishData)
        {
            return await ProxyRequest("POST", $"api/v1/drafts/{id}/publish", publishData);
        }

        [HttpGet("surveys/conductor/{conductorId}")]
        public async Task<IActionResult> GetSurveysByConductor(int conductorId)
        {
            return await ProxyRequest("GET", $"api/v1/surveys/conductor/{conductorId}", null);
        }

        [HttpGet("surveys/{id}")]
        public async Task<IActionResult> GetSurvey(int id)
        {
            return await ProxyRequest("GET", $"api/v1/surveys/{id}", null);
        }

        private async Task<IActionResult> ProxyRequest(string method, string endpoint, object? data)
        {
            try
            {
                var surveyServiceUrl = _configuration["SurveyService:BaseUrl"] ?? "http://localhost:3001";
                var client = _httpClientFactory.CreateClient();
                
                var bearerToken = await GenerateBearerToken();
                client.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", bearerToken);

                var url = $"{surveyServiceUrl}/{endpoint}";
                
                _logger.LogInformation("Proxying {Method} request to {Url}", method, url);

                HttpResponseMessage response;
                
                switch (method.ToUpper())
                {
                    case "GET":
                        response = await client.GetAsync(url);
                        break;
                    case "POST":
                        var postContent = data != null 
                            ? new StringContent(JsonSerializer.Serialize(data), Encoding.UTF8, "application/json")
                            : null;
                        response = await client.PostAsync(url, postContent);
                        break;
                    case "PUT":
                        var putContent = data != null 
                            ? new StringContent(JsonSerializer.Serialize(data), Encoding.UTF8, "application/json")
                            : null;
                        response = await client.PutAsync(url, putContent);
                        break;
                    case "DELETE":
                        response = await client.DeleteAsync(url);
                        break;
                    case "HEAD":
                        var headRequest = new HttpRequestMessage(HttpMethod.Head, url);
                        response = await client.SendAsync(headRequest);
                        break;
                    default:
                        return BadRequest(ResponseUtil.Error<object>("Unsupported HTTP method", "UNSUPPORTED_METHOD"));
                }

                var responseContent = await response.Content.ReadAsStringAsync();
                
                // For HEAD requests, return the status code
                if (method.ToUpper() == "HEAD")
                {
                    return StatusCode((int)response.StatusCode);
                }

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Survey service returned error: {StatusCode} {Content}", 
                        response.StatusCode, responseContent);
                    return StatusCode((int)response.StatusCode, responseContent);
                }

                // Try to parse as JSON, if it fails return as string
                try
                {
                    var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                    return Ok(jsonResponse);
                }
                catch
                {
                    return Ok(responseContent);
                }
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Error communicating with survey service");
                return StatusCode(503, ResponseUtil.Error<object>(
                    "Survey service unavailable", 
                    "SERVICE_UNAVAILABLE", 
                    ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in survey proxy");
                return StatusCode(500, ResponseUtil.Error<object>(
                    "Internal server error", 
                    "INTERNAL_ERROR", 
                    ex.Message));
            }
        }
    }
}