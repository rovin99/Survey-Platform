# AuthService Knative Deployment Guide

## 🎯 Overview

This guide walks you through deploying your AuthService from Docker Compose to Knative serverless platform.

## 📋 Prerequisites

### 1. **Kubernetes Cluster with Knative**
```bash
# Verify Knative is installed
kubectl get pods -n knative-serving
```

### 2. **Managed Database**
- **AWS RDS PostgreSQL** (recommended)
- **Google Cloud SQL for PostgreSQL**
- **Azure Database for PostgreSQL**

### 3. **Container Registry**
- Docker Hub, AWS ECR, Google Container Registry, etc.

## 🔧 Pre-Deployment Setup

### 1. **Set up Managed Database**
Create a managed PostgreSQL instance and note:
- Host endpoint
- Database name: `SurveyDb`
- Username: `postgres` (or your preferred user)
- Password: (secure password)

### 2. **Update Configuration Files**

#### Update `k8s/secrets.yaml`:
```yaml
stringData:
  CONNECTION_STRING: "Host=your-db-host.region.rds.amazonaws.com;Port=5432;Database=SurveyDb;Username=postgres;Password=your-secure-password"
  JWT_KEY: "your-256-bit-secure-jwt-key"
```

#### Update `k8s/configmap.yaml`:
```yaml
data:
  CORS_ORIGINS: "https://your-frontend-domain.com"
  # Update other configuration as needed
```

## 🚀 Deployment Steps

### Option A: Automated Deployment

```bash
# Make the script executable
chmod +x deploy-knative.sh

# Deploy with your registry
./deploy-knative.sh your-dockerhub-username latest
```

### Option B: Manual Deployment

#### 1. **Build and Push Image**
```bash
# Build optimized image for Knative
docker build -f Dockerfile.knative -t your-registry/auth-service:v1 .

# Push to registry
docker push your-registry/auth-service:v1
```

#### 2. **Update Image References**
```bash
# Update all YAML files with your image
sed -i 's|your-registry/auth-service:latest|your-registry/auth-service:v1|g' k8s/*.yaml
```

#### 3. **Apply Configuration**
```bash
# Apply secrets and config
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Run database migrations
kubectl apply -f k8s/migration-job.yaml
kubectl wait --for=condition=Complete job/auth-service-migration --timeout=300s

# Seed initial data
kubectl apply -f k8s/seeder-job.yaml
kubectl wait --for=condition=Complete job/auth-service-seeder --timeout=300s

# Deploy the service
kubectl apply -f k8s/knative-service.yaml
```

#### 4. **Verify Deployment**
```bash
# Check service status
kubectl get ksvc auth-service

# Get service URL
SERVICE_URL=$(kubectl get ksvc auth-service -o jsonpath='{.status.url}')
echo "Service URL: $SERVICE_URL"

# Test health endpoints
curl $SERVICE_URL/health/ready
```

## 🔍 Monitoring and Troubleshooting

### Check Service Status
```bash
# Service details
kubectl describe ksvc auth-service

# Pod logs
kubectl logs -l serving.knative.dev/service=auth-service

# Migration job logs
kubectl logs job/auth-service-migration
```

### Common Issues

#### 1. **Image Pull Errors**
- Verify image exists in registry
- Check registry authentication

#### 2. **Database Connection Issues**
- Verify connection string in secrets
- Check network policies
- Ensure managed database allows connections

#### 3. **Migration Failures**
- Check database permissions
- Verify connection string format
- Review migration job logs

#### 4. **Health Check Failures**
- Ensure health endpoints are implemented
- Check port configuration (8080)
- Verify database connectivity

## 🌟 Key Differences from Docker Compose

| Aspect | Docker Compose | Knative |
|--------|----------------|---------|
| **Database** | Local container | Managed service |
| **Configuration** | .env file | ConfigMaps/Secrets |
| **Migrations** | Compose service | Kubernetes Job |
| **Scaling** | Manual | Automatic (0-N) |
| **Port** | Fixed (5001) | Dynamic (injected) |
| **Health Checks** | Optional | Required |

## ⚡ Knative Features

### **Scale to Zero**
- Service automatically scales down to 0 when idle
- Cold start time: ~2-5 seconds for .NET apps

### **Auto-scaling**
- Scales based on concurrent requests
- Configuration via annotations in `knative-service.yaml`

### **Traffic Management**
- Blue/green deployments
- Gradual traffic shifting
- A/B testing capabilities

## 🔒 Security Considerations

### **Production Checklist**
- [ ] Use managed database with SSL
- [ ] Strong JWT secrets (256-bit minimum)
- [ ] Network policies for database access
- [ ] Regular security updates
- [ ] Monitor and log access
- [ ] Enable CORS only for trusted domains

### **Resource Limits**
- Memory: 256Mi request, 1Gi limit
- CPU: 100m request, 1000m limit
- Adjust based on load testing

## 📊 Performance Optimization

### **Cold Start Optimization**
- Use minimal base images
- Reduce dependencies
- Implement readiness probes
- Consider keeping minimum scale > 0 for critical services

### **Database Performance**
- Use connection pooling
- Implement proper indexing
- Monitor slow queries
- Consider read replicas for high load

## 🚦 CI/CD Integration

### **GitHub Actions Example**
```yaml
name: Deploy to Knative
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Knative
        run: |
          # Build and push image
          docker build -f Dockerfile.knative -t $REGISTRY/auth-service:$GITHUB_SHA .
          docker push $REGISTRY/auth-service:$GITHUB_SHA
          
          # Deploy to Knative
          ./deploy-knative.sh $REGISTRY $GITHUB_SHA
```

## 📝 Next Steps

1. **Set up monitoring** (Prometheus, Grafana)
2. **Configure custom domain** and SSL certificates
3. **Implement logging** (structured logging with Serilog)
4. **Set up backup strategy** for managed database
5. **Performance testing** and optimization
6. **Disaster recovery** planning

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Knative documentation
3. Check your cloud provider's specific guidelines
4. Consider using managed platforms like Google Cloud Run or AWS App Runner for simpler deployment 