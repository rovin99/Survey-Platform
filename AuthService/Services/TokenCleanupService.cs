using AuthService.Repositories;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace AuthService.Services
{
    public class TokenCleanupService : BackgroundService
    {
        private readonly ILogger<TokenCleanupService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(1); // Run every hour

        public TokenCleanupService(ILogger<TokenCleanupService> logger, IServiceProvider serviceProvider)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Token cleanup service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupExpiredTokensAsync();
                    await Task.Delay(_cleanupInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    _logger.LogInformation("Token cleanup service is stopping");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while cleaning up expired tokens");
                    // Wait a shorter time before retrying on error
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
            }
        }

        private async Task CleanupExpiredTokensAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var refreshTokenRepository = scope.ServiceProvider.GetRequiredService<IRefreshTokenRepository>();

            try
            {
                _logger.LogInformation("Starting cleanup of expired refresh tokens");
                
                await refreshTokenRepository.DeleteExpiredTokensAsync();
                
                _logger.LogInformation("Expired refresh tokens cleanup completed successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to clean up expired refresh tokens");
                throw;
            }
        }

        public override async Task StopAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Token cleanup service is stopping");
            await base.StopAsync(stoppingToken);
        }
    }
} 