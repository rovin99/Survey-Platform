# ParticipantsManagementService Knative Deployment Guide

## 🏗️ Architecture Overview

The ParticipantsManagementService is a Go-based microservice deployed using Knative Serving for serverless capabilities with the following components:

- **Knative Service**: Serverless Go application with auto-scaling (Fiber framework)
- **Migration Job**: GORM-based database schema migrations  
- **ConfigMap & Secrets**: Configuration and sensitive data management
- **Health Endpoints**: Health checks for Knative probes

## 🔧 Service Configuration

### **Technology Stack**
- **Language**: Go 1.24.0
- **Framework**: Fiber v2 (Fast HTTP framework)
- **ORM**: GORM with PostgreSQL driver
- **Container**: Multi-stage Alpine-based Docker
- **Orchestration**: Knative Serving

### **Key Features**
- Auto-scaling from 0 to 15 instances
- Health check endpoints (`/health`)
- Database connectivity validation
- Session management for survey participants
- Answer tracking and draft saving
- Media file management
- CORS enabled for frontend integration

## 📋 Pre-Deployment Checklist

### Prerequisites
- [ ] Knative Serving installed on cluster
- [ ] PostgreSQL database accessible
- [ ] Container images built and pushed
- [ ] Secrets configured (not hardcoded)
- [ ] AuthService deployed (for JWT validation if needed)
- [ ] SurveyManagementService deployed (for survey data)

### Environment Variables Required
```bash
# Database Configuration
DB_HOST=postgres-db.database.svc.cluster.local
DB_PORT=5432
DB_NAME=SurveyDb
DB_USER=${POSTGRES_USER}           # Secret
DB_PASSWORD=${POSTGRES_PASSWORD}   # Secret
DB_SSLMODE=disable

# JWT Configuration (if authentication is needed)
JWT_SECRET_KEY=${JWT_SECRET_KEY}   # Secret

# Application Environment
APP_ENV=production
GIN_MODE=release
PORT=8080
TZ=UTC
```

## 🐳 Image Building

### **Build Commands**
```bash
# Navigate to ParticipantsManagementService directory
cd ParticipantsManagementService

# Build main Knative application image
docker build -f docker/Dockerfile.knative -t rovin123/participants-management-service:v1 .

# Build migration image
docker build -f docker/Dockerfile.migrations -t rovin123/participants-service-migrations:v1 .

# Push images to registry
docker push rovin123/participants-management-service:v1
docker push rovin123/participants-service-migrations:v1
```

### **Image Optimization**
- ✅ Multi-stage builds (builder + runtime)
- ✅ Static binary compilation (CGO_ENABLED=0)
- ✅ Minimal Alpine base image (~10MB)
- ✅ Non-root user execution (UID 1001)
- ✅ Read-only root filesystem
- ✅ Signal handling with dumb-init

## 🚀 Deployment Steps

### **1. Configure Secrets**
```bash
# Create secrets from template (replace with actual values)
envsubst < deployments/kubernetes/secrets.template.yaml | kubectl apply -f -

# Or use kubectl directly
kubectl create secret generic participants-service-secrets \
  --from-literal=DB_USER="postgres" \
  --from-literal=DB_PASSWORD="your-db-password" \
  --from-literal=JWT_SECRET_KEY="your-jwt-secret-key" \
  --namespace=default
```

### **2. Deploy Configuration**
```bash
kubectl apply -f deployments/kubernetes/configmap.yaml
```

### **3. Run Database Migration**
```bash
kubectl apply -f deployments/kubernetes/migration-job.yaml
kubectl wait --for=condition=complete job/participants-service-migration --timeout=300s

# Check migration logs
kubectl logs job/participants-service-migration
```

### **4. Deploy Knative Service**
```bash
kubectl apply -f deployments/kubernetes/knative-service.yaml

# Wait for service to be ready
kubectl get ksvc participants-management-service -w
```

## 🔍 Monitoring & Verification

### **Health Checks**
```bash
# Get Knative service URL
KSVC_URL=$(kubectl get ksvc participants-management-service -o jsonpath='{.status.url}')

# Test health endpoint
curl $KSVC_URL/health
```

### **Service Testing**
```bash
# Test session endpoints (may require authentication)
curl -X GET $KSVC_URL/api/sessions

# Check database connectivity through health probe
curl $KSVC_URL/health
```

### **Scaling Verification**
```bash
# Watch pods scale up/down
kubectl get pods -l serving.knative.dev/service=participants-management-service -w

# Check service status and revisions
kubectl get ksvc participants-management-service
kubectl get revisions -l serving.knative.dev/service=participants-management-service
```

### **Logs and Debugging**
```bash
# View application logs
kubectl logs -l serving.knative.dev/service=participants-management-service -f

# View migration logs
kubectl logs job/participants-service-migration

# Check service events
kubectl describe ksvc participants-management-service
```

## 🔐 Security Features

### **Container Security**
- ✅ Non-root user execution (UID 1001)
- ✅ Read-only root filesystem with temporary volumes
- ✅ All capabilities dropped
- ✅ RuntimeDefault seccomp profile
- ✅ No privilege escalation allowed

### **Application Security** 
- ✅ Input validation with GORM
- ✅ Secure database connections
- ✅ CORS configuration for frontend integration
- ✅ Error handling without information leakage

### **Network Security**
- ✅ Knative service isolation
- ✅ API gateway routing (when configured)
- ✅ Load balancing

## 📊 Performance Configuration

### **Autoscaling Settings**
```yaml
annotations:
  autoscaling.knative.dev/target: "10"        # Requests per pod
  autoscaling.knative.dev/minScale: "0"       # Scale to zero
  autoscaling.knative.dev/maxScale: "15"      # Max replicas
  autoscaling.knative.dev/scaleDownDelay: "30s"
  autoscaling.knative.dev/window: "60s"
```

### **Resource Optimization**
- **CPU Request**: 100m (adequate for Go startup)
- **Memory Request**: 128Mi (sufficient for Go application)
- **CPU Limit**: 1000m (allows burst capacity)
- **Memory Limit**: 512Mi (prevents OOM)
- **Container Concurrency**: 20 (Fiber handles concurrency well)

### **Cold Start Optimization**
- Static binary compilation for faster startup
- Efficient health check intervals
- GOMEMLIMIT=128MiB for memory efficiency
- Database connection pooling in GORM

## 🚨 Common Issues & Troubleshooting

### **Issue: Service not scaling to zero**
**Cause**: Health checks failing
**Solution**: 
```bash
# Check health endpoint responses
curl $KSVC_URL/health
# Verify database connectivity
kubectl logs -l serving.knative.dev/service=participants-management-service --tail=50
```

### **Issue: Migration job fails**
**Cause**: Database connection or permission issues
**Solution**:
```bash
# Check migration job logs
kubectl logs job/participants-service-migration
# Verify database credentials
kubectl get secret participants-service-secrets -o yaml
```

### **Issue: Database connection timeouts**
**Cause**: Resource limits too low or network issues
**Solution**: 
```bash
# Increase resource limits
# Check database network connectivity
kubectl get svc -n database
```

## 🔄 Maintenance

### **Updating the Service**
```bash
# Update image version in knative-service.yaml
# Then apply
kubectl apply -f deployments/kubernetes/knative-service.yaml

# Monitor rollout
kubectl get revisions -l serving.knative.dev/service=participants-management-service
```

### **Database Migrations**
```bash
# Run new migrations
kubectl delete job participants-service-migration  # Clean up old job
kubectl apply -f deployments/kubernetes/migration-job.yaml
```

### **Scaling Configuration**
```bash
# Update autoscaling parameters
kubectl patch ksvc participants-management-service -p '{"spec":{"template":{"metadata":{"annotations":{"autoscaling.knative.dev/maxScale":"20"}}}}}'
```

## 📈 API Endpoints

### **Health Endpoints**
- `GET /health` - Basic health status

### **Session Management Endpoints** (Require Authentication)
- `GET /api/sessions` - List survey sessions
- `POST /api/sessions` - Create survey session
- `GET /api/sessions/{id}` - Get session details
- `PUT /api/sessions/{id}` - Update session
- `DELETE /api/sessions/{id}` - Delete session

### **Answer Endpoints**
- `POST /api/answers` - Submit answer
- `GET /api/answers/{session_id}` - Get session answers
- `PUT /api/answers/{id}` - Update answer

### **Draft Management**
- `POST /api/drafts` - Save draft
- `GET /api/drafts/{session_id}` - Get draft
- `PUT /api/drafts/{session_id}` - Update draft

### **Media File Endpoints**
- `POST /api/media` - Upload media file
- `GET /api/media/{session_id}` - Get session media files

## 🏷️ Labels and Annotations

### **Knative Service Labels**
```yaml
metadata:
  labels:
    app: participants-management-service
    version: v1
spec:
  template:
    metadata:
      labels:
        app: participants-management-service
        version: v1
```

### **Monitoring Integration**
Knative automatically exposes metrics for:
- Request count and latency per revision
- Pod scaling events and cold starts
- Error rates and response codes
- Memory and CPU usage

## 📋 Database Schema

The service manages the following tables:
- **survey_sessions** - Tracks participant survey attempts
- **answers** - Stores final submitted answers
- **participant_survey_drafts** - Auto-saved draft responses
- **survey_media_files** - Uploaded media files (images, videos, etc.)

---

**Last Updated**: November 15, 2025
**Version**: v1.0  
**Service**: ParticipantsManagementService
**Platform**: Knative Serving

