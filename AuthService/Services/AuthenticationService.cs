using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AuthService.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;
using AuthService.Repositories;
using Microsoft.Extensions.Logging;

namespace AuthService.Services
{   
    public class AuthenticationService : IAuthService
    {
        

        private readonly IUserRepository _userRepository;
        private readonly IRoleRepository _roleRepository;
        private readonly IRefreshTokenRepository _refreshTokenRepository;
        private readonly IConfiguration _configuration;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<AuthenticationService> _logger;
        
    public AuthenticationService(
        IUserRepository userRepository, 
        IRoleRepository roleRepository, 
        IRefreshTokenRepository refreshTokenRepository,
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AuthenticationService> logger)
    {
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _configuration = configuration;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task<(User User, string AccessToken, string RefreshToken)> RegisterUserAsync(string username, string email, string password, string roleName)
    {
        var ipAddress = GetIpAddress();
        _logger.LogInformation("User registration attempt started for username: {Username}, email: {Email}, role: {Role}, IP: {IpAddress}", 
            username, email, roleName, ipAddress);

        var existingUser = await _userRepository.GetByUsernameAsync(username);
        if (existingUser != null)
        {
            _logger.LogWarning("Registration failed - Username already exists: {Username}, IP: {IpAddress}", 
                username, ipAddress);
            throw new Exception("Username already exists.");
        }

        var role = await _roleRepository.GetByNameAsync(roleName);
        if (role == null)
        {
            _logger.LogWarning("Registration failed - Invalid role: {Role}, Username: {Username}, IP: {IpAddress}", 
                roleName, username, ipAddress);
            throw new Exception("Invalid role.");
        }

        var user = new User
        {
            Username = username,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _userRepository.CreateAsync(user);
        await _userRepository.AddUserRoleAsync(user.UserId, role.RoleId);

        _logger.LogInformation("User registration successful for UserId: {UserId}, Username: {Username}, Role: {Role}, IP: {IpAddress}", 
            user.UserId, username, roleName, ipAddress);

        // Generate tokens using new refresh token system
        var accessToken = await GenerateAccessTokenAsync(user);
        var refreshToken = await GenerateRefreshTokenAsync(user, ipAddress);

        _logger.LogInformation("Tokens generated successfully for UserId: {UserId}, IP: {IpAddress}", 
            user.UserId, ipAddress);

        return (user, accessToken, refreshToken.Token);
    }

    public async Task<(string AccessToken, string RefreshToken, User User)> LoginAsync(string username, string password)
    {
        var ipAddress = GetIpAddress();
        _logger.LogInformation("Login attempt started for username: {Username}, IP: {IpAddress}", username, ipAddress);

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
        {
            _logger.LogWarning("Login failed - Missing credentials, IP: {IpAddress}", ipAddress);
            throw new ArgumentException("Username and password are required");
        }

        var user = await _userRepository.GetByUsernameAsync(username);
        if (user == null)
        {
            _logger.LogWarning("Login failed - User not found: {Username}, IP: {IpAddress}", username, ipAddress);
            throw new Exception("User not found");
        }

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            _logger.LogWarning("Login failed - Invalid password for UserId: {UserId}, Username: {Username}, IP: {IpAddress}", 
                user.UserId, username, ipAddress);
            throw new Exception("Invalid password");
        }

        // Revoke all existing refresh tokens for this user
        await _refreshTokenRepository.RevokeAllUserTokensAsync(user.UserId, "New login", ipAddress);
        _logger.LogInformation("Previous refresh tokens revoked for UserId: {UserId}, IP: {IpAddress}", 
            user.UserId, ipAddress);

        // Generate new tokens
        var accessToken = await GenerateAccessTokenAsync(user);
        var refreshToken = await GenerateRefreshTokenAsync(user, ipAddress);

        _logger.LogInformation("Login successful for UserId: {UserId}, Username: {Username}, IP: {IpAddress}", 
            user.UserId, username, ipAddress);

        return (accessToken, refreshToken.Token, user);
    }

        public async Task<(string AccessToken, string RefreshToken)> RefreshTokenAsync(string refreshToken)
        {
            var ipAddress = GetIpAddress();
            _logger.LogInformation("Token refresh attempt started, IP: {IpAddress}", ipAddress);

            if (string.IsNullOrEmpty(refreshToken))
            {
                _logger.LogWarning("Token refresh failed - Missing refresh token, IP: {IpAddress}", ipAddress);
                throw new ArgumentException("Refresh token is required");
            }

            // Get the stored refresh token
            var storedToken = await _refreshTokenRepository.GetByTokenAsync(refreshToken);
            if (storedToken == null || !storedToken.IsActive)
            {
                _logger.LogWarning("Token refresh failed - Invalid or expired refresh token, IP: {IpAddress}", ipAddress);
                throw new Exception("Invalid or expired refresh token");
            }

            // Get the user
            var user = await _userRepository.GetByIdAsync(storedToken.UserId);
            if (user == null)
            {
                _logger.LogWarning("Token refresh failed - User not found for UserId: {UserId}, IP: {IpAddress}", 
                    storedToken.UserId, ipAddress);
                throw new Exception("User not found");
            }

            // Generate new tokens
            var newAccessToken = await GenerateAccessTokenAsync(user);
            var newRefreshToken = await GenerateRefreshTokenAsync(user, ipAddress);

            // Revoke the old refresh token
            storedToken.Revoke("Replaced by new token", ipAddress, newRefreshToken.Token);
            await _refreshTokenRepository.UpdateAsync(storedToken);

            _logger.LogInformation("Token refresh successful for UserId: {UserId}, Username: {Username}, IP: {IpAddress}", 
                user.UserId, user.Username, ipAddress);

            return (newAccessToken, newRefreshToken.Token);
        }

        public async Task<string> RefreshAccessTokenAsync(string currentToken)
        {
            if (string.IsNullOrEmpty(currentToken))
            {
                throw new Exception("Current access token is required");
            }

            try {
                // Validate the current token (without checking expiration)
                var tokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? throw new Exception("JWT key not configured"))),
                    ValidateIssuer = true,
                    ValidIssuer = _configuration["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = _configuration["Jwt:Audience"],
                    ValidateLifetime = false, // Don't validate lifetime here
                    ClockSkew = TimeSpan.Zero
                };

                var tokenHandler = new JwtSecurityTokenHandler();
                var principal = tokenHandler.ValidateToken(currentToken, tokenValidationParameters, out SecurityToken validatedToken);

                // Extract user ID from the token
                var userId = int.Parse(principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? "0");
                
                // Get the user
                var user = await _userRepository.GetByIdAsync(userId);
                if (user == null)
                {
                    throw new Exception("User not found");
                }

                // Generate new tokens
                var (accessToken, newRefreshToken) = GenerateTokens(user);
                SetRefreshTokenCookie(newRefreshToken);

                return accessToken;
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to refresh access token: {ex.Message}");
            }
        }

        public async Task LogoutAsync()
        {
            if (_httpContextAccessor.HttpContext != null)
            {
                _httpContextAccessor.HttpContext.Response.Cookies.Delete("refreshToken", new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.Strict,
                    Path = "/"
                });
            }
        }

        private (string AccessToken, string RefreshToken) GenerateTokens(User user)
        {
            var tokenId = Guid.NewGuid().ToString();
            var refreshTokenId = Guid.NewGuid().ToString();
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var roles = user.UserRoles.Select(ur => ur.Role.RoleName).ToList();
            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };
            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            // Generate access token (short-lived)
            var accessToken = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(15), // Short lifetime for access token
                signingCredentials: credentials
            );

            // Generate refresh token (long-lived)
            var refreshToken = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: new List<Claim> 
                { 
                    new Claim(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
                },
                expires: DateTime.Now.AddDays(7), // Longer lifetime for refresh token
                signingCredentials: credentials
            );

            return (
                new JwtSecurityTokenHandler().WriteToken(accessToken),
                new JwtSecurityTokenHandler().WriteToken(refreshToken)
            );
        }

        private void SetRefreshTokenCookie(string refreshToken)
        {
            if (_httpContextAccessor.HttpContext != null)
            {
                _httpContextAccessor.HttpContext.Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTime.Now.AddDays(7),
                    Path = "/"
                });
            }
        }


        
        public async Task<User> GetUserByIdAsync(int id)
        {
            return await _userRepository.GetByIdAsync(id);
        }

        public async Task<List<User>> GetAllUsersAsync()
        {
            return await _userRepository.GetAllUsersAsync();
        }

        public async Task AddUserRoleAsync(int userId, string roleName)
        {
            // Check if user already has this role
            if (await _userRepository.HasRoleAsync(userId, roleName))
            {
                Console.WriteLine($"User {userId} already has role '{roleName}' - skipping");
                return;
            }

            var role = await _roleRepository.GetByNameAsync(roleName);
            if (role == null)
            {
                throw new Exception($"Role '{roleName}' not found.");
            }
            
            await _userRepository.AddUserRoleAsync(userId, role.RoleId);
            Console.WriteLine($"Successfully added role '{roleName}' to user {userId}");
        }

        public async Task RemoveUserRoleAsync(int userId, string roleName)
        {
            var role = await _roleRepository.GetByNameAsync(roleName);
            if (role == null)
            {
                throw new Exception($"Role '{roleName}' not found.");
            }

            await _userRepository.RemoveUserRoleAsync(userId, role.RoleId);
        }

        public async Task<bool> IsAdminAsync(int userId)
        {
            return await _userRepository.HasRoleAsync(userId, "Admin");
        }

        public async Task LogoutAsync(string refreshToken)
        {
            var ipAddress = GetIpAddress();
            _logger.LogInformation("Logout attempt started, IP: {IpAddress}", ipAddress);

            if (!string.IsNullOrEmpty(refreshToken))
            {
                var storedToken = await _refreshTokenRepository.GetByTokenAsync(refreshToken);
                if (storedToken != null && storedToken.IsActive)
                {
                    storedToken.Revoke("User logout", ipAddress);
                    await _refreshTokenRepository.UpdateAsync(storedToken);
                    
                    _logger.LogInformation("Logout successful for UserId: {UserId}, IP: {IpAddress}", 
                        storedToken.UserId, ipAddress);
                }
                else
                {
                    _logger.LogWarning("Logout attempted with invalid refresh token, IP: {IpAddress}", ipAddress);
                }
            }
            else
            {
                _logger.LogInformation("Logout attempted without refresh token, IP: {IpAddress}", ipAddress);
            }
        }

        public ClaimsPrincipal ValidateToken(string token)
        {
            var ipAddress = GetIpAddress();
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Key"]);
            
            try
            {
                var validationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidIssuer = _configuration["Jwt:Issuer"],
                    ValidAudience = _configuration["Jwt:Audience"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };

                var principal = tokenHandler.ValidateToken(token, validationParameters, out SecurityToken validatedToken);
                
                var userId = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
                _logger.LogInformation("Token validation successful for UserId: {UserId}, IP: {IpAddress}", 
                    userId, ipAddress);
                
                return principal;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Token validation failed: {Error}, IP: {IpAddress}", ex.Message, ipAddress);
                throw new Exception("Invalid token");
            }
        }

        public async Task<string> GenerateAccessTokenAsync(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Key"]);

            // Load user roles
            var userWithRoles = await _userRepository.GetByIdAsync(user.UserId);
            var roles = userWithRoles.UserRoles?.Select(ur => ur.Role.RoleName).ToList() ?? new List<string>();

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
                new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, new DateTimeOffset(DateTime.UtcNow).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            };

            foreach (var role in roles)
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(int.Parse(_configuration["Jwt:DurationInMinutes"] ?? "15")),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"]
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public async Task<RefreshToken> GenerateRefreshTokenAsync(User user, string ipAddress)
        {
            var refreshToken = new RefreshToken
            {
                Token = GenerateRandomToken(),
                UserId = user.UserId,
                ExpiresAt = DateTime.UtcNow.AddDays(7), // 7 days expiration
                CreatedAt = DateTime.UtcNow,
                CreatedByIp = ipAddress
            };

            return await _refreshTokenRepository.CreateAsync(refreshToken);
        }

        private string GenerateRandomToken()
        {
            using var rng = RandomNumberGenerator.Create();
            var randomBytes = new byte[64];
            rng.GetBytes(randomBytes);
            return Convert.ToBase64String(randomBytes);
        }

        private string GetIpAddress()
        {
            return _httpContextAccessor.HttpContext?.Connection?.RemoteIpAddress?.ToString() ?? "Unknown";
        }
    }
}