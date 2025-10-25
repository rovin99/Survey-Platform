# AuthService K-Native Deployment Best Practices

## 🏗️ Architecture Overview

The AuthService is deployed using K-Native Serving for serverless capabilities with the following components:

- **K-Native Service**: Serverless application deployment with auto-scaling
- **Migration Job**: Database schema migrations
- **Seeder Job**: Initial data seeding
- **Kong Gateway**: API gateway for routing and rate limiting
- **ConfigMap & Secrets**: Configuration and sensitive data management

## 🔧 Fixed Issues & Best Practices

### 1. **Port Configuration** ✅
- **Issue**: Port conflicts between hardcoded values and K-Native injection
- **Fix**: Use consistent port 8080 throughout all configurations
- **Best Practice**: Let K-Native handle port injection automatically

### 2. **Security Enhancements** ✅
- **Non-root user**: Container runs as UID 1000
- **Read-only filesystem**: Enhanced security posture
- **Capability dropping**: Remove all unnecessary capabilities
- **Security profiles**: Use RuntimeDefault seccomp profile

### 3. **Secrets Management** ✅
- **Issue**: Hardcoded secrets in YAML files
- **Fix**: Created template with environment variable substitution
- **Best Practice**: Use external secret operators for production

### 4. **Resource Management** ✅
- **Proper resource requests/limits**
- **Autoscaling configuration**
- **Scale-to-zero capability**

## 📋 Pre-Deployment Checklist

### Prerequisites
- [ ] K-Native Serving installed on cluster
- [ ] Kong API Gateway deployed
- [ ] PostgreSQL database accessible
- [ ] Container images built and pushed
- [ ] Secrets configured (not hardcoded)

### Image Building
```bash
# Build main application image
docker build -f docker/Dockerfile.knative -t rovin123/auth-service:v2 .

# Build migration image
docker build -f docker/Dockerfile.migrations -t rovin123/auth-service-migrations:v2 .

# Build seeder image
docker build -f docker/Dockerfile.seeder -t rovin123/auth-service-seeder:v2 .

# Push images
docker push rovin123/auth-service:v2
docker push rovin123/auth-service-migrations:v2
docker push rovin123/auth-service-seeder:v2
```

## 🚀 Deployment Steps

### 1. **Configure Secrets**
```bash
# Create secrets from template (replace with actual values)
envsubst < secrets.template.yaml | kubectl apply -f -

# Or use kubectl directly
kubectl create secret generic auth-service-secrets \
  --from-literal=CONNECTION_STRING="Host=postgres;Port=5432;Database=SurveyDb;Username=user;Password=pass" \
  --from-literal=JWT_KEY="your-256-bit-secret-key-here" \
  --from-literal=JWT_ISSUER="AuthService" \
  --from-literal=JWT_AUDIENCE="SurveyApp" \
  --from-literal=JWT_DURATION="60"
```

### 2. **Deploy Configuration**
```bash
kubectl apply -f configmap.yaml
```

### 3. **Run Database Migration**
```bash
kubectl apply -f migration-job.yaml
kubectl wait --for=condition=complete job/auth-service-migration --timeout=300s
```

### 4. **Run Database Seeding**
```bash
kubectl apply -f seeder-job.yaml
kubectl wait --for=condition=complete job/auth-service-seeder --timeout=300s
```

### 5. **Deploy K-Native Service**
```bash
kubectl apply -f knative-service.yaml
```

### 6. **Deploy API Gateway**
```bash
kubectl apply -f kong-gateway.yaml
```

## 🔍 Monitoring & Verification

### Health Checks
```bash
# Get K-Native service URL
KSVC_URL=$(kubectl get ksvc auth-service -o jsonpath='{.status.url}')

# Test health endpoints
curl $KSVC_URL/health/live
curl $KSVC_URL/health/ready
curl $KSVC_URL/health/startup
```

### Scaling Verification
```bash
# Watch pods scale up/down
kubectl get pods -l serving.knative.dev/service=auth-service -w

# Check service status
kubectl get ksvc auth-service
```

### Logs
```bash
# View application logs
kubectl logs -l serving.knative.dev/service=auth-service -f

# View migration logs
kubectl logs job/auth-service-migration

# View seeder logs
kubectl logs job/auth-service-seeder
```

## 🔐 Security Best Practices

### 1. **Container Security**
- ✅ Non-root user execution
- ✅ Read-only root filesystem
- ✅ Capability dropping
- ✅ Security profiles

### 2. **Network Security**
- ✅ Kong rate limiting (100 requests/minute)
- ✅ HTTPS enforcement
- 🔄 **TODO**: Add NetworkPolicies for traffic isolation

### 3. **Secret Management**
- ✅ Template-based secrets
- 🔄 **Recommended**: External Secret Operator
- 🔄 **Recommended**: Vault integration

## 🚨 Common Issues & Troubleshooting

### Issue: Service not scaling to zero
**Cause**: Health checks failing
**Solution**: Verify health endpoints return 200 OK

### Issue: Migration job fails
**Cause**: EF tools not available
**Solution**: Use migration-specific image with EF tools

### Issue: Connection timeouts
**Cause**: Resource limits too low
**Solution**: Increase CPU/memory limits

### Issue: Authentication failures
**Cause**: JWT configuration mismatch
**Solution**: Verify JWT_KEY is consistent across all services

## 📊 Performance Tuning

### Autoscaling Configuration
```yaml
annotations:
  autoscaling.knative.dev/target: "10"        # Requests per pod
  autoscaling.knative.dev/minScale: "0"       # Scale to zero
  autoscaling.knative.dev/maxScale: "10"      # Max replicas
  autoscaling.knative.dev/scaleDownDelay: "30s"
```

### Resource Optimization
- **CPU Request**: 100m (adequate for startup)
- **Memory Request**: 256Mi (sufficient for .NET app)
- **CPU Limit**: 1000m (allows burst capacity)
- **Memory Limit**: 1Gi (prevents OOM)

## 🔄 Maintenance

### Updating the Service
```bash
# Update image version in knative-service.yaml
# Then apply
kubectl apply -f knative-service.yaml

# Monitor rollout
kubectl get revisions -l serving.knative.dev/service=auth-service
```

### Backup & Recovery
- Database backups handled by PostgreSQL operator
- Configuration stored in Git
- Secrets managed by external systems

## 📈 Monitoring Integration

### Prometheus Metrics
K-Native automatically exposes metrics for:
- Request count and latency
- Pod scaling events
- Cold start duration

### Recommended Alerts
- High error rate (>5%)
- Cold start latency (>2s)
- Scale-up failures
- Health check failures

---

**Last Updated**: $(date)
**Version**: v2.0
**Maintainer**: DevOps Team 