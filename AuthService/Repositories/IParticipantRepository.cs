using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.Models;

namespace AuthService.Repositories
{
    public interface IParticipantRepository
    {
        Task<Participant> AddAsync(Participant participant);
        Task<Participant> GetByIdAsync(int id);
        Task<Participant> GetByUserIdAsync(int userId);
        Task<Participant> UpdateAsync(Participant participant);
        Task DeleteAsync(int id);
        Task<(List<Participant> participants, int total)> ListAsync(int page, int limit);
    }
}
