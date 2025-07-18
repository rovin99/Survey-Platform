# SurveyManagementService K-Native Deployment Guide

## 🏗️ Architecture Overview

The SurveyManagementService is a Go-based microservice deployed using K-Native Serving for serverless capabilities with the following components:

- **K-Native Service**: Serverless Go application with auto-scaling (Fiber framework)
- **Migration Job**: GORM-based database schema migrations  
- **Kong Gateway**: API gateway for routing and rate limiting
- **ConfigMap & Secrets**: Configuration and sensitive data management
- **Health Endpoints**: Comprehensive health checks for K-Native probes

## 🔧 Service Configuration

### **Technology Stack**
- **Language**: Go 1.22.1
- **Framework**: Fiber v2 (Fast HTTP framework)
- **ORM**: GORM with PostgreSQL driver
- **Container**: Multi-stage Alpine-based Docker
- **Orchestration**: K-Native Serving

### **Key Features**
- Auto-scaling from 0 to 15 instances
- Health check endpoints (`/health`, `/health/live`, `/health/ready`, `/health/startup`)
- Database connectivity validation
- JWT authentication middleware
- CORS enabled for frontend integration
- Comprehensive logging and error handling

## 📋 Pre-Deployment Checklist

### Prerequisites
- [ ] K-Native Serving installed on cluster
- [ ] Kong API Gateway deployed  
- [ ] PostgreSQL database accessible
- [ ] Container images built and pushed
- [ ] Secrets configured (not hardcoded)
- [ ] AuthService deployed (for JWT validation)

### Environment Variables Required
```bash
# Database Configuration
DB_HOST=postgres-db
DB_PORT=5432
DB_NAME=SurveyDb
DB_USER=${POSTGRES_USER}           # Secret
DB_PASSWORD=${POSTGRES_PASSWORD}   # Secret
DB_SSLMODE=require

# JWT Configuration (must match AuthService)
JWT_SECRET_KEY=${JWT_SECRET_KEY}   # Secret
JWT_ISSUER=AuthService
JWT_AUDIENCE=SurveyApp

# Email Service
EMAIL=${SMTP_EMAIL}                # Secret
APP_PASS=${SMTP_APP_PASSWORD}      # Secret

# Application Environment
ENVIRONMENT=production
GIN_MODE=release
TZ=UTC
```

## 🐳 Image Building

### **Build Commands**
```bash
# Navigate to SurveyManagementService directory
cd SurveyManagementService

# Build main K-Native application image
docker build -f docker/Dockerfile.knative -t rovin123/survey-management-service:v2 .

# Build migration image
docker build -f docker/Dockerfile.migrations -t rovin123/survey-service-migrations:v2 .

# Push images to registry
docker push rovin123/survey-management-service:v2
docker push rovin123/survey-service-migrations:v2
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
kubectl create secret generic survey-service-secrets \
  --from-literal=DB_USER="your-db-user" \
  --from-literal=DB_PASSWORD="your-db-password" \
  --from-literal=JWT_SECRET_KEY="your-jwt-secret-key" \
  --from-literal=EMAIL="your-smtp-email" \
  --from-literal=APP_PASS="your-smtp-password"
```

### **2. Deploy Configuration**
```bash
kubectl apply -f deployments/kubernetes/configmap.yaml
```

### **3. Run Database Migration**
```bash
kubectl apply -f deployments/kubernetes/migration-job.yaml
kubectl wait --for=condition=complete job/survey-service-migration --timeout=300s
```

### **4. Deploy K-Native Service**
```bash
kubectl apply -f k-native-service.yaml
```

### **5. Deploy API Gateway**
```bash
kubectl apply -f kong-gateway.yaml
```

## 🔍 Monitoring & Verification

### **Health Checks**
```bash
# Get K-Native service URL
KSVC_URL=$(kubectl get ksvc survey-management-service -o jsonpath='{.status.url}')

# Test health endpoints
curl $KSVC_URL/health
curl $KSVC_URL/health/live
curl $KSVC_URL/health/ready
curl $KSVC_URL/health/startup
```

### **Service Testing**
```bash
# Test survey API endpoints (requires authentication)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" $KSVC_URL/api/surveys

# Check database connectivity through ready probe
curl $KSVC_URL/health/ready
```

### **Scaling Verification**
```bash
# Watch pods scale up/down
kubectl get pods -l serving.knative.dev/service=survey-management-service -w

# Check service status and revisions
kubectl get ksvc survey-management-service
kubectl get revisions -l serving.knative.dev/service=survey-management-service
```

### **Logs and Debugging**
```bash
# View application logs
kubectl logs -l serving.knative.dev/service=survey-management-service -f

# View migration logs
kubectl logs job/survey-service-migration

# Check service events
kubectl describe ksvc survey-management-service
```

## 🔐 Security Features

### **Container Security**
- ✅ Non-root user execution (UID 1001)
- ✅ Read-only root filesystem with temporary volumes
- ✅ All capabilities dropped
- ✅ RuntimeDefault seccomp profile
- ✅ No privilege escalation allowed

### **Application Security** 
- ✅ JWT authentication middleware on all API routes
- ✅ CORS configuration for frontend integration
- ✅ Input validation with go-playground/validator
- ✅ Secure database connections with SSL
- ✅ Error handling without information leakage

### **Network Security**
- ✅ Kong rate limiting (100 requests/minute)
- ✅ HTTPS enforcement
- ✅ API gateway routing and load balancing

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
- **Container Concurrency**: 15 (Go handles concurrency well)

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
curl $KSVC_URL/health/ready
# Verify database connectivity
kubectl logs -l serving.knative.dev/service=survey-management-service --tail=50
```

### **Issue: Migration job fails**
**Cause**: Database connection or permission issues
**Solution**:
```bash
# Check migration job logs
kubectl logs job/survey-service-migration
# Verify database credentials
kubectl get secret survey-service-secrets -o yaml
```

### **Issue: Authentication failures**
**Cause**: JWT configuration mismatch with AuthService
**Solution**: Ensure JWT_SECRET_KEY matches AuthService configuration

### **Issue: Database connection timeouts**
**Cause**: Resource limits too low or network issues
**Solution**: 
```bash
# Increase resource limits
# Check database network connectivity
kubectl exec -it deployment/survey-management-service -- ping postgres-db
```

## 🔄 Maintenance

### **Updating the Service**
```bash
# Update image version in k-native-service.yaml
# Then apply
kubectl apply -f k-native-service.yaml

# Monitor rollout
kubectl get revisions -l serving.knative.dev/service=survey-management-service
```

### **Database Migrations**
```bash
# Run new migrations
kubectl delete job survey-service-migration  # Clean up old job
kubectl apply -f deployments/kubernetes/migration-job.yaml
```

### **Scaling Configuration**
```bash
# Update autoscaling parameters
kubectl patch ksvc survey-management-service -p '{"spec":{"template":{"metadata":{"annotations":{"autoscaling.knative.dev/maxScale":"20"}}}}}'
```

## 📈 API Endpoints

### **Health Endpoints**
- `GET /health` - Basic health status
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe (includes DB check)
- `GET /health/startup` - Startup probe (comprehensive check)

### **Survey API Endpoints** (Require Authentication)
- `GET /api/surveys` - List surveys
- `POST /api/surveys` - Create survey
- `GET /api/surveys/{id}` - Get survey details
- `PUT /api/surveys/{id}` - Update survey
- `DELETE /api/surveys/{id}` - Delete survey

### **Questions API Endpoints**
- `POST /api/questions` - Create question
- `GET /api/questions/{id}` - Get question
- `PUT /api/questions/{id}` - Update question
- `DELETE /api/questions/{id}` - Delete question

## 🏷️ Labels and Annotations

### **K-Native Service Labels**
```yaml
metadata:
  labels:
    app: survey-management-service
    version: v1
spec:
  template:
    metadata:
      labels:
        app: survey-management-service
        version: v1
```

### **Monitoring Integration**
K-Native automatically exposes metrics for:
- Request count and latency per revision
- Pod scaling events and cold starts
- Error rates and response codes
- Memory and CPU usage

## 📋 Directory Structure

```
SurveyManagementService/
├── Dockerfile                     # Local development
├── Dockerfile.knative            # K-Native optimized
├── Dockerfile.migrations         # Database migrations
├── k-native-service.yaml         # Main K-Native service
├── kong-gateway.yaml            # API gateway config
├── deployments/
│   └── kubernetes/
│       ├── configmap.yaml        # Configuration
│       ├── secrets.template.yaml # Secure secrets template
│       └── migration-job.yaml    # DB migration job
├── main.go                      # Application entry point
├── go.mod                       # Go dependencies
└── [source code directories]
```

---

**Last Updated**: $(date '+%Y-%m-%d %H:%M:%S')
**Version**: v2.0  
**Service**: SurveyManagementService
**Platform**: K-Native Serving 