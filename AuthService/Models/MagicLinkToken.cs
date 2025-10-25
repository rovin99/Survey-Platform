using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace AuthService.Models
{
    public class MagicLinkToken
    {
        public int Id { get; set; }

        [Required]
        [StringLength(256)]
        public string Token { get; set; }

        [Required]
        [EmailAddress]
        [StringLength(256)]
        public string Email { get; set; }

        [Required]
        public DateTime ExpiresAt { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }

        public DateTime? UsedAt { get; set; }

        [StringLength(45)]
        public string? CreatedByIp { get; set; }

        [StringLength(45)]
        public string? UsedByIp { get; set; }

        // Optional: Link to user if they already exist
        public int? UserId { get; set; }
        
        [ForeignKey("UserId")]
        [JsonIgnore]
        public User? User { get; set; }

        // Helper properties
        [NotMapped]
        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

        [NotMapped]
        public bool IsUsed => UsedAt != null;

        [NotMapped]
        public bool IsValid => !IsExpired && !IsUsed;

        public void MarkAsUsed(string? usedByIp = null)
        {
            UsedAt = DateTime.UtcNow;
            UsedByIp = usedByIp;
        }
    }
}