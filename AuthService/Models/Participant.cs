using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace AuthService.Models
{
    public class Participant
    {
        public int ParticipantId { get; set; }
        public int UserId { get; set; }
        [JsonIgnore]
        public User User { get; set; }

        // Profile fields
        [MaxLength(100)]
        public string? RollNo { get; set; }

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        public ExperienceLevel ExperienceLevel { get; set; }
        public decimal Rating { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        [JsonIgnore]
        public ICollection<ParticipantsSkill> Skills { get; set; }

        /// <summary>
        /// Custom profile fields stored as JSON. Allows participants to add their own
        /// name-value pairs like Department, Year, Section, etc.
        /// Format: [{"name": "Department", "value": "Computer Science"}, ...]
        /// </summary>
        [Column(TypeName = "jsonb")]
        public string? CustomFields { get; set; }
    }

    public enum ExperienceLevel
    {
        BEGINNER,
        INTERMEDIATE,
        ADVANCED
    }
}