using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.Models;
using AuthService.Utils;

namespace AuthService.Services
{
    public interface IParticipantService
    {
        Task<ApiResponse<Participant>> RegisterParticipantAsync(int userId, ParticipantRegistrationRequest request);
        Task<ApiResponse<Participant>> GetByIdAsync(int id);
        Task<ApiResponse<Participant>> UpdateParticipantAsync(int id, ParticipantUpdateRequest request);
        Task<ApiResponse<bool>> DeleteParticipantAsync(int id);
        Task<ApiResponse<(List<Participant> participants, int total)>> ListParticipantsAsync(int page, int limit);
    }
}
