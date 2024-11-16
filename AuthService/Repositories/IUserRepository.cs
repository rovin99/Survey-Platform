using AuthService.Models;
using Microsoft.EntityFrameworkCore;

public interface IUserRepository
{
    Task<User> GetByIdAsync(int id);
    Task<User> GetByUsernameAsync(string username);
    Task CreateAsync(User user);
    Task AddUserRoleAsync(int userId, int roleId);
    Task RemoveUserRoleAsync(int userId, int roleId);
    Task<List<User>> GetAllUsersAsync();
    Task<bool> HasRoleAsync(int userId, string roleName);
}