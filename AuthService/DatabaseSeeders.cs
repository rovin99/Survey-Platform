using System;
using Microsoft.EntityFrameworkCore;
using AuthService.Models;
using Microsoft.Extensions.DependencyInjection;

public static class DatabaseSeeder
{
    public static async Task SeedRolesAndUsers(IServiceProvider serviceProvider)
    {
        try
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Test if database is accessible
            bool canConnect = await context.Database.CanConnectAsync();
            if (!canConnect)
            {
                Console.WriteLine("Cannot connect to the database. Skipping seeding.");
                return;
            }

            Console.WriteLine("Database connection successful. Checking if seeding is needed...");

            if (!await context.Roles.AnyAsync())
            {
                Console.WriteLine("Seeding roles and admin user...");
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
                
                Console.WriteLine($"Admin user created with password: {adminPassword}");
                    
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
                
                Console.WriteLine("Database seeding completed successfully.");
            }
            else
            {
                Console.WriteLine("Database already seeded. Skipping.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error during database seeding: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            
            if (ex.InnerException != null)
            {
                Console.WriteLine($"Inner exception: {ex.InnerException.Message}");
            }
        }
    }
}