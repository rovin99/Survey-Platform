using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using AuthService.Models;

namespace AuthService.Models
{
    /// <summary>
    /// Custom field entry for participant profiles
    /// </summary>
    public class CustomFieldDTO
    {
        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Value { get; set; } = string.Empty;
    }

    public class ParticipantDTO
    {
        public int ParticipantId { get; set; }
        public int UserId { get; set; }

        // Profile fields from User
        public string? Name { get; set; }
        public string? Email { get; set; }

        // Profile fields from Participant
        public string? RollNo { get; set; }
        public string? PhoneNumber { get; set; }

        public ExperienceLevel ExperienceLevel { get; set; }
        public decimal Rating { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<ParticipantSkillDTO> Skills { get; set; }

        /// <summary>
        /// Custom profile fields added by the participant
        /// </summary>
        public List<CustomFieldDTO>? CustomFields { get; set; }
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
        /// <summary>
        /// Participant's display name (required)
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Phone number (optional)
        /// </summary>
        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        /// <summary>
        /// Skills are optional - participants can register without specifying skills
        /// </summary>
        public List<ParticipantSkillDTO>? Skills { get; set; }
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

    // New DTO for profile updates
    public class ParticipantProfileUpdateRequest
    {
        [MaxLength(100)]
        public string? Name { get; set; }

        [MaxLength(100)]
        public string? RollNo { get; set; }

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        /// <summary>
        /// Custom profile fields. When provided, replaces all existing custom fields.
        /// </summary>
        public List<CustomFieldDTO>? CustomFields { get; set; }
    }
}
