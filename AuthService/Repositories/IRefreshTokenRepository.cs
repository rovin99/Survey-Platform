using AuthService.Models;

namespace AuthService.Repositories
{
    public interface IRefreshTokenRepository
    {
        Task<RefreshToken> GetByTokenAsync(string token);
        Task<List<RefreshToken>> GetActiveTokensByUserIdAsync(int userId);
        Task<RefreshToken> CreateAsync(RefreshToken refreshToken);
        Task UpdateAsync(RefreshToken refreshToken);
        Task DeleteAsync(RefreshToken refreshToken);
        Task DeleteExpiredTokensAsync();
        Task RevokeAllUserTokensAsync(int userId, string? reason = null, string? revokedByIp = null);
        Task<bool> IsTokenActiveAsync(string token);
    }
} 