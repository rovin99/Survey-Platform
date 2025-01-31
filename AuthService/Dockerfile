# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore dependencies
COPY ["AuthService.csproj", "./"]
RUN dotnet restore

#Build
COPY . .
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
COPY .env .

# Install the dotnet-env package
RUN apt-get update && apt-get install -y curl
RUN curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin -Channel Current

ENV ASPNETCORE_URLS=http://+:5001
ENV ASPNETCORE_ENVIRONMENT=Development

EXPOSE 5000

ENTRYPOINT ["dotnet", "AuthService.dll"]