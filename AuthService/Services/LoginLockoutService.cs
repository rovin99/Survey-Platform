using Microsoft.Extensions.Caching.Memory;

namespace AuthService.Services
{
    public interface ILoginLockoutService
    {
        bool IsLockedOut(string username, string ipAddress);
        void RecordFailedAttempt(string username, string ipAddress);
        void ResetAttempts(string username, string ipAddress);
    }

    public class LoginLockoutService : ILoginLockoutService
    {
        private readonly IMemoryCache _cache;
        private readonly ILogger<LoginLockoutService> _logger;

        private const int MaxFailedAttempts = 5;
        private const int LockoutMinutes = 15;

        public LoginLockoutService(IMemoryCache cache, ILogger<LoginLockoutService> logger)
        {
            _cache = cache;
            _logger = logger;
        }

        private string GetCacheKey(string username, string ipAddress)
            => $"login_attempts:{username.ToLowerInvariant()}:{ipAddress}";

        public bool IsLockedOut(string username, string ipAddress)
        {
            var key = GetCacheKey(username, ipAddress);
            if (_cache.TryGetValue(key, out int attempts))
            {
                return attempts >= MaxFailedAttempts;
            }
            return false;
        }

        public void RecordFailedAttempt(string username, string ipAddress)
        {
            var key = GetCacheKey(username, ipAddress);
            var attempts = _cache.GetOrCreate(key, entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(LockoutMinutes);
                return 0;
            });

            attempts++;
            _cache.Set(key, attempts, TimeSpan.FromMinutes(LockoutMinutes));

            _logger.LogWarning(
                "Failed login attempt {Attempt}/{Max} for user {Username} from IP {IpAddress}",
                attempts, MaxFailedAttempts, username, ipAddress);

            if (attempts >= MaxFailedAttempts)
            {
                _logger.LogWarning(
                    "Account locked out for user {Username} from IP {IpAddress} for {Minutes} minutes",
                    username, ipAddress, LockoutMinutes);
            }
        }

        public void ResetAttempts(string username, string ipAddress)
        {
            var key = GetCacheKey(username, ipAddress);
            _cache.Remove(key);
        }
    }
}
