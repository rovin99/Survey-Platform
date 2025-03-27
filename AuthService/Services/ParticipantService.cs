using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using AuthService.Models;
using AuthService.Repositories;
using AuthService.Utils;

namespace AuthService.Services
{
    public class ParticipantService : IParticipantService
    {
        private readonly IParticipantRepository _participantRepository;

        public ParticipantService(IParticipantRepository participantRepository)
        {
            _participantRepository = participantRepository;
        }

        public async Task<ApiResponse<Participant>> RegisterParticipantAsync(int userId, ParticipantRegistrationRequest request)
        {
            var existingParticipant = await _participantRepository.GetByUserIdAsync(userId);
            if (existingParticipant != null)
            {
                return ResponseUtil.Error<Participant>("User is already registered as a participant", "DUPLICATE_ENTRY");
            }

            var participant = new Participant
            {
                UserId = userId,
                ExperienceLevel = ExperienceLevel.BEGINNER,
                Rating = 0,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Skills = request.Skills.Select(skill => new ParticipantsSkill
                {
                    SkillName = skill.SkillName,
                    ProficiencyLevel = skill.ProficiencyLevel,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }).ToList()
            };

            await _participantRepository.AddAsync(participant);
            return ResponseUtil.Success(participant, "Participant registered successfully");
        }

        public async Task<ApiResponse<Participant>> GetByIdAsync(int id)
        {
            var participant = await _participantRepository.GetByIdAsync(id);
            return participant != null 
                ? ResponseUtil.Success(participant) 
                : ResponseUtil.NotFound<Participant>("Participant not found");
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
    }
}
