using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using AuthService.Models;
using AuthService.Repositories;
using AuthService.Utils;

namespace AuthService.Services
{
    public class ParticipantService : IParticipantService
    {
        private readonly IParticipantRepository _participantRepository;
        private readonly IUserRepository _userRepository;
        private readonly IAuthService _authService;

        public ParticipantService(IParticipantRepository participantRepository, IUserRepository userRepository, IAuthService authService)
        {
            _participantRepository = participantRepository;
            _userRepository = userRepository;
            _authService = authService;
        }

        public async Task<ApiResponse<Participant>> RegisterParticipantAsync(int userId, ParticipantRegistrationRequest request)
        {
            var existingParticipant = await _participantRepository.GetByUserIdAsync(userId);
            if (existingParticipant != null)
            {
                return ResponseUtil.Error<Participant>("User is already registered as a participant", "DUPLICATE_ENTRY");
            }

            // Update user's display name if provided
            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                var user = await _userRepository.GetByIdAsync(userId);
                if (user != null)
                {
                    user.Username = request.Name;
                    await _userRepository.UpdateAsync(user);
                }
            }

            var participant = new Participant
            {
                UserId = userId,
                PhoneNumber = request.PhoneNumber,
                ExperienceLevel = ExperienceLevel.BEGINNER,
                Rating = 0,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                // Skills are optional - create empty list if not provided
                Skills = request.Skills?.Select(skill => new ParticipantsSkill
                {
                    SkillName = skill.SkillName,
                    ProficiencyLevel = skill.ProficiencyLevel,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }).ToList() ?? new List<ParticipantsSkill>()
            };

            await _participantRepository.AddAsync(participant);

            // Add Participating role to the user
            await _authService.AddUserRoleAsync(userId, "Participating");

            return ResponseUtil.Success(participant, "Participant registered successfully");
        }

        public async Task<ApiResponse<Participant>> GetByIdAsync(int id)
        {
            var participant = await _participantRepository.GetByIdAsync(id);
            return participant != null 
                ? ResponseUtil.Success(participant) 
                : ResponseUtil.NotFound<Participant>("Participant not found");
        }

        public async Task<ApiResponse<Participant>> GetByUserIdAsync(int userId)
        {
            var participant = await _participantRepository.GetByUserIdAsync(userId);
            return participant != null
                ? ResponseUtil.Success(participant)
                : ResponseUtil.NotFound<Participant>("Participant not found");
        }

        public async Task<ApiResponse<ParticipantDTO>> GetProfileByUserIdAsync(int userId)
        {
            var participant = await _participantRepository.GetByUserIdAsync(userId);
            if (participant == null)
                return ResponseUtil.NotFound<ParticipantDTO>("Participant not found");

            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                return ResponseUtil.NotFound<ParticipantDTO>("User not found");

            // Parse custom fields from JSON
            List<CustomFieldDTO>? customFields = null;
            if (!string.IsNullOrEmpty(participant.CustomFields))
            {
                try
                {
                    customFields = JsonSerializer.Deserialize<List<CustomFieldDTO>>(participant.CustomFields);
                }
                catch (JsonException)
                {
                    // Invalid JSON, ignore custom fields
                    customFields = null;
                }
            }

            var dto = new ParticipantDTO
            {
                ParticipantId = participant.ParticipantId,
                UserId = participant.UserId,
                Name = user.Username, // Username serves as display name
                Email = user.Email,
                RollNo = participant.RollNo,
                PhoneNumber = participant.PhoneNumber,
                ExperienceLevel = participant.ExperienceLevel,
                Rating = participant.Rating,
                IsActive = participant.IsActive,
                CreatedAt = participant.CreatedAt,
                UpdatedAt = participant.UpdatedAt,
                Skills = participant.Skills?.Select(s => new ParticipantSkillDTO
                {
                    SkillName = s.SkillName,
                    ProficiencyLevel = s.ProficiencyLevel
                }).ToList() ?? new List<ParticipantSkillDTO>(),
                CustomFields = customFields
            };

            return ResponseUtil.Success(dto);
        }

        public async Task<ApiResponse<ParticipantDTO>> UpdateProfileAsync(int userId, ParticipantProfileUpdateRequest request)
        {
            var participant = await _participantRepository.GetByUserIdAsync(userId);
            if (participant == null)
                return ResponseUtil.NotFound<ParticipantDTO>("Participant not found");

            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                return ResponseUtil.NotFound<ParticipantDTO>("User not found");

            // Update user name if provided
            if (!string.IsNullOrEmpty(request.Name))
            {
                user.Username = request.Name;
                await _userRepository.UpdateAsync(user);
            }

            // Update participant profile fields
            if (request.RollNo != null)
                participant.RollNo = request.RollNo;
            if (request.PhoneNumber != null)
                participant.PhoneNumber = request.PhoneNumber;

            // Update custom fields if provided
            if (request.CustomFields != null)
            {
                // Validate and limit custom fields (max 20 fields)
                var validFields = request.CustomFields
                    .Where(f => !string.IsNullOrWhiteSpace(f.Name) && !string.IsNullOrWhiteSpace(f.Value))
                    .Take(20)
                    .ToList();

                participant.CustomFields = validFields.Count > 0
                    ? JsonSerializer.Serialize(validFields)
                    : null;
            }

            participant.UpdatedAt = DateTime.UtcNow;
            await _participantRepository.UpdateAsync(participant);

            // Return updated profile
            return await GetProfileByUserIdAsync(userId);
        }

        public async Task<ApiResponse<Participant>> UpdateParticipantAsync(int id, ParticipantUpdateRequest request)
        {
            var participant = await _participantRepository.GetByIdAsync(id);
            if (participant == null)
                return ResponseUtil.NotFound<Participant>("Participant not found");

            participant.ExperienceLevel = request.ExperienceLevel;
            participant.Rating = request.Rating;
            participant.IsActive = request.IsActive;
            participant.UpdatedAt = DateTime.UtcNow;

            await _participantRepository.UpdateAsync(participant);
            return ResponseUtil.Success(participant, "Participant updated successfully");
        }

        public async Task<ApiResponse<bool>> DeleteParticipantAsync(int id)
        {
            var participant = await _participantRepository.GetByIdAsync(id);
            if (participant == null)
                return ResponseUtil.NotFound<bool>("Participant not found");

            await _participantRepository.DeleteAsync(id);
            return ResponseUtil.Success(true, "Participant deleted successfully");
        }

        public async Task<ApiResponse<(List<Participant> participants, int total)>> ListParticipantsAsync(int page, int limit)
        {
            var (participants, total) = await _participantRepository.ListAsync(page, limit);
            return ResponseUtil.Success((participants, total));
        }

        // Roster of all student participants (name + email + profile) for the conductor Students page.
        public async Task<ApiResponse<List<StudentSummaryDTO>>> ListStudentsAsync()
        {
            var participants = await _participantRepository.ListStudentsWithUsersAsync();
            var students = participants
                .Where(p => p.User != null)
                .Select(p => new StudentSummaryDTO
                {
                    ParticipantId = p.ParticipantId,
                    UserId = p.UserId,
                    Name = p.User.Username,
                    Email = p.User.Email,
                    RollNo = p.RollNo,
                    PhoneNumber = p.PhoneNumber,
                    IsActive = p.IsActive,
                    CreatedAt = p.CreatedAt
                })
                .ToList();
            return ResponseUtil.Success(students);
        }

        // Bulk-create student participant accounts from a list of student rows using one shared default
        // password. Existing emails are skipped; per-email outcomes are reported. Students log in with
        // their email + the default password (see AuthenticationService.LoginAsync email resolution).
        // Optional first/last name pre-fill the display name; roll no + phone pre-fill the profile so the
        // participant dashboard shows their details immediately.
        public async Task<ApiResponse<BulkOnboardResult>> BulkOnboardAsync(string defaultPassword, List<BulkOnboardStudent> students)
        {
            // Enforce the same password policy as self-registration.
            var passwordRegex = @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$";
            if (string.IsNullOrEmpty(defaultPassword) || !Regex.IsMatch(defaultPassword, passwordRegex))
            {
                return ResponseUtil.Error<BulkOnboardResult>(
                    "Default password must be at least 8 characters and include uppercase, lowercase, a digit, and a special character",
                    "INVALID_PASSWORD");
            }

            if (students == null || students.Count == 0)
            {
                return ResponseUtil.Error<BulkOnboardResult>("Provide at least one student", "NO_STUDENTS");
            }

            var result = new BulkOnboardResult();
            var emailRegex = new System.ComponentModel.DataAnnotations.EmailAddressAttribute();
            var seen = new HashSet<string>();

            foreach (var student in students)
            {
                var email = (student?.Email ?? string.Empty).Trim().ToLowerInvariant();

                if (email.Length == 0 || !emailRegex.IsValid(email))
                {
                    result.Failed.Add(new BulkOnboardFailure { Email = student?.Email ?? "", Reason = "Invalid email" });
                    continue;
                }
                if (!seen.Add(email))
                {
                    continue; // duplicate within the same request — ignore silently
                }

                try
                {
                    var existing = await _userRepository.GetByEmailAsync(email);
                    if (existing != null)
                    {
                        result.Skipped.Add(email);
                        continue;
                    }

                    var username = await GenerateUniqueUsernameAsync(email);

                    // Create the User (+ base "User" role) then grant "Participating", mirroring a
                    // normal participant. RegisterUserAsync hashes the password with BCrypt.
                    var (user, _, _) = await _authService.RegisterUserAsync(username, email, defaultPassword, "User");
                    await _authService.AddUserRoleAsync(user.UserId, "Participating");

                    // If a name was supplied, use it as the display name. Username is a `text` column and
                    // doubles as the display name (see GetProfileByUserIdAsync / UpdateProfileAsync).
                    var fullName = string.Join(" ", new[] { student?.FirstName?.Trim(), student?.LastName?.Trim() }
                        .Where(part => !string.IsNullOrWhiteSpace(part)));
                    if (!string.IsNullOrWhiteSpace(fullName))
                    {
                        user.Username = fullName;
                        await _userRepository.UpdateAsync(user);
                    }

                    // Profile shell (with any roll no / phone from the sheet) so the participant
                    // dashboard/profile works and is pre-filled immediately.
                    await _participantRepository.AddAsync(new Participant
                    {
                        UserId = user.UserId,
                        RollNo = string.IsNullOrWhiteSpace(student?.RollNo) ? null : student.RollNo.Trim(),
                        PhoneNumber = string.IsNullOrWhiteSpace(student?.Phone) ? null : student.Phone.Trim(),
                        ExperienceLevel = ExperienceLevel.BEGINNER,
                        Rating = 0,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        Skills = new List<ParticipantsSkill>()
                    });

                    result.Created.Add(email);
                }
                catch (Exception ex)
                {
                    result.Failed.Add(new BulkOnboardFailure { Email = email, Reason = ex.Message });
                }
            }

            return ResponseUtil.Success(result,
                $"Onboarded {result.Created.Count} student(s); {result.Skipped.Count} skipped, {result.Failed.Count} failed");
        }

        // Derive a unique, valid username (2-20 chars, [a-zA-Z0-9_]) from an email local-part.
        // The username is internal — students log in by email.
        private async Task<string> GenerateUniqueUsernameAsync(string email)
        {
            var local = email.Split('@')[0];
            var sanitized = Regex.Replace(local, "[^a-zA-Z0-9_]", "");
            if (sanitized.Length < 2) sanitized = "student" + sanitized;
            if (sanitized.Length > 20) sanitized = sanitized.Substring(0, 20);

            var candidate = sanitized;
            var suffix = 1;
            while (await _userRepository.GetByUsernameAsync(candidate) != null)
            {
                var s = "_" + suffix;
                var baseLen = Math.Min(sanitized.Length, 20 - s.Length);
                candidate = sanitized.Substring(0, baseLen) + s;
                suffix++;
            }
            return candidate;
        }
    }
}
