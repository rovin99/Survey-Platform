
// using System.Security.Claims;
// using System.Text;
// using AuthService.Models;
// using Microsoft.AspNetCore.Http;
// using Microsoft.IdentityModel.Tokens;

// namespace AuthService.Services
// public class AuditLogger : IAuditLogger
// {
//     private readonly DbContext _dbContext;
//     private readonly IHttpContextAccessor _httpContextAccessor;
//     private readonly ILogger<AuditLogger> _logger;

//     public AuditLogger(
//         DbContext dbContext,
//         IHttpContextAccessor httpContextAccessor,
//         ILogger<AuditLogger> logger)
//     {
//         _dbContext = dbContext;
//         _httpContextAccessor = httpContextAccessor;
//         _logger = logger;
//     }

//     public async Task LogAsync(
//         string entityName,
//         string entityId,
//         string action,
//         object oldValues = null,
//         object newValues = null,
//         string additionalInfo = null)
//     {
//         try
//         {
//             var httpContext = _httpContextAccessor.HttpContext;
//             var user = httpContext?.User;

//             var auditLog = new AuditLog
//             {
//                 Timestamp = DateTime.UtcNow,
//                 EntityName = entityName,
//                 EntityId = entityId,
//                 Action = action,
//                 UserId = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value,
//                 UserName = user?.FindFirst(ClaimTypes.Name)?.Value,
//                 OldValues = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
//                 NewValues = newValues != null ? JsonSerializer.Serialize(newValues) : null,
//                 IpAddress = httpContext?.Connection?.RemoteIpAddress?.ToString(),
//                 UserAgent = httpContext?.Request?.Headers["User-Agent"].ToString(),
//                 AdditionalInfo = additionalInfo
//             };

//             _dbContext.Set<AuditLog>().Add(auditLog);
//             await _dbContext.SaveChangesAsync();
//         }
//         catch (Exception ex)
//         {
//             _logger.LogError(ex, "Failed to create audit log for {EntityName} {EntityId}", entityName, entityId);
//             throw;
//         }
//     }

//     public async Task<IEnumerable<AuditLog>> GetAuditLogsAsync(string entityName, string entityId)
//     {
//         return await _dbContext.Set<AuditLog>()
//             .Where(log => log.EntityName == entityName && log.EntityId == entityId)
//             .OrderByDescending(log => log.Timestamp)
//             .ToListAsync();
//     }
// }
