using AuthService.Models;
using System.Security.Claims;

public interface IAuthService
{
    Task<(User User, string AccessToken, string RefreshToken)> RegisterUserAsync(string username, string email, string password, string roleName);
    Task<(string AccessToken, string RefreshToken, User User)> LoginAsync(string username, string password);
    Task<(string AccessToken, string RefreshToken)> RefreshTokenAsync(string refreshToken);
    Task<string> RefreshAccessTokenAsync(string currentToken);
    Task LogoutAsync();
    Task LogoutAsync(string refreshToken);
    Task<User> GetUserByIdAsync(int id);
    Task<List<User>> GetAllUsersAsync();
    Task AddUserRoleAsync(int userId, string roleName);
    Task RemoveUserRoleAsync(int userId, string roleName);
    Task<bool> IsAdminAsync(int userId);
    ClaimsPrincipal ValidateToken(string token);
    Task<string> GenerateAccessTokenAsync(User user);
    Task<RefreshToken> GenerateRefreshTokenAsync(User user, string ipAddress);
}
