using AuthService.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AuthService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
namespace AuthService.Services;
public class AuthenticationService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IRoleRepository _roleRepository;
    private readonly IConfiguration _configuration;

    public AuthenticationService(IUserRepository userRepository, IRoleRepository roleRepository, IConfiguration configuration)
    {
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _configuration = configuration;
    }

    public async Task<User> RegisterUserAsync(string username, string email, string password, string roleName)
    {
        var existingUser = await _userRepository.GetByUsernameAsync(username);
        if (existingUser != null)
        {
            throw new Exception("Username already exists.");
        }

        var role = await _roleRepository.GetByNameAsync(roleName);
        if (role == null)
        {
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
        return user;
    }

    public async Task<string> LoginAsync(string username, string password)
    {


        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
        {
            throw new ArgumentException("Username and password are required");
        }

        var user = await _userRepository.GetByUsernameAsync(username);
        if (user == null)
        {
            throw new Exception("User not found");
        }

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            throw new Exception("Invalid password");
        }

        return GenerateJwtToken(user);
    }

    public async Task<User> GetUserByIdAsync(int id)
    {
        return await _userRepository.GetByIdAsync(id);
    }

    private string GenerateJwtToken(User user)
        {
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

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddMinutes(Convert.ToDouble(_configuration["Jwt:DurationInMinutes"])),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    public async Task<List<User>> GetAllUsersAsync()
    {
        return await _userRepository.GetAllUsersAsync();
    }

    public async Task AddUserRoleAsync(int userId, string roleName)
    {
        var role = await _roleRepository.GetByNameAsync(roleName);
        if (role == null)
        {
            throw new Exception($"Role '{roleName}' not found.");
        }

        await _userRepository.AddUserRoleAsync(userId, role.RoleId);
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
}