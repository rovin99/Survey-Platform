using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using AuthService.Models;
using AuthService.Utils;
namespace AuthService.Repositories
{
    public class ParticipantRepository : IParticipantRepository
    {
        private readonly AppDbContext _context;

        public ParticipantRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Participant> AddAsync(Participant participant)
        {
            _context.Participants.Add(participant);
            await _context.SaveChangesAsync();
            return participant;
        }

        public async Task<Participant> GetByIdAsync(int id)
        {
            return await _context.Participants
                .FirstOrDefaultAsync(p => p.ParticipantId == id);
        }

        public async Task<Participant> GetByUserIdAsync(int userId)
        {
            return await _context.Participants
                .FirstOrDefaultAsync(p => p.UserId == userId);
        }

        public async Task<Participant> UpdateAsync(Participant participant)
        {
            _context.Entry(participant).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return participant;
        }

        public async Task DeleteAsync(int id)
        {
            var participant = await _context.Participants.FindAsync(id);
            if (participant != null)
            {
                _context.Participants.Remove(participant);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<(List<Participant> participants, int total)> ListAsync(int page, int limit)
        {
            var query = _context.Participants
                .AsNoTracking();

            var total = await query.CountAsync();
            var participants = await query
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();

            return (participants, total);
        }
    }
}
