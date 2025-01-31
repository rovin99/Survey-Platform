using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using AuthService.Models;
using AuthService.Repositories;

namespace AuthService.Services 
{
    public class ConductorService : IConductorService
    {
        private readonly IConductorRepository _conductorRepository;
        private readonly IEmailService _emailService;
        
        public ConductorService(
            IConductorRepository conductorRepository,
            IEmailService emailService
        )
        {
            _conductorRepository = conductorRepository;
            _emailService = emailService;
        }

        public async Task RegisterConductorAsync(int userId, ConductorRegistrationRequest request)
        {   var existingConductor = await _conductorRepository.GetByUserIdAsync(userId);
            if (existingConductor != null)
            {
                throw new InvalidOperationException("User is already registered as a conductor.");
            }
            var conductor = new Conductor
            {
                UserId = userId,
                Name = request.Name,
                ConductorType = request.ConductorType,
                Description = request.Description,
                ContactEmail = request.ContactEmail,
                ContactPhone = request.ContactPhone,
                Address = request.Address,
                IsVerified = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _conductorRepository.AddAsync(conductor);
            await _emailService.SendVerificationEmailAsync(conductor.ContactEmail);
        }

        public async Task<Conductor> GetByIdAsync(int id)
        {
            return await _conductorRepository.GetByIdAsync(id);
        }

        
        public async Task UpdateConductorAsync(int id, ConductorUpdateRequest request)
        {
            var conductor = await _conductorRepository.GetByIdAsync(id);
            if (conductor == null)
                throw new Exception("Conductor not found");

            conductor.Name = request.Name;
            conductor.Description = request.Description;
            conductor.ContactPhone = request.ContactPhone;
            conductor.Address = request.Address;
            conductor.UpdatedAt = DateTime.UtcNow;

            await _conductorRepository.UpdateAsync(conductor);
        }

        public async Task DeleteConductorAsync(int id)
        {
            await _conductorRepository.DeleteAsync(id);
        }

        public async Task<(List<Conductor> conductors, int total)> ListConductorsAsync(int page, int limit)
        {
            return await _conductorRepository.ListAsync(page, limit);
        }
    }
}