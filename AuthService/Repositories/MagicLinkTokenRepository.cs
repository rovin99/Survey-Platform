using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Repositories
{
    public class MagicLinkTokenRepository : IMagicLinkTokenRepository
    {
        private readonly AppDbContext _context;

        public MagicLinkTokenRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<MagicLinkToken> CreateAsync(MagicLinkToken magicLinkToken)
        {
            magicLinkToken.CreatedAt = DateTime.UtcNow;
            _context.MagicLinkTokens.Add(magicLinkToken);
            await _context.SaveChangesAsync();
            return magicLinkToken;
        }

        public async Task<MagicLinkToken?> GetByTokenAsync(string token)
        {
            return await _context.MagicLinkTokens
                .Include(mlt => mlt.User)
                .FirstOrDefaultAsync(mlt => mlt.Token == token);
        }

        public async Task<List<MagicLinkToken>> GetByEmailAsync(string email)
        {
            return await _context.MagicLinkTokens
                .Where(mlt => mlt.Email.ToLower() == email.ToLower())
                .OrderByDescending(mlt => mlt.CreatedAt)
                .ToListAsync();
        }

        public async Task UpdateAsync(MagicLinkToken magicLinkToken)
        {
            _context.MagicLinkTokens.Update(magicLinkToken);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(MagicLinkToken magicLinkToken)
        {
            _context.MagicLinkTokens.Remove(magicLinkToken);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteExpiredTokensAsync()
        {
            var expiredTokens = await _context.MagicLinkTokens
                .Where(mlt => mlt.ExpiresAt <= DateTime.UtcNow)
                .ToListAsync();

            if (expiredTokens.Any())
            {
                _context.MagicLinkTokens.RemoveRange(expiredTokens);
                await _context.SaveChangesAsync();
            }
        }

        public async Task InvalidateAllTokensForEmailAsync(string email, string? reason = null)
        {
            var activeTokens = await _context.MagicLinkTokens
                .Where(mlt => mlt.Email.ToLower() == email.ToLower() && mlt.UsedAt == null)
                .ToListAsync();

            foreach (var token in activeTokens)
            {
                token.MarkAsUsed($"Invalidated: {reason}");
            }

            if (activeTokens.Any())
            {
                await _context.SaveChangesAsync();
            }
        }

        public async Task<bool> IsTokenValidAsync(string token)
        {
            var magicToken = await _context.MagicLinkTokens
                .FirstOrDefaultAsync(mlt => mlt.Token == token);
            
            return magicToken != null && magicToken.IsValid;
        }
    }
}