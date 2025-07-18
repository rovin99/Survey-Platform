using System;
using Microsoft.EntityFrameworkCore;
using AuthService.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

public static class DatabaseSeeder
{
    public static async Task SeedRolesAndUsers(IServiceProvider serviceProvider)
    {
        try
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
            var logger = loggerFactory.CreateLogger(typeof(DatabaseSeeder));

            // Test if database is accessible
            bool canConnect = await context.Database.CanConnectAsync();
            if (!canConnect)
            {
                logger.LogWarning("Cannot connect to the database. Skipping seeding.");
                return;
            }

            logger.LogInformation("Database connection successful. Checking if seeding is needed...");

            if (!await context.Roles.AnyAsync())
            {
                logger.LogInformation("Seeding roles and admin user...");
                var adminRole = new Role { RoleName = "Admin" };
                var userRole = new Role { RoleName = "User" };
                var participatingRole = new Role { RoleName = "Participating" };
                var conductingRole = new Role { RoleName = "Conducting" };

                await context.Roles.AddRangeAsync(adminRole, userRole, participatingRole, conductingRole);
                await context.SaveChangesAsync();

                // Determine if we're in production by checking for Railway environment
                bool isProduction = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("RAILWAY_PRIVATE_DOMAIN"));
                
                // Use a more secure password for production
                string adminPassword = isProduction 
                    ? "Adm!n@Railway#" + Guid.NewGuid().ToString()[..8] // Generate a partially random secure password
                    : "admin123";  // Simple password for development
                
                // SECURITY: Never log passwords in production
                if (!isProduction)
                {
                    logger.LogInformation("Development admin user created with password: {AdminPassword}", adminPassword);
                }
                else
                {
                    logger.LogInformation("Production admin user created with secure password");
                }
                    
                // Create an admin user
                var adminUser = new User
                {
                    Username = "admin",
                    Email = "admin@example.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await context.Users.AddAsync(adminUser);
                await context.SaveChangesAsync();

                // Assign admin role to the admin user
                await context.UserRoles.AddAsync(new UserRole { UserId = adminUser.UserId, RoleId = adminRole.RoleId });
                await context.SaveChangesAsync();
                
                logger.LogInformation("Database seeding completed successfully.");
            }
            else
            {
                logger.LogInformation("Database already seeded. Skipping.");
            }
        }
        catch (Exception ex)
        {
            // Use proper logging instead of console output to avoid information disclosure
            using var scope = serviceProvider.CreateScope();
            var loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
            var logger = loggerFactory.CreateLogger(typeof(DatabaseSeeder));
            
            // Log the full exception details for debugging (this goes to structured logging)
            logger.LogError(ex, "Error occurred during database seeding");
            
            // Only log basic error message to console for operational awareness
            Console.WriteLine("Database seeding failed. Check logs for details.");
            
            // Re-throw to ensure the application doesn't start with an inconsistent state
            throw;
        }
    }
}