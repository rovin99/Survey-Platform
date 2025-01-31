using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using AuthService.Models;

namespace AuthService.Models
{
    public class ParticipantDTO
    {
        public int ParticipantId { get; set; }
        public int UserId { get; set; }
        public ExperienceLevel ExperienceLevel { get; set; }
        public decimal Rating { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class ParticipantRegistrationRequest
    {
        
        [Required]
        [JsonConverter(typeof(JsonStringEnumConverter))]
        public ExperienceLevel ExperienceLevel { get; set; }

        [Required]
        public decimal Rating { get; set; }

        public bool IsActive { get; set; } = true;
    }

    public class ParticipantUpdateRequest
    {
        [Required]
        [JsonConverter(typeof(JsonStringEnumConverter))]
        public ExperienceLevel ExperienceLevel { get; set; }

        [Required]
        public decimal Rating { get; set; }

        public bool IsActive { get; set; }
    }
}
