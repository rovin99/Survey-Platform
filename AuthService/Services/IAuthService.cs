using AuthService.Models;


public interface IAuthService
{
    Task<(User User, string AccessToken)> RegisterUserAsync(string username, string email, string password, string roleName);
    Task<(string AccessToken, User User)> LoginAsync(string username, string password);
    Task<string> RefreshTokenAsync();
    Task<string> RefreshAccessTokenAsync(string currentToken);
    Task LogoutAsync();
    Task<User> GetUserByIdAsync(int id);
    Task<List<User>> GetAllUsersAsync();
    Task AddUserRoleAsync(int userId, string roleName);
    Task RemoveUserRoleAsync(int userId, string roleName);
    Task<bool> IsAdminAsync(int userId);
}
