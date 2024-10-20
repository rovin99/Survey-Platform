using Microsoft.EntityFrameworkCore;
using AuthService.Models;
public static class DatabaseSeeder
{
    public static async Task SeedRoles(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (!await context.Roles.AnyAsync())
        {
            await context.Roles.AddRangeAsync(
                new Role { RoleName = "Admin" },
                new Role { RoleName = "User" }
            );

            await context.SaveChangesAsync();
        }
    }
}