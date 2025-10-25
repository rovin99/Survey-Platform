using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using AuthService.Models;

namespace AuthService.HealthChecks
{
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly AppDbContext _context;

        public DatabaseHealthCheck(AppDbContext context)
        {
            _context = context;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Simple database connectivity check
                await _context.Database.CanConnectAsync(cancellationToken);
                return HealthCheckResult.Healthy("Database is accessible");
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("Database is not accessible", ex);
            }
        }
    }

    public static class HealthCheckExtensions
    {
        public static IServiceCollection AddCustomHealthChecks(this IServiceCollection services)
        {
            services.AddHealthChecks()
                .AddCheck<DatabaseHealthCheck>("database")
                .AddCheck("self", () => HealthCheckResult.Healthy("Application is running"));

            return services;
        }

        public static IEndpointRouteBuilder MapCustomHealthChecks(this IEndpointRouteBuilder endpoints)
        {
            // Liveness probe - basic application health
            endpoints.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
            {
                Predicate = check => check.Name == "self"
            });

            // Readiness probe - application + dependencies
            endpoints.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
            {
                Predicate = check => check.Name == "database"
            });

            // Startup probe - comprehensive check
            endpoints.MapHealthChecks("/health/startup", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
            {
                Predicate = _ => true
            });

            return endpoints;
        }
    }
} 