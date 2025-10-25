using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
namespace AuthService.Models.DTOs{
    public class UserRoleUpdateModel{
        public int UserId { get; set; }
        public string RoleName { get; set; }
    }
}
