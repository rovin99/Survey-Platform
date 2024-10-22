using AuthService.Models;
using Microsoft.EntityFrameworkCore;

public interface IUserRepository
{
    Task<User> GetByIdAsync(int id);
    Task<User> GetByUsernameAsync(string username);
    Task<User> GetByEmailAsync(string email);
    Task CreateAsync(User user);
    Task UpdateAsync(User user);
    Task AddUserRoleAsync(int userId, int roleId);
    Task<List<Role>> GetUserRolesAsync(int userId);
    Task<List<User>> GetAllUsersAsync();
    Task RemoveUserRoleAsync(int userId, int roleId);
    Task<bool> HasRoleAsync(int userId, string roleName);
}