// Middleware/AuditLoggingMiddleware.cs
public class AuditLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuditLoggingMiddleware> _logger;

    public AuditLoggingMiddleware(RequestDelegate next, ILogger<AuditLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IAuditLogger auditLogger)
    {
        // Log access to sensitive operations
        if (IsSensitiveOperation(context.Request))
        {
            await auditLogger.LogAsync(
                entityName: "API",
                entityId: context.Request.Path,
                action: "Access",
                additionalInfo: $"Method: {context.Request.Method}"
            );
        }

        await _next(context);
    }

    private bool IsSensitiveOperation(HttpRequest request)
    {
        var sensitivePaths = new[]
        {
            "/api/surveys/create",
            "/api/surveys/delete",
            "/api/participants",
            "/api/survey-sessions"
        };

        return sensitivePaths.Any(path => 
            request.Path.StartsWithSegments(path, StringComparison.OrdinalIgnoreCase));
    }
}