// EmailServiceExtensions.cs
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AuthService.Services
{
    public static class EmailServiceExtensions
    {
        public static IServiceCollection AddEmailService(this IServiceCollection services, IConfiguration configuration)
        {
            var emailSettings = configuration.GetSection("EmailService");
            var useExternalService = emailSettings.GetValue<bool>("UseExternalService");
            
            Console.WriteLine($"EmailService Configuration: UseExternalService = {useExternalService}");
            Console.WriteLine($"BaseUrl = {emailSettings.GetValue<string>("BaseUrl")}");
            
            if (useExternalService)
            {
                Console.WriteLine("Using external email service (Survey Management Service)");
                // Configure EmailServiceSettings from the configuration
                services.Configure<EmailServiceSettings>(emailSettings);
                
                // Register HttpClient and EmailService implementation for external service
                services.AddHttpClient<IEmailService, EmailService>();
            }
            else
            {
                Console.WriteLine("Using console email service for development");
                // Use console email service for development
                services.AddScoped<IEmailService, ConsoleEmailService>();
            }
            
            return services;
        }
    }
}