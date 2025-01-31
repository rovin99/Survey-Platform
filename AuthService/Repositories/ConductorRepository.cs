using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using AuthService.Models;

namespace AuthService.Repositories
{
    public class ConductorRepository : IConductorRepository
    {
        private readonly AppDbContext _context;

        public ConductorRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Conductor> AddAsync(Conductor conductor)
        {
            _context.Conductors.Add(conductor);
            await _context.SaveChangesAsync();
            return conductor;
        }

        public async Task<Conductor> GetByIdAsync(int id)
        {
            return await _context.Conductors
                .FirstOrDefaultAsync(c => c.ConductorId == id); 
        }

       
        public async Task<Conductor> GetByUserIdAsync(int userId)
        {
            return await _context.Conductors
                .FirstOrDefaultAsync(c => c.UserId == userId);
        }
        public async Task<Conductor> UpdateAsync(Conductor conductor)
        {
            _context.Entry(conductor).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return conductor;
        }

        public async Task DeleteAsync(int id)
        {
            var conductor = await _context.Conductors.FindAsync(id);
            if (conductor != null)
            {
                _context.Conductors.Remove(conductor);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<(List<Conductor> conductors, int total)> ListAsync(int page, int limit)
        {
            var query = _context.Conductors
                .Include(c => c.User)
                .AsNoTracking();

            var total = await query.CountAsync();
            var conductors = await query
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();

            return (conductors, total);
        }
    }
}