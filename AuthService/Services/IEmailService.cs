using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;

namespace AuthService.Services
{
    public interface IEmailService
    {
        Task SendVerificationEmailAsync(string email);
        Task SendMagicLinkAsync(string email, string magicLink, string? username = null);
        Task<bool> IsEmailServiceConfiguredAsync();
    }

    public class EmailServiceSettings
    {
        public string BaseUrl { get; set; }
        public int TimeoutSeconds { get; set; } = 30;
    }

    public class EmailService : IEmailService
    {
        private readonly HttpClient _httpClient;
        private readonly EmailServiceSettings _settings;
        private readonly ILogger<EmailService> _logger;

        public EmailService(
            HttpClient httpClient,
            IOptions<EmailServiceSettings> settings,
            ILogger<EmailService> logger)
        {
            _httpClient = httpClient;
            _settings = settings.Value;
            _logger = logger;
            
            _httpClient.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);
        }

        public async Task SendVerificationEmailAsync(string email)
        {
            try
            {
                // Generate a 6-digit verification code
                var verificationCode = GenerateVerificationCode();

                var request = new
                {
                    email = email,
                    code = verificationCode
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(request),
                    Encoding.UTF8,
                    "application/json"
                );

                var requestUrl = $"{_settings.BaseUrl}/email/verify";
                var response = await _httpClient.PostAsync(requestUrl, content);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to send verification email. Status: {StatusCode}, Error: {Error}", 
                        response.StatusCode, errorContent);
                    
                    throw new Exception($"Failed to send verification email: {response.StatusCode}");
                }

                _logger.LogInformation("Successfully sent verification email to {Email}", email);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP request failed while sending verification email to {Email}", email);
                throw new Exception("Failed to connect to email service", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while sending verification email to {Email}", email);
                throw;
            }
        }

        public async Task SendMagicLinkAsync(string email, string magicLink, string? username = null)
        {
            try
            {
                var request = new
                {
                    email = email,
                    magicLink = magicLink,
                    username = username ?? "there"
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(request),
                    Encoding.UTF8,
                    "application/json"
                );

                var requestUrl = $"{_settings.BaseUrl}/email/magic-link";
                _logger.LogInformation("Sending magic link request to: {RequestUrl}", requestUrl);
                _logger.LogInformation("Request body: {RequestBody}", JsonSerializer.Serialize(request));
                
                var response = await _httpClient.PostAsync(requestUrl, content);
                
                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Response Status: {StatusCode}, Content: {Content}", response.StatusCode, responseContent);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Failed to send magic link email. Status: {StatusCode}, Error: {Error}", 
                        response.StatusCode, responseContent);
                    
                    throw new Exception($"Failed to send magic link email: {response.StatusCode}");
                }

                _logger.LogInformation("Successfully sent magic link email to {Email}", email);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP request failed while sending magic link email to {Email}", email);
                throw new Exception("Failed to connect to email service", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while sending magic link email to {Email}", email);
                throw;
            }
        }

        public async Task<bool> IsEmailServiceConfiguredAsync()
        {
            try
            {
                var requestUrl = $"{_settings.BaseUrl}/email/health";
                var response = await _httpClient.GetAsync(requestUrl);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        private string GenerateVerificationCode()
        {
            Random random = new Random();
            return random.Next(100000, 999999).ToString();
        }
    }
    

}