using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace AuthService.Models
{
    public class ParticipantsSkill
    {
        public int ParticipantsSkillId { get; set; }
        public int ParticipantId { get; set; }
        [JsonIgnore]
        public Participant Participant { get; set; }
        public string SkillName { get; set; }
        public int ProficiencyLevel { get; set; } // 1-5 scale
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
