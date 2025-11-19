# ParticipantsManagementService Docker Images

This directory contains Dockerfiles for the ParticipantsManagementService deployment.

## 📦 Available Dockerfiles

### 1. **Dockerfile** (Standard Deployment)
- **Purpose**: General-purpose deployment
- **Port**: 8081 (default) or 8080 (Knative variant)
- **Base**: Alpine Linux
- **Features**: Multi-stage build, health checks, non-root user

**Build:**
```bash
docker build -f Dockerfile -t rovin123/participants-management-service:v1 .
```

### 2. **Dockerfile.knative** (Knative Optimized)
- **Purpose**: Knative/serverless deployment
- **Port**: 8080 (Knative standard)
- **Optimizations**: 
  - dumb-init for signal handling
  - GOMEMLIMIT for memory efficiency
  - Extra temp directories for read-only filesystem
  - Security hardened

**Build:**
```bash
docker build -f Dockerfile.knative -t rovin123/participants-management-service:v1 .
```

### 3. **Dockerfile.migrations** (Database Migrations)
- **Purpose**: Run database migrations
- **Models**: SurveySession, Answer, ParticipantSurveyDraft, SurveyMediaFile
- **Uses**: GORM AutoMigrate

**Build:**
```bash
docker build -f Dockerfile.migrations -t rovin123/participants-service-migrations:v1 .
```

## 🚀 Quick Start

### Build All Images
```bash
# Navigate to service directory
cd ParticipantsManagementService

# Build main application
docker build -f docker/Dockerfile.knative -t rovin123/participants-management-service:v1 .

# Build migrations
docker build -f docker/Dockerfile.migrations -t rovin123/participants-service-migrations:v1 .

# Push to registry
docker push rovin123/participants-management-service:v1
docker push rovin123/participants-service-migrations:v1
```

### Local Testing
```bash
# Run locally with environment variables
docker run -p 8080:8080 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_NAME=SurveyDb \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres123 \
  -e DB_SSLMODE=disable \
  rovin123/participants-management-service:v1
```

## 🔧 Configuration

### Environment Variables

**Required:**
- `DB_HOST` - Database host
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database username (secret)
- `DB_PASSWORD` - Database password (secret)

**Optional:**
- `DB_SSLMODE` - SSL mode (default: disable)
- `PORT` - Application port (default: 8080)
- `APP_ENV` - Environment (production/development)
- `JWT_SECRET_KEY` - JWT validation key

## 📊 Image Sizes (Approximate)

- **participants-management-service:v1**: ~20-25 MB
- **participants-service-migrations:v1**: ~20 MB

## 🔐 Security Features

- ✅ Non-root user (UID 1001)
- ✅ Read-only root filesystem support
- ✅ Static binary (no dynamic linking)
- ✅ Minimal attack surface (Alpine base)
- ✅ Health checks included
- ✅ Signal handling (dumb-init)

## 🏗️ Build Arguments

Currently no build arguments are used. All configuration is done via environment variables at runtime.

## 📝 Notes

- Images are built for `linux/amd64` architecture
- Go version: 1.24.0
- Framework: Fiber v2
- ORM: GORM
- All images use Alpine 3.19 for minimal size

---

**Created**: November 15, 2025  
**Maintained by**: DevOps Team

