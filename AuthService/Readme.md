# Authentication Service API Documentation

## Overview
The Authentication Service is a .NET-based RESTful API that provides user authentication, registration, and role management functionality. This service uses JWT (JSON Web Tokens) for authentication and supports role-based access control.

## Base URL
```
/api/Auth
```

## Authentication
- Protected endpoints require a valid JWT token in the Authorization header
- Format: `Authorization: Bearer {token}`
- Tokens are obtained through the login endpoint

## Endpoints

### 1. Register User
Creates a new user account.

**Endpoint:** `POST /api/Auth/register`

**Request Body:**
```json
{
    "username": "string",
    "email": "string",
    "password": "string"
}
```

**Validation Rules:**
- Username: 2-20 characters, alphanumeric with underscores only
- Email: Valid email format required
- Password: Minimum 6 characters

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "User registered successfully",
    "data": {
        "userId": "integer",
        "username": "string",
        "email": "string"
    },
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 400 Bad Request (Validation Error)
```json
{
    "success": false,
    "message": "Validation failed",
    "data": null,
    "statusCode": 400,
    "error": {
        "message": "Validation failed",
        "code": "VALIDATION_ERROR",
        "details": [
            "Username must be between 2 and 20 characters",
            "A valid email address is required"
        ]
    }
}
```
- 409 Conflict (Duplicate User)
```json
{
    "success": false,
    "message": "Username or email already exists",
    "data": null,
    "statusCode": 409,
    "error": {
        "message": "Username or email already exists",
        "code": "DUPLICATE_ERROR"
    }
}
```

### 2. Login
Authenticates a user and returns a JWT token.

**Endpoint:** `POST /api/Auth/login`

**Request Body:**
```json
{
    "username": "string",
    "password": "string"
}
```

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "token": "string"
    },
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 401 Unauthorized
```json
{
    "success": false,
    "message": "Invalid username or password",
    "data": null,
    "statusCode": 401,
    "error": {
        "message": "Invalid username or password",
        "code": "INVALID_CREDENTIALS"
    }
}
```

### 3. Get Current User
Returns the profile of the currently authenticated user.

**Endpoint:** `GET /api/Auth/user`

**Authorization:** Required (Bearer Token)

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "User retrieved successfully",
    "data": {
        "userId": "integer",
        "username": "string",
        "email": "string"
    },
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 401 Unauthorized (Invalid/Missing Token)
- 404 Not Found (User not found)

### 4. Get All Users
Returns a list of all users (Admin only).

**Endpoint:** `GET /api/Auth/users`

**Authorization:** Required (Bearer Token with Admin role)

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "Users retrieved successfully",
    "data": [
        {
            "userId": "integer",
            "username": "string",
            "email": "string"
        }
    ],
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 401 Unauthorized (Invalid/Missing Token)
- 403 Forbidden (Non-Admin User)

### 5. Add User Role
Assigns a role to a user (Admin only).

**Endpoint:** `POST /api/Auth/users/{userId}/roles`

**Authorization:** Required (Bearer Token with Admin role)

**URL Parameters:**
- userId: Integer (User ID)

**Request Body:**
```json
{
    "userId": "integer",
    "roleName": "string"
}
```

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "Role '{roleName}' added to user successfully",
    "data": null,
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 400 Bad Request (User ID mismatch)
- 401 Unauthorized
- 403 Forbidden (Non-Admin User)

### 6. Remove User Role
Removes a role from a user (Admin only).

**Endpoint:** `DELETE /api/Auth/users/{userId}/roles`

**Authorization:** Required (Bearer Token with Admin role)

**URL Parameters:**
- userId: Integer (User ID)

**Request Body:**
```json
{
    "userId": "integer",
    "roleName": "string"
}
```

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "Role '{roleName}' removed from user successfully",
    "data": null,
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 400 Bad Request (User ID mismatch)
- 401 Unauthorized
- 403 Forbidden (Non-Admin User)


## Installation and Setup Guide



#### Steps to Run Locally

1. **Clone the Repository**
```bash
git clone <repository-url>
cd AuthService
```

2. **Configure Environment Variables**
Create a `.env` file in the root directory:
```env
# Database Configuration
DB_CONNECTION_STRING=Server=localhost;Database=AuthDB;User Id=sa;Password=YourPassword;TrustServerCertificate=True

# JWT Configuration
JWT_KEY=your_secure_jwt_key_here
JWT_ISSUER=your_issuer
JWT_AUDIENCE=your_audience
JWT_DURATION_MINUTES=60

# App Configuration
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=http://localhost:5000
```

3. **Restore Dependencies**
```bash
dotnet restore
```

4. **Update Database**
```bash
dotnet ef database update
```

5. **Run the Application**
```bash
dotnet run
```

The API will be available at `http://localhost:5000`

### Docker Deployment

#### Prerequisites
- Docker Desktop
- Docker Compose (optional, for multi-container deployments)

#### Using Docker

1. **Build the Docker Image**
```bash
docker build -t auth-service .
```

2. **Run the Container**
```bash
docker run -d \
  --name auth-service \
  -p 5000:5000 \
  -e DB_CONNECTION_STRING="Server=host.docker.internal;Database=AuthDB;User Id=sa;Password=YourPassword;TrustServerCertificate=True" \
  -e JWT_KEY="your_secure_jwt_key_here" \
  -e JWT_ISSUER="your_issuer" \
  -e JWT_AUDIENCE="your_audience" \
  -e JWT_DURATION_MINUTES="60" \
  auth-service
```


2. **Test Registration Endpoint**
```bash
curl -X POST http://localhost:5000/api/Auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!"
  }'
```


3. **Useful Commands**
```bash
# Clean solution
dotnet clean

# Run tests
dotnet test

# Watch for changes
dotnet watch run

# Generate EF migrations
dotnet ef migrations add MigrationName

# Remove last migration
dotnet ef migrations remove
```
