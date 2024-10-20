using AuthService.Models;
public interface IAuthService
{
    Task<User> RegisterUserAsync(string username, string email, string password, string roleName);
    Task<string> LoginAsync(string username, string password);
    Task<User> GetUserByIdAsync(int id);
}