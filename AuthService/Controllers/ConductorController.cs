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
    return StatusCode(201, new { message = "Conductor registration completed successfully. Verification email sent to your official email address." });
}

        [HttpGet("~/api/Conductor/current")]
        public async Task<IActionResult> GetCurrentConductor()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                return BadRequest("User ID not found in token");

            var conductor = await _conductorService.GetByUserIdAsync(userId);
            if (conductor == null)
                return NotFound("Conductor profile not found for current user");

            return Ok(conductor);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetConductor(int id)
        {
            var conductor = await _conductorService.GetByIdAsync(id);
            if (conductor == null)
                return NotFound("Conductor not found");

            // Check if user has permission to access this conductor
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
                return BadRequest("User ID not found in token");

            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && conductor.UserId != currentUserId)
                return Forbid("You can only access your own conductor profile");

            return Ok(conductor);
        }

        [HttpDelete("current")]
        public async Task<IActionResult> DeleteCurrentConductor()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                return BadRequest("User ID not found in token");

            var conductor = await _conductorService.GetByUserIdAsync(userId);
            if (conductor == null)
                return NotFound("Conductor profile not found for current user");

            await _conductorService.DeleteByUserIdAsync(userId);
            return Ok(new { message = "Conductor profile deleted successfully" });
        }

        

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateConductor(int id, [FromBody] ConductorUpdateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Check if conductor exists and user has permission to update it
            var conductor = await _conductorService.GetByIdAsync(id);
            if (conductor == null)
                return NotFound("Conductor not found");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
                return BadRequest("User ID not found in token");

            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && conductor.UserId != currentUserId)
                return Forbid("You can only update your own conductor profile");

            await _conductorService.UpdateConductorAsync(id, request);
            return Ok(new { message = "Conductor updated successfully" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteConductor(int id)
        {
            // Check if conductor exists and user has permission to delete it
            var conductor = await _conductorService.GetByIdAsync(id);
            if (conductor == null)
                return NotFound("Conductor not found");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
                return BadRequest("User ID not found in token");

            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && conductor.UserId != currentUserId)
                return Forbid("You can only delete your own conductor profile");

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