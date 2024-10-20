using System.ComponentModel.DataAnnotations;

namespace AuthService.Models
{
    public class Role
    {
        public int RoleId { get; set; }
        public string RoleName { get; set; }
    }
}