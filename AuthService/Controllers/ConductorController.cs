using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using AuthService.Models;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ConductorController : ControllerBase
    {
        private readonly IConductorService _conductorService;

        public ConductorController(IConductorService conductorService)
        {
            _conductorService = conductorService;
        }

        
        [HttpPost("register")]
public async Task<IActionResult> RegisterConductor([FromBody] ConductorRegistrationRequest request)
{
    if (!ModelState.IsValid)
        return BadRequest(ModelState);
    
    var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        return BadRequest("User ID not found in token");

    await _conductorService.RegisterConductorAsync(userId, request);
    return StatusCode(201, new { message = "Verification email sent to your official email address" });
}

        [HttpGet("{id}")]
        public async Task<IActionResult> GetConductor(int id)
        {
            var conductor = await _conductorService.GetByIdAsync(id);
            if (conductor == null)
                return NotFound("Conductor not found");

            return Ok(conductor);
        }

        

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateConductor(int id, [FromBody] ConductorUpdateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            await _conductorService.UpdateConductorAsync(id, request);
            return Ok(new { message = "Conductor updated successfully" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteConductor(int id)
        {
            await _conductorService.DeleteConductorAsync(id);
            return Ok(new { message = "Conductor deleted successfully" });
        }

        [HttpGet]
        public async Task<IActionResult> ListConductors([FromQuery] int page = 1, [FromQuery] int limit = 10)
        {
            var (conductors, total) = await _conductorService.ListConductorsAsync(page, limit);
            return Ok(new
            {
                conductors,
                total,
                page,
                limit
            });
        }
    }
}