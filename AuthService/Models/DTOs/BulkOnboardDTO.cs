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

        [Required]
        public List<string> Emails { get; set; } = new List<string>();
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
