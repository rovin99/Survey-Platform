using Microsoft.Extensions.Logging;

namespace AuthService.Services
{
    /// <summary>
    /// A simple console-based email service for development/testing
    /// In production, replace with actual email service
    /// </summary>
    public class ConsoleEmailService : IEmailService
    {
        private readonly ILogger<ConsoleEmailService> _logger;

        public ConsoleEmailService(ILogger<ConsoleEmailService> logger)
        {
            _logger = logger;
        }

        public async Task SendMagicLinkAsync(string email, string magicLink, string? username = null)
        {
            _logger.LogInformation("=== MAGIC LINK EMAIL ===");
            _logger.LogInformation("To: {Email}", email);
            _logger.LogInformation("Subject: Sign in to Survey Platform");
            _logger.LogInformation("Hello {Username}!", username ?? "there");
            _logger.LogInformation("");
            _logger.LogInformation("Click the link below to sign in to Survey Platform:");
            _logger.LogInformation("🔗 {MagicLink}", magicLink);
            _logger.LogInformation("");
            _logger.LogInformation("This link will expire in 15 minutes for security reasons.");
            _logger.LogInformation("If you didn't request this, please ignore this email.");
            _logger.LogInformation("========================");

            await Task.CompletedTask;
        }

        public async Task<bool> IsEmailServiceConfiguredAsync()
        {
            // Console service is always "available"
            return await Task.FromResult(true);
        }
    }
}