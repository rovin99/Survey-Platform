using AuthService.Models;

namespace AuthService.Repositories
{
    public interface IMagicLinkTokenRepository
    {
        Task<MagicLinkToken> CreateAsync(MagicLinkToken magicLinkToken);
        Task<MagicLinkToken?> GetByTokenAsync(string token);
        Task<List<MagicLinkToken>> GetByEmailAsync(string email);
        Task UpdateAsync(MagicLinkToken magicLinkToken);
        Task DeleteAsync(MagicLinkToken magicLinkToken);
        Task DeleteExpiredTokensAsync();
        Task InvalidateAllTokensForEmailAsync(string email, string? reason = null);
        Task<bool> IsTokenValidAsync(string token);
    }
}