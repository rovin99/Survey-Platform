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
        private readonly IAuthService _authService;
        
        public ConductorService(
            IConductorRepository conductorRepository,
            IEmailService emailService,
            IAuthService authService
        )
        {
            _conductorRepository = conductorRepository;
            _emailService = emailService;
            _authService = authService;
        }

        public async Task RegisterConductorAsync(int userId, ConductorRegistrationRequest request)
        {   
            var existingConductor = await _conductorRepository.GetByUserIdAsync(userId);
            if (existingConductor != null)
            {
                // Update existing conductor instead of throwing an error
                existingConductor.Name = request.Name;
                existingConductor.ConductorType = request.ConductorType;
                existingConductor.Description = request.Description;
                existingConductor.ContactEmail = request.ContactEmail;
                existingConductor.ContactPhone = request.ContactPhone;
                existingConductor.Address = request.Address;
                existingConductor.UpdatedAt = DateTime.UtcNow;

                try
                {
                    await _conductorRepository.UpdateAsync(existingConductor);
                    
                    // Ensure user has Conducting role (in case it was missing)
                    await _authService.AddUserRoleAsync(userId, "Conducting");
                    
                    // Try to send verification email, but don't fail if email service is unavailable
                    try
                    {
                        await _emailService.SendVerificationEmailAsync(existingConductor.ContactEmail);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Warning: Failed to send verification email to {existingConductor.ContactEmail}: {ex.Message}");
                    }
                }
                catch (Exception)
                {
                    throw;
                }
                return;
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

            try
            {
                await _conductorRepository.AddAsync(conductor);
                
                // Add Conducting role to the user
                await _authService.AddUserRoleAsync(userId, "Conducting");
                
                // Try to send verification email, but don't fail if email service is unavailable
                try
                {
                    await _emailService.SendVerificationEmailAsync(conductor.ContactEmail);
                }
                catch (Exception ex)
                {
                    // Log the error but don't fail the registration
                    // In production, you might want to queue this for retry
                    Console.WriteLine($"Warning: Failed to send verification email to {conductor.ContactEmail}: {ex.Message}");
                }
            }
            catch (Exception)
            {
                // If conductor creation fails, let the exception bubble up
                throw;
            }
        }

        public async Task<Conductor> GetByIdAsync(int id)
        {
            return await _conductorRepository.GetByIdAsync(id);
        }

        public async Task<Conductor> GetByUserIdAsync(int userId)
        {
            return await _conductorRepository.GetByUserIdAsync(userId);
        }

        public async Task DeleteByUserIdAsync(int userId)
        {
            var conductor = await _conductorRepository.GetByUserIdAsync(userId);
            if (conductor != null)
            {
                await _conductorRepository.DeleteAsync(conductor.ConductorId);
            }
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