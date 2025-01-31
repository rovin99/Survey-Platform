// EmailServiceExtensions.cs
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AuthService.Services
{
    public static class EmailServiceExtensions
    {
        public static IServiceCollection AddEmailService(this IServiceCollection services, IConfiguration configuration)
        {
            // Configure EmailServiceSettings from the configuration
            services.Configure<EmailServiceSettings>(configuration.GetSection("EmailService"));
            
            // Register HttpClient and EmailService implementation
            services.AddHttpClient<IEmailService, EmailService>();
            
            return services;
        }
    }
}