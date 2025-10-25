using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace AuthService.Models
{
    public class RefreshToken
    {
        public int Id { get; set; }

        [Required]
        [StringLength(256)]
        public string Token { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public DateTime ExpiresAt { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }

        public DateTime? RevokedAt { get; set; }

        [StringLength(256)]
        public string? ReplacedByToken { get; set; }

        [StringLength(500)]
        public string? RevokedReason { get; set; }

        [StringLength(45)]
        public string? CreatedByIp { get; set; }

        [StringLength(45)]
        public string? RevokedByIp { get; set; }

        // Navigation property
        [ForeignKey("UserId")]
        [JsonIgnore]
        public User User { get; set; }

        // Helper properties
        [NotMapped]
        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

        [NotMapped]
        public bool IsRevoked => RevokedAt != null;

        [NotMapped]
        public bool IsActive => !IsRevoked && !IsExpired;

        public void Revoke(string? reason = null, string? revokedByIp = null, string? replacedByToken = null)
        {
            RevokedAt = DateTime.UtcNow;
            RevokedReason = reason;
            RevokedByIp = revokedByIp;
            ReplacedByToken = replacedByToken;
        }
    }
} 