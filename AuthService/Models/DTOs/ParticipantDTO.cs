using System;
using System.Collections.Generic;
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
        public List<ParticipantSkillDTO> Skills { get; set; }
    }

    public class ParticipantSkillDTO
    {
        [Required]
        public string SkillName { get; set; }

        [Required]
        [Range(1, 5)]
        public int ProficiencyLevel { get; set; }
    }

    public class ParticipantRegistrationRequest
    {
        [Required]
        public List<ParticipantSkillDTO> Skills { get; set; }
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
