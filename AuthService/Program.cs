using System.Text;
using AuthService.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using AuthService.Services;
using Npgsql.EntityFrameworkCore.PostgreSQL;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotNetEnv; // Add this
using AuthService.Repositories;
using AuthService.HealthChecks; // Add health checks
using AuthService; // Adjust the namespace as necessary
var builder = WebApplication.CreateBuilder(args);

// Load environment variables
Env.Load();

// Validate required environment variables
var requiredEnvVars = new Dictionary<string, string>
{
    { "CONNECTION_STRING", Environment.GetEnvironmentVariable("CONNECTION_STRING") ?? "" },
    { "JWT_KEY", Environment.GetEnvironmentVariable("JWT_KEY") ?? "" },
    { "JWT_ISSUER", Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "" },
    { "JWT_AUDIENCE", Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "" },
    { "JWT_DURATION", Environment.GetEnvironmentVariable("JWT_DURATION") ?? "" }
};

var missingVars = requiredEnvVars.Where(kvp => string.IsNullOrEmpty(kvp.Value)).Select(kvp => kvp.Key).ToList();
if (missingVars.Any())
{
    Console.Error.WriteLine($"CRITICAL ERROR: Missing required environment variables: {string.Join(", ", missingVars)}");
    Environment.Exit(1);
}

// Validate JWT_KEY minimum length for security
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY") ?? "";
if (jwtKey.Length < 32)
{
    Console.Error.WriteLine("CRITICAL ERROR: JWT_KEY must be at least 32 characters long for security");
    Environment.Exit(1);
}

builder.Configuration["ConnectionStrings:DefaultConnection"] = Environment.GetEnvironmentVariable("CONNECTION_STRING");
builder.Configuration["Jwt:Key"] = Environment.GetEnvironmentVariable("JWT_KEY");
builder.Configuration["Jwt:Issuer"] = Environment.GetEnvironmentVariable("JWT_ISSUER");
builder.Configuration["Jwt:Audience"] = Environment.GetEnvironmentVariable("JWT_AUDIENCE");
builder.Configuration["Jwt:DurationInMinutes"] = Environment.GetEnvironmentVariable("JWT_DURATION");

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

// Configure anti-forgery services
builder.Services.AddAntiforgery(options =>
{
    options.Cookie.Name = "csrf-token";
    options.Cookie.HttpOnly = false; // Allow JavaScript access
    options.Cookie.SameSite = SameSiteMode.Strict;
    // Allow HTTP in development, require HTTPS in production
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() 
        ? CookieSecurePolicy.None 
        : CookieSecurePolicy.Always;
    options.HeaderName = "X-CSRF-TOKEN";
});
builder.Services.AddScoped<IAuthService, AuthenticationService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRoleRepository, RoleRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<IConductorService, ConductorService>();
builder.Services.AddScoped<IConductorRepository, ConductorRepository>();
builder.Services.AddScoped<IParticipantService, ParticipantService>();
builder.Services.AddScoped<IParticipantRepository, ParticipantRepository>();

// Add background services
builder.Services.AddHostedService<TokenCleanupService>();

// Add health checks
builder.Services.AddCustomHealthChecks();

// Configure CORS securely for different environments
builder.Services.AddCors(options =>
{
    options.AddPolicy("ConfiguredCorsPolicy", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // For local development, allow these specific origins.
            policy.WithOrigins("http://localhost:3000", "http://localhost:5000", "http://localhost:5001", "http://localhost:8080","http://localhost:8081")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            // For production, only allow the specific frontend origin.
            // This URL MUST be configured in your production environment variables.
            var productionUrl = Environment.GetEnvironmentVariable("PRODUCTION_URL");
            if (!string.IsNullOrEmpty(productionUrl))
            {
                policy.WithOrigins(productionUrl)
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            }
            // If PRODUCTION_URL is not set, no origins will be allowed by this policy in production.
        }
    });
});

// Configure PostgreSQL with Entity Framework Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.Configure<EmailServiceSettings>(options =>
{
    options.BaseUrl = Environment.GetEnvironmentVariable("EMAIL_SERVICE_BASE_URL") ?? "http://localhost:5000";
    options.TimeoutSeconds = int.Parse(Environment.GetEnvironmentVariable("EMAIL_SERVICE_TIMEOUT") ?? "30");
});
builder.Services.AddHttpClient<IEmailService, EmailService>();
// Configure JWT authentication with support for both cookies and Authorization headers

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                // First, check for token in HttpOnly cookie
                var cookieToken = context.Request.Cookies["accessToken"];
                if (!string.IsNullOrEmpty(cookieToken))
                {
                    context.Token = cookieToken;
                }
                
                // If not in cookie, check Authorization header (for microservices)
                if (string.IsNullOrEmpty(context.Token))
                {
                    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
                    if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
                    {
                        context.Token = authHeader.Substring(7);
                    }
                }
                
                return Task.CompletedTask;
            }
        };
        
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])),
            ClockSkew = TimeSpan.Zero // Reduce token lifetime tolerance
        };
    });

// Build the application
var app = builder.Build();

// Call the seeder method
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        await DatabaseSeeder.SeedRolesAndUsers(services);
    }
    catch (Exception ex)
    {
        // Handle exceptions
        Console.WriteLine($"An error occurred while seeding the database: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();

// Add CORS middleware - this must be called before Authentication and Authorization
app.UseCors("ConfiguredCorsPolicy");

// Add rate limiting middleware
// app.UseRateLimiter(); // Temporarily removed

app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    // Security headers
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none';");
    context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    
    await next();
});

// The insecure and duplicate CORS middleware has been removed.
// All CORS policy is now configured securely in one place above.

app.MapControllers();

// Map health check endpoints
app.MapCustomHealthChecks();

app.Run();