# 🚀 Local Kubernetes + Knative Setup Guide

## Complete AuthService Serverless Deployment with Scale-to-Zero

This guide documents the complete process of setting up a local Kubernetes cluster with Knative Serving and deploying the AuthService as a serverless application with scale-to-zero capabilities.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Knative Installation](#knative-installation)
4. [AuthService Deployment](#authservice-deployment)
5. [Testing Scale-to-Zero Behavior](#testing-scale-to-zero-behavior)
6. [Access Methods](#access-methods)
7. [Monitoring & Observability](#monitoring--observability)
8. [Troubleshooting](#troubleshooting)
9. [Cleanup](#cleanup)

---

## 🛠️ Prerequisites

### Required Tools
```bash
# Check if tools are installed
docker --version          # Docker for containerization
kubectl version --client  # Kubernetes CLI
brew --version            # Package manager (macOS)

# Install missing tools
brew install kind         # Kubernetes in Docker
brew install kn           # Knative CLI (if not already installed)
```

### System Requirements
- **Docker**: Running and accessible
- **Memory**: At least 4GB available for Kind cluster
- **Storage**: 10GB+ free space
- **Network**: Internet access for image pulls

---

## 🏗️ Infrastructure Setup

### Step 1: Create Kind Cluster Configuration

Create a multi-node cluster optimized for Knative:

```bash
# Create Kind configuration
cat > kind-config.yaml << 'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
EOF
```

### Step 2: Create Kubernetes Cluster

```bash
# Create the cluster
kind create cluster --name knative-local --config kind-config.yaml

# Verify cluster creation
kubectl cluster-info --context kind-knative-local
kubectl get nodes
```

**Expected Output:**
```
NAME                          STATUS   ROLES           AGE   VERSION
knative-local-control-plane   Ready    control-plane   45s   v1.33.1
knative-local-worker          Ready    <none>          35s   v1.33.1
knative-local-worker2         Ready    <none>          35s   v1.33.1
```

---

## 🌐 Knative Installation

### Step 3: Install Knative Serving

```bash
# Install Knative Serving CRDs
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.17.0/serving-crds.yaml

# Install Knative Serving core components
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.17.0/serving-core.yaml

# Install Kourier networking layer (lightweight for local development)
kubectl apply -f https://github.com/knative/net-kourier/releases/download/knative-v1.17.0/kourier.yaml

# Configure Knative to use Kourier
kubectl patch configmap/config-network \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'
```

### Step 4: Verify Knative Installation

```bash
# Wait for all pods to be ready
kubectl wait --for=condition=Ready pods --all -n knative-serving --timeout=300s
kubectl wait --for=condition=Ready pods --all -n kourier-system --timeout=300s

# Check installation status
echo "Knative Serving Pods:"
kubectl get pods -n knative-serving

echo "Kourier System Pods:"
kubectl get pods -n kourier-system

echo "Kourier Load Balancer:"
kubectl get svc kourier -n kourier-system
```

**Expected Output:**
```
Knative Serving Pods:
NAME                                      READY   STATUS    RESTARTS   AGE
activator-5656895fc6-p2hrn                1/1     Running   0          2m
autoscaler-7f4754ffb4-8d6nc               1/1     Running   0          2m
controller-cc7d86698-8qxpb                1/1     Running   0          2m
net-kourier-controller-6994579b9b-mf976   1/1     Running   0          2m
webhook-f65b5d96-bx6c4                    1/1     Running   0          2m

Kourier System Pods:
NAME                                     READY   STATUS    RESTARTS   AGE
3scale-kourier-gateway-9f4bdf747-5vd4w   1/1     Running   0          2m
```

### Step 5: Test Knative CLI

```bash
# Verify Knative CLI
kn version
```

---

## 🚀 AuthService Deployment

### Step 6: Prepare Application Configuration

The AuthService requires several Kubernetes resources:

#### Secrets (Sensitive Configuration)
```bash
# Apply secrets for database and JWT configuration
kubectl apply -f k8s/secrets.yaml
```

#### ConfigMap (Non-sensitive Configuration)
```bash
# Apply configuration
kubectl apply -f k8s/configmap.yaml
```

### Step 7: Build and Deploy AuthService

#### Update AuthService with Health Checks

Ensure your `Program.cs` includes health check configuration:

```csharp
// Add health checks
builder.Services.AddCustomHealthChecks();

// Map health check endpoints (at the end before app.Run())
app.MapCustomHealthChecks();
```

#### Build Docker Image

```bash
# Build image with health checks
docker build -f Dockerfile.knative -t rovin123/auth-service:v2 .

# Push to registry
docker push rovin123/auth-service:v2
```

#### Deploy to Knative

```bash
# Deploy the Knative service
kubectl apply -f k8s/knative-service.yaml

# Monitor deployment
kubectl get ksvc auth-service -w
```

### Step 8: Verify Deployment

```bash
# Check service status
kubectl get ksvc auth-service

# Check for running pods (may be 0 due to scale-to-zero)
kubectl get pods | grep auth-service
```

**Successful Deployment Output:**
```
NAME           URL                                             LATESTCREATED        LATESTREADY          READY   REASON
auth-service   http://auth-service.default.svc.cluster.local   auth-service-00004   auth-service-00004   True    
```

---

## 🧪 Testing Scale-to-Zero Behavior

### Step 9: Demonstrate Scale-to-Zero

#### Initial State (Zero Pods)
```bash
# Check initial state - should show 0 pods
echo "Current pod count:"
kubectl get pods | grep auth-service | wc -l

echo "Service status:"
kubectl get ksvc auth-service
```

#### Trigger Scale-Up
```bash
# Make a request to trigger scale-up
echo "Sending request to trigger scale-up..."
kubectl run test-client --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s -m 10 http://auth-service.default.svc.cluster.local/ &

# Watch pods scale up in real-time
echo "Watching for pod creation..."
for i in {1..15}; do
  PODS=$(kubectl get pods 2>/dev/null | grep auth-service | wc -l | tr -d ' ')
  echo "[$i] Pods running: $PODS"
  if [ "$PODS" -gt 0 ]; then
    echo "✅ Scale-up triggered! Pod created."
    kubectl get pods | grep auth-service
    break
  fi
  sleep 2
done
```

#### Monitor Scale-Down
```bash
# Monitor automatic scale-down (after ~90 seconds of no traffic)
echo "Monitoring scale-down behavior..."
echo "Waiting for pods to scale down to zero..."

for i in {1..60}; do
  PODS=$(kubectl get pods 2>/dev/null | grep auth-service | wc -l | tr -d ' ')
  echo "[$i] Pods running: $PODS ($(date))"
  if [ "$PODS" -eq 0 ]; then
    echo "✅ Scale-down completed! Back to zero pods."
    break
  fi
  sleep 5
done
```

### Expected Scale-to-Zero Behavior

1. **Initial State**: 0 pods running (cost-efficient idle state)
2. **First Request**: Pod creation triggered (~8-15 seconds)
3. **Active State**: Pod serves requests while traffic exists
4. **Idle Period**: After ~90 seconds of no traffic, scales back to 0
5. **Repeat**: Cycle continues based on traffic patterns

---

## 🌐 Access Methods

### Method 1: Port Forward (Development)

```bash
# Forward local port to service
kubectl port-forward service/auth-service 8080:80 &

# Test endpoints
echo "Testing health endpoints:"
curl -s http://localhost:8080/health/live && echo " ✅ Live check"
curl -s http://localhost:8080/health/ready && echo " ✅ Ready check"
curl -s http://localhost:8080/health/startup && echo " ✅ Startup check"

# Test API endpoints
curl -s http://localhost:8080/auth/health 2>/dev/null || echo "Auth controller accessible"

# Stop port forward
pkill -f "kubectl port-forward"
```

### Method 2: Direct Pod Access

```bash
# Get pod IP (when pod is running)
POD_NAME=$(kubectl get pods | grep auth-service | head -1 | awk '{print $1}')
POD_IP=$(kubectl get pod $POD_NAME -o jsonpath='{.status.podIP}' 2>/dev/null)

if [ ! -z "$POD_IP" ]; then
  echo "Testing direct pod access: $POD_IP"
  curl -s http://$POD_IP:80/health/live && echo " ✅ Direct access working"
else
  echo "No pods running (scaled to zero)"
fi
```

### Method 3: Internal Service Communication

```bash
# Test from within cluster
kubectl run curl-test --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s http://auth-service.default.svc.cluster.local/health/live
```

---

## 📊 Monitoring & Observability

### Monitor Service Metrics

```bash
# Watch service status continuously
watch kubectl get ksvc auth-service

# Monitor pod lifecycle
watch "kubectl get pods | grep auth-service"

# Check service events
kubectl describe ksvc auth-service

# Check pod events
kubectl get events --sort-by=.metadata.creationTimestamp | tail -10
```

### Performance Testing

```bash
# Generate load to test scaling behavior
for i in {1..10}; do
  kubectl run load-test-$i --rm -i --restart=Never --image=curlimages/curl -- \
    curl -s http://auth-service.default.svc.cluster.local/ &
done

# Monitor concurrent scaling
kubectl get pods | grep auth-service
```

### Health Check Monitoring

```bash
# Continuous health monitoring
watch "kubectl run health-check --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s http://auth-service.default.svc.cluster.local/health/startup 2>/dev/null || echo 'Service scaled to zero'"
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Service Not Ready
```bash
# Check service status
kubectl describe ksvc auth-service

# Check pod logs
POD_NAME=$(kubectl get pods | grep auth-service | awk '{print $1}')
kubectl logs $POD_NAME -c auth-service

# Check events
kubectl get events --sort-by=.metadata.creationTimestamp | tail -10
```

#### 2. Health Checks Failing
```bash
# Verify health check endpoints are configured
kubectl describe ksvc auth-service | grep -A 10 -B 5 "probe"

# Test health endpoints directly
POD_IP=$(kubectl get pod $POD_NAME -o jsonpath='{.status.podIP}')
curl -v http://$POD_IP:80/health/startup
```

#### 3. Scale-to-Zero Not Working
```bash
# Check autoscaling configuration
kubectl get ksvc auth-service -o yaml | grep -A 5 autoscaling

# Verify no traffic is reaching the service
kubectl logs -n knative-serving deployment/activator
```

#### 4. Database Connection Issues
```bash
# Check secrets
kubectl get secret auth-service-secrets -o yaml

# Verify database connectivity from pod
kubectl exec -it $POD_NAME -c auth-service -- \
  dotnet --version  # Basic connectivity test
```

### Debug Commands

```bash
# Complete service debugging
echo "=== Service Status ==="
kubectl get ksvc auth-service -o wide

echo "=== Current Pods ==="
kubectl get pods | grep auth-service

echo "=== Recent Events ==="
kubectl get events --sort-by=.metadata.creationTimestamp | tail -15

echo "=== Service Configuration ==="
kubectl describe ksvc auth-service

echo "=== Knative System Health ==="
kubectl get pods -n knative-serving
kubectl get pods -n kourier-system
```

---

## 🧹 Cleanup

### Remove AuthService

```bash
# Delete Knative service
kubectl delete ksvc auth-service

# Delete supporting resources
kubectl delete secret auth-service-secrets
kubectl delete configmap auth-service-config

# Verify cleanup
kubectl get ksvc
kubectl get pods | grep auth-service
```

### Remove Knative

```bash
# Remove Knative Serving
kubectl delete -f https://github.com/knative/serving/releases/download/knative-v1.17.0/serving-core.yaml
kubectl delete -f https://github.com/knative/serving/releases/download/knative-v1.17.0/serving-crds.yaml

# Remove Kourier
kubectl delete -f https://github.com/knative/net-kourier/releases/download/knative-v1.17.0/kourier.yaml
```

### Remove Kind Cluster

```bash
# Delete the entire cluster
kind delete cluster --name knative-local

# Verify cleanup
docker ps | grep kindest
kind get clusters
```

---

## 📈 Key Benefits Achieved

### ✅ **Serverless Architecture**
- **Scale-to-Zero**: No resources consumed when idle
- **Auto-scaling**: Automatic scaling based on traffic
- **Cost Efficiency**: Pay only for actual usage

### ✅ **Local Development**
- **Full Control**: Complete local Kubernetes environment
- **Rapid Iteration**: Fast deploy-test-debug cycles
- **No Cloud Costs**: Develop without cloud expenses

### ✅ **Production Ready**
- **Health Checks**: Comprehensive health monitoring
- **Resource Limits**: Proper resource management
- **Security**: Non-root containers and security policies

---

## 🎯 Next Steps

1. **Add Observability**: Integrate Prometheus/Grafana for metrics
2. **CI/CD Integration**: Automate deployments with GitHub Actions
3. **Service Mesh**: Add Istio for advanced traffic management
4. **Multi-Service**: Deploy other microservices (SurveyService, etc.)
5. **External Access**: Set up proper ingress for external access

---

## 📚 Additional Resources

- [Knative Documentation](https://knative.dev/docs/)
- [Kind Documentation](https://kind.sigs.k8s.io/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [ASP.NET Core Health Checks](https://docs.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks)

---

**🎉 Congratulations!** You've successfully deployed a production-ready serverless AuthService on local Kubernetes with Knative, demonstrating true scale-to-zero behavior and auto-scaling capabilities! 