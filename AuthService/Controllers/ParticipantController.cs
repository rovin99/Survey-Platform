using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using AuthService.Services;
using AuthService.Models;
using AuthService.Utils;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ParticipantController : ControllerBase
    {
        private readonly IParticipantService _participantService;

        public ParticipantController(IParticipantService participantService)
        {
            _participantService = participantService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] ParticipantRegistrationRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                return BadRequest(ResponseUtil.BadRequest<object>("User ID not found in token"));

            var response = await _participantService.RegisterParticipantAsync(userId, request);
            return StatusCode(response.StatusCode, response);
        }

        [HttpGet("~/api/Participant/current")]
        public async Task<IActionResult> GetCurrentParticipant()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                return BadRequest(ResponseUtil.BadRequest<object>("User ID not found in token"));

            var participant = await _participantService.GetByUserIdAsync(userId);
            if (participant == null || !participant.Success)
                return NotFound(ResponseUtil.NotFound<object>("Participant profile not found for current user"));

            return Ok(participant);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var response = await _participantService.GetByIdAsync(id);
            if (response.StatusCode == 404)
                return StatusCode(response.StatusCode, response);

            // Check if user has permission to access this participant
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
                return BadRequest(ResponseUtil.BadRequest<object>("User ID not found in token"));

            var isAdmin = User.IsInRole("Admin");
            // Assuming the response data contains the participant with UserId
            if (response.Data != null && response.Data is Participant participant)
            {
                if (!isAdmin && participant.UserId != currentUserId)
                    return Forbid("You can only access your own participant profile");
            }

            return StatusCode(response.StatusCode, response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ParticipantUpdateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Check if participant exists and user has permission to update it
            var getResponse = await _participantService.GetByIdAsync(id);
            if (getResponse.StatusCode == 404)
                return StatusCode(getResponse.StatusCode, getResponse);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
                return BadRequest(ResponseUtil.BadRequest<object>("User ID not found in token"));

            var isAdmin = User.IsInRole("Admin");
            if (getResponse.Data != null && getResponse.Data is Participant participant)
            {
                if (!isAdmin && participant.UserId != currentUserId)
                    return Forbid("You can only update your own participant profile");
            }

            var response = await _participantService.UpdateParticipantAsync(id, request);
            return StatusCode(response.StatusCode, response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            // Check if participant exists and user has permission to delete it
            var getResponse = await _participantService.GetByIdAsync(id);
            if (getResponse.StatusCode == 404)
                return StatusCode(getResponse.StatusCode, getResponse);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
                return BadRequest(ResponseUtil.BadRequest<object>("User ID not found in token"));

            var isAdmin = User.IsInRole("Admin");
            if (getResponse.Data != null && getResponse.Data is Participant participant)
            {
                if (!isAdmin && participant.UserId != currentUserId)
                    return Forbid("You can only delete your own participant profile");
            }

            var response = await _participantService.DeleteParticipantAsync(id);
            return StatusCode(response.StatusCode, response);
        }

        [HttpGet]
        public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int limit = 10)
        {
            var response = await _participantService.ListParticipantsAsync(page, limit);
            return StatusCode(response.StatusCode, response);
        }
    }
}
