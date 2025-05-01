using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.Models;

namespace AuthService.Repositories
{
    public interface IConductorRepository
    {
        Task<Conductor> AddAsync(Conductor conductor);
        Task<Conductor?> GetByIdAsync(int id);
        Task<Conductor?> GetByUserIdAsync(int userId);
        Task<Conductor> UpdateAsync(Conductor conductor);
        Task DeleteAsync(int id);
        Task<(List<Conductor> conductors, int total)> ListAsync(int page, int limit);
    }
}