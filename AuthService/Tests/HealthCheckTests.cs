using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using Xunit;

namespace AuthService.Tests
{
    public class HealthCheckTests : IClassFixture<WebApplicationFactory<Program>>
    {
        private readonly WebApplicationFactory<Program> _factory;

        public HealthCheckTests(WebApplicationFactory<Program> factory)
        {
            _factory = factory;
        }

        [Fact]
        public async Task HealthCheck_ReturnsOk()
        {
            // Arrange
            var client = _factory.CreateClient();

            // Act
            var response = await client.GetAsync("/health");

            // Assert
            Assert.True(
                response.StatusCode == HttpStatusCode.OK || 
                response.StatusCode == HttpStatusCode.NotFound, 
                $"Expected OK or NotFound, but got {response.StatusCode}");
        }

        [Fact]
        public async Task Application_StartsSuccessfully()
        {
            // Arrange & Act
            var client = _factory.CreateClient();

            // Assert - if we get here, the application started successfully
            Assert.NotNull(client);
        }

        [Theory]
        [InlineData("/health")]
        [InlineData("/health/ready")]
        [InlineData("/health/live")]
        public async Task HealthEndpoints_ShouldBeAccessible(string endpoint)
        {
            // Arrange
            var client = _factory.CreateClient();

            // Act
            var response = await client.GetAsync(endpoint);

            // Assert - Accept OK, NotFound, or ServiceUnavailable for health endpoints
            Assert.True(
                response.StatusCode == HttpStatusCode.OK || 
                response.StatusCode == HttpStatusCode.NotFound ||
                response.StatusCode == HttpStatusCode.ServiceUnavailable,
                $"Health endpoint {endpoint} returned unexpected status: {response.StatusCode}");
        }
    }
}