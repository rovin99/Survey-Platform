using System;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace AuthService.Models
{
    public class Conductor
    {
        public int ConductorId { get; set; }
        public int UserId { get; set; }

        [JsonIgnore]
        public User User { get; set; }
        public string Name { get; set; }
        
        public ConductorType ConductorType { get; set; }
        public string Description { get; set; }
        public string ContactEmail { get; set; }
        public string ContactPhone { get; set; }
        public string Address { get; set; }
        public bool IsVerified { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public enum ConductorType
    {
        INDIVIDUAL,
        INSTITUTE,
        COMPANY
    }
}