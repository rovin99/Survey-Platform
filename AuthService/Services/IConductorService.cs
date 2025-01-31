using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.Models;

namespace AuthService.Services 
{
    public interface IConductorService
    {
        Task RegisterConductorAsync(int userId, ConductorRegistrationRequest request);
        Task<Conductor> GetByIdAsync(int id);
        
        Task UpdateConductorAsync(int id, ConductorUpdateRequest request);
        Task DeleteConductorAsync(int id);
        Task<(List<Conductor> conductors, int total)> ListConductorsAsync(int page, int limit);
    }
}