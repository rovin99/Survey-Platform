using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
namespace AuthService.Models
{
    public class Role
    {
        public int RoleId { get; set; }
        public string RoleName { get; set; }
        [JsonIgnore]
        public List<UserRole> UserRoles { get; set; }
    }
}