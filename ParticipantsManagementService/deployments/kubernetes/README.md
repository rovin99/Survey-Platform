# ParticipantsManagementService Kubernetes Deployment

This directory contains Kubernetes/Knative manifests for deploying the ParticipantsManagementService.

## 📁 Files Overview

### 1. **knative-service.yaml**
Main Knative Service definition for serverless deployment.

**Features:**
- Auto-scaling (0-15 pods)
- Scale-to-zero capability
- Health probes (startup, liveness, readiness)
- Security hardened (non-root, read-only filesystem)
- Resource limits configured

**Deploy:**
```bash
kubectl apply -f knative-service.yaml
```

### 2. **configmap.yaml**
Non-sensitive configuration values.

**Contains:**
- Database connection parameters (host, port, name)
- Application environment settings
- CORS configuration
- Logging settings

**Deploy:**
```bash
kubectl apply -f configmap.yaml
```

### 3. **secrets.template.yaml**
Template for sensitive configuration (DO NOT COMMIT ACTUAL SECRETS).

**Contains:**
- Database credentials (DB_USER, DB_PASSWORD)
- JWT secret key

**Deploy:**
```bash
# Create actual secrets (replace placeholders)
kubectl create secret generic participants-service-secrets \
  --from-literal=DB_USER="postgres" \
  --from-literal=DB_PASSWORD="your-password" \
  --from-literal=JWT_SECRET_KEY="your-jwt-key" \
  --namespace=default
```

### 4. **migration-job.yaml**
Kubernetes Job for running database migrations.

**Features:**
- One-time execution
- Auto-cleanup after 5 minutes
- Retry on failure (up to 3 times)

**Deploy:**
```bash
kubectl apply -f migration-job.yaml
kubectl wait --for=condition=complete job/participants-service-migration --timeout=300s
```

## 🚀 Deployment Order

Follow this order for successful deployment:

### **Step 1: Prerequisites**
```bash
# Ensure Knative Serving is installed
kubectl get pods -n knative-serving

# Ensure PostgreSQL is accessible
kubectl get svc -n database postgres-db
```

### **Step 2: Create Secrets**
```bash
# Create actual secrets (NOT the template)
kubectl create secret generic participants-service-secrets \
  --from-literal=DB_USER="postgres" \
  --from-literal=DB_PASSWORD="postgres123" \
  --from-literal=JWT_SECRET_KEY="your-256-bit-secret-key" \
  --namespace=default
```

### **Step 3: Apply ConfigMap**
```bash
kubectl apply -f configmap.yaml
```

### **Step 4: Run Database Migrations**
```bash
kubectl apply -f migration-job.yaml

# Wait for completion
kubectl wait --for=condition=complete job/participants-service-migration --timeout=300s

# Check logs
kubectl logs job/participants-service-migration
```

### **Step 5: Deploy Knative Service**
```bash
kubectl apply -f knative-service.yaml

# Wait for service to be ready
kubectl get ksvc participants-management-service -w
```

## 🔍 Verification

### Check Service Status
```bash
# Get Knative service
kubectl get ksvc participants-management-service

# Get pods (may be 0 if scaled down)
kubectl get pods -l serving.knative.dev/service=participants-management-service

# Get service URL
kubectl get ksvc participants-management-service -o jsonpath='{.status.url}'
```

### Test Health Endpoint
```bash
# Get service URL
KSVC_URL=$(kubectl get ksvc participants-management-service -o jsonpath='{.status.url}')

# Test health
curl $KSVC_URL/health
```

### View Logs
```bash
# Application logs
kubectl logs -l serving.knative.dev/service=participants-management-service -f

# Migration logs
kubectl logs job/participants-service-migration
```

## 🔄 Updates

### Update Application
```bash
# Update image in knative-service.yaml
# Then apply
kubectl apply -f knative-service.yaml

# Watch rollout
kubectl get revisions -l serving.knative.dev/service=participants-management-service
```

### Run New Migrations
```bash
# Delete old job
kubectl delete job participants-service-migration

# Apply new migration
kubectl apply -f migration-job.yaml
```

### Update Configuration
```bash
# Edit configmap
kubectl edit configmap participants-service-config

# Or apply updated file
kubectl apply -f configmap.yaml

# Restart service (if needed)
kubectl delete pod -l serving.knative.dev/service=participants-management-service
```

## 🧹 Cleanup

### Remove Service
```bash
kubectl delete -f knative-service.yaml
```

### Remove Migration Job
```bash
kubectl delete -f migration-job.yaml
```

### Remove Configuration
```bash
kubectl delete -f configmap.yaml
kubectl delete secret participants-service-secrets
```

### Complete Cleanup
```bash
kubectl delete ksvc participants-management-service
kubectl delete job participants-service-migration
kubectl delete configmap participants-service-config
kubectl delete secret participants-service-secrets
```

## 📊 Resource Requirements

### Default Limits
- **CPU Request**: 100m
- **Memory Request**: 128Mi
- **CPU Limit**: 1000m
- **Memory Limit**: 512Mi

### Autoscaling
- **Min Pods**: 0 (scale-to-zero)
- **Max Pods**: 15
- **Target Concurrency**: 10 requests/pod
- **Container Concurrency**: 20

## 🔐 Security Notes

1. **Never commit actual secrets** - Use the template and create secrets separately
2. **Use secret management** - Consider Sealed Secrets or External Secrets Operator
3. **Rotate secrets regularly** - Update DB passwords and JWT keys periodically
4. **Limit CORS origins** - Don't use "*" in production
5. **Enable network policies** - Isolate service traffic
6. **Monitor access** - Use audit logging

## 🐛 Troubleshooting

### Service Not Starting
```bash
# Check events
kubectl describe ksvc participants-management-service

# Check pod logs
kubectl logs -l serving.knative.dev/service=participants-management-service
```

### Migration Failed
```bash
# Check job status
kubectl describe job participants-service-migration

# Check logs
kubectl logs job/participants-service-migration

# Verify secrets
kubectl get secret participants-service-secrets -o yaml
```

### Database Connection Issues
```bash
# Verify database service
kubectl get svc -n database postgres-db

# Test connectivity from pod
kubectl run test-db --rm -it --image=postgres:15 -- \
  psql -h postgres-db.database.svc.cluster.local -U postgres -d SurveyDb
```

### Health Check Failing
```bash
# Get service details
kubectl describe ksvc participants-management-service

# Check health endpoint directly
POD_NAME=$(kubectl get pods -l serving.knative.dev/service=participants-management-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $POD_NAME -- curl localhost:8080/health
```

## 📚 Related Documentation

- [Deployment Guide](../DEPLOYMENT-GUIDE.md)
- [Knative Documentation](https://knative.dev/docs/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)

---

**Created**: November 15, 2025  
**Version**: v1.0  
**Maintained by**: DevOps Team

