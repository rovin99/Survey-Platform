using AuthService.Models;
using Microsoft.EntityFrameworkCore;

public interface IUserRepository
{
    Task<User> GetByIdAsync(int id);
    Task<User> GetByUsernameAsync(string username);
    Task<User> GetByEmailAsync(string email);
    Task CreateAsync(User user);
    Task UpdateAsync(User user);
}