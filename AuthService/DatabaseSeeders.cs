using Microsoft.EntityFrameworkCore;
using AuthService.Models;
public static class DatabaseSeeder
{
    public static async Task SeedRolesAndUsers(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (!await context.Roles.AnyAsync())
        {
            var adminRole = new Role { RoleName = "Admin" };
            var userRole = new Role { RoleName = "User" };
            var participatingRole = new Role { RoleName = "Participating" };
            var conductingRole = new Role { RoleName = "Conducting" };

            await context.Roles.AddRangeAsync(adminRole, userRole, participatingRole, conductingRole);
            await context.SaveChangesAsync();

            // Create an admin user
            var adminUser = new User
            {
                Username = "admin",
                Email = "admin@example.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await context.Users.AddAsync(adminUser);
            await context.SaveChangesAsync();

            // Assign admin role to the admin user
            await context.UserRoles.AddAsync(new UserRole { UserId = adminUser.UserId, RoleId = adminRole.RoleId });
            await context.SaveChangesAsync();
        }
    }
}