using AuthService.Models;
public interface IAuditLogger
{
    Task LogAsync(string entityName, string entityId, string action, 
        object? oldValues = null, object? newValues = null, string? additionalInfo = null);
    Task<IEnumerable<AuditLog>> GetAuditLogsAsync(string entityName, string entityId);
}
