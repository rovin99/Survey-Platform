using System;
using System.Collections.Generic;
using System.Linq;

namespace AuthService.Models.DTOs
{
    public class UserDTO
    {
        public int UserId { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<string> Roles { get; set; }

        public static UserDTO FromUser(User user)
        {
            return new UserDTO
            {
                UserId = user.UserId,
                Username = user.Username,
                Email = user.Email,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt,
                Roles = user.UserRoles?.Select(ur => ur.Role.RoleName).ToList() ?? new List<string>()
            };
        }
    }
}
