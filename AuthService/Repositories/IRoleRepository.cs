using AuthService.Models;
using Microsoft.EntityFrameworkCore;

public interface IRoleRepository
{
    Task<Role> GetByIdAsync(int id);
    Task<Role> GetByNameAsync(string name);
}