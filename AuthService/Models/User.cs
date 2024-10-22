using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
namespace AuthService.Models
{
    public class User
    {
        public int UserId { get; set; }
        
        [Required]
        public string Username { get; set; }
        
        [Required]
        public string Email { get; set; }
        
        [Required]
        [JsonIgnore]
        public string PasswordHash { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public List<UserRole> UserRoles { get; set; }
    }
}