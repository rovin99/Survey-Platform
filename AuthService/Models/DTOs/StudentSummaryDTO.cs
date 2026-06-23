using System;

namespace AuthService.Models
{
    /// <summary>
    /// Lightweight roster row for the conductor "Students" management page.
    /// Combines the User (name, email) with the Participant profile (roll no, phone, status).
    /// </summary>
    public class StudentSummaryDTO
    {
        public int ParticipantId { get; set; }
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? RollNo { get; set; }
        public string? PhoneNumber { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
