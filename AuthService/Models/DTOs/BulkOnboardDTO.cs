using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models
{
    /// <summary>
    /// Request to bulk-onboard student participant accounts (conductor only).
    /// Each email becomes a participant account that can log in with email + the shared default password.
    /// </summary>
    public class BulkOnboardRequest
    {
        [Required]
        public string DefaultPassword { get; set; } = string.Empty;

        /// <summary>
        /// Preferred input: rich student rows (from the Excel template). Email is required per row;
        /// the rest pre-fill the participant's dashboard (display name, roll no, phone).
        /// </summary>
        public List<BulkOnboardStudent> Students { get; set; } = new List<BulkOnboardStudent>();

        /// <summary>
        /// Backward-compatible plain email list (no name/roll/phone). Merged with <see cref="Students"/>.
        /// </summary>
        public List<string> Emails { get; set; } = new List<string>();
    }

    /// <summary>
    /// A single student row to onboard. Only Email is required.
    /// </summary>
    public class BulkOnboardStudent
    {
        public string Email { get; set; } = string.Empty;
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? RollNo { get; set; }
        public string? Phone { get; set; }
    }

    /// <summary>
    /// Per-email outcome of a bulk-onboard run.
    /// </summary>
    public class BulkOnboardFailure
    {
        public string Email { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }

    public class BulkOnboardResult
    {
        public List<string> Created { get; set; } = new List<string>();
        public List<string> Skipped { get; set; } = new List<string>();
        public List<BulkOnboardFailure> Failed { get; set; } = new List<BulkOnboardFailure>();
    }
}
