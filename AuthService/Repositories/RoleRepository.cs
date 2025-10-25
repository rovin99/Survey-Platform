using AuthService.Models;
using Microsoft.EntityFrameworkCore;

public class RoleRepository : IRoleRepository
{
    private readonly AppDbContext _context;

    public RoleRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Role> GetByIdAsync(int id)
    {
        return await _context.Roles.FindAsync(id);
    }

    public async Task<Role> GetByNameAsync(string name)
    {
        // Use EF.Functions.Like for case-insensitive comparison that works with the database
        return await _context.Roles.FirstOrDefaultAsync(r => EF.Functions.Like(r.RoleName, name));
    }
}