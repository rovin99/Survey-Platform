using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace AuthService.Models
{
    public class User
    {
        public int UserId { get; set; }

        [Required(ErrorMessage = "Username is required")]
        [StringLength(20, MinimumLength = 2, ErrorMessage = "Username must be between 2 and 20 characters")]
        [RegularExpression(@"^[a-zA-Z0-9_]+$", ErrorMessage = "Username must contain only letters, numbers and underscore")]
        public string Username { get; set; }

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public string Email { get; set; }

        [Required]
        [JsonIgnore]
        public string PasswordHash { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public List<UserRole> UserRoles { get; set; }

        // Navigation properties
        [JsonIgnore]
        public Conductor Conductor { get; set; }

        [JsonIgnore]
        public Participant Participant { get; set; }

        [JsonIgnore]
        public List<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    }
}