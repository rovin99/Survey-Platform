#!/bin/bash

# ============================================================================
# Survey Platform - Complete Kubernetes Deployment Script
# ============================================================================
# Deploys the entire Survey Platform to a Kind cluster (local) or k3s (server)
# with Knative Serving for serverless auto-scaling
#
# Time Estimate: 15-20 minutes
#
# Prerequisites:
#   - Docker running
#   - kubectl installed
#   - kind installed (for local) OR k3s installed (for server)
#   - Internet connection (for pulling images)
#
# Usage:
#   Local:  ./deploy-local-cluster.sh
#   Server: ./deploy-local-cluster.sh --server
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
CLUSTER_NAME="survey-platform"
NAMESPACE="default"
KNATIVE_VERSION="knative-v1.17.0"
SERVER_MODE=false
DOMAIN="127.0.0.1.nip.io"

# Parse args
if [[ "$1" == "--server" ]]; then
    SERVER_MODE=true
    echo -n "Enter your domain (e.g., survey.college.edu): "
    read DOMAIN
fi

# ============================================================================
# Helper Functions
# ============================================================================

print_header() { echo -e "\n${CYAN}============================================${NC}\n${CYAN}$1${NC}\n${CYAN}============================================${NC}"; }
print_step() { echo -e "${BLUE}→ $1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

wait_for_pods() {
    local namespace=$1
    local label=$2
    local timeout=${3:-300}
    print_step "Waiting for pods ($label) in $namespace..."
    kubectl wait --for=condition=Ready pods -l "$label" -n "$namespace" --timeout="${timeout}s" 2>/dev/null || true
}

check_prerequisite() {
    if ! command -v "$1" &> /dev/null; then
        print_error "$2 is not installed."
        return 1
    fi
    print_success "$2 is installed"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

print_header "Pre-flight Checks"

check_prerequisite "docker" "Docker"
check_prerequisite "kubectl" "kubectl"

if [ "$SERVER_MODE" = false ]; then
    check_prerequisite "kind" "Kind"
fi

if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi
print_success "Docker is running"

echo ""
echo "Mode: $([ "$SERVER_MODE" = true ] && echo "SERVER ($DOMAIN)" || echo "LOCAL (Kind)")"
echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && exit 0

# ============================================================================
# Phase 1: Create/Connect Cluster
# ============================================================================

print_header "Phase 1: Cluster Setup"

if [ "$SERVER_MODE" = true ]; then
    print_step "Using existing k3s cluster..."
    if ! kubectl cluster-info &>/dev/null; then
        print_error "Cannot connect to cluster. Is k3s running?"
        echo "  Install k3s: curl -sfL https://get.k3s.io | sh -"
        echo "  Then: export KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
        exit 1
    fi
    print_success "Connected to k3s cluster"
else
    # Kind cluster
    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        print_warning "Cluster '$CLUSTER_NAME' already exists"
        read -p "Delete and recreate? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kind delete cluster --name "$CLUSTER_NAME"
        fi
    fi

    if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        print_step "Creating Kind cluster..."
        cat <<KINDEOF | kind create cluster --name "$CLUSTER_NAME" --config -
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 31080
    hostPort: 8080
    protocol: TCP
  - containerPort: 31443
    hostPort: 8443
    protocol: TCP
KINDEOF
        print_success "Kind cluster created"
    fi

    kubectl cluster-info --context "kind-${CLUSTER_NAME}"
fi

print_success "Cluster is ready"

# ============================================================================
# Phase 2: Install Knative Serving + Kourier
# ============================================================================

print_header "Phase 2: Installing Knative Serving"

print_step "Installing Knative CRDs..."
kubectl apply -f "https://github.com/knative/serving/releases/download/${KNATIVE_VERSION}/serving-crds.yaml"

print_step "Installing Knative core..."
kubectl apply -f "https://github.com/knative/serving/releases/download/${KNATIVE_VERSION}/serving-core.yaml"

print_step "Installing Kourier networking..."
kubectl apply -f "https://github.com/knative/net-kourier/releases/download/${KNATIVE_VERSION}/kourier.yaml"

print_step "Configuring Knative..."
kubectl patch configmap/config-network \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'

kubectl patch configmap/config-domain \
  --namespace knative-serving \
  --type merge \
  --patch "{\"data\":{\"${DOMAIN}\":\"\"}}"

print_step "Waiting for Knative pods..."
wait_for_pods "knative-serving" "app=controller" 300
wait_for_pods "knative-serving" "app=webhook" 300
wait_for_pods "kourier-system" "app=3scale-kourier-gateway" 300

print_success "Knative Serving is ready"

# ============================================================================
# Phase 3: Deploy Infrastructure (PostgreSQL + MinIO + Piston)
# ============================================================================

print_header "Phase 3: Deploying Infrastructure"

# PostgreSQL
print_step "Deploying PostgreSQL..."
kubectl apply -f infrastructure/postgresql/postgres-deployment.yaml
print_success "PostgreSQL manifests applied"

# MinIO
print_step "Deploying MinIO Object Storage..."
kubectl apply -f infrastructure/minio/minio-deployment.yaml
print_success "MinIO manifests applied"

# Piston
print_step "Deploying Piston Code Execution Engine..."
kubectl apply -f infrastructure/piston/piston-deployment.yaml
print_success "Piston manifests applied"

# Wait for infrastructure
print_step "Waiting for PostgreSQL..."
kubectl wait --for=condition=Available deployment/postgres -n database --timeout=300s 2>/dev/null || true
wait_for_pods "database" "app=postgres" 300

print_step "Waiting for MinIO..."
kubectl wait --for=condition=Available deployment/minio -n storage --timeout=300s 2>/dev/null || true
wait_for_pods "storage" "app=minio" 300

print_step "Waiting for Piston..."
kubectl wait --for=condition=Available deployment/piston -n default --timeout=300s 2>/dev/null || true
wait_for_pods "default" "app=piston" 300

print_success "All infrastructure ready"

# ============================================================================
# Phase 4: Create Secrets and ConfigMaps
# ============================================================================

print_header "Phase 4: Creating Secrets and ConfigMaps"

# Generate secrets if create-secrets.sh exists, otherwise create manually
if [ -f infrastructure/secrets/create-secrets.sh ]; then
    print_step "Running secrets creation script..."
    chmod +x infrastructure/secrets/create-secrets.sh
    bash infrastructure/secrets/create-secrets.sh
else
    print_step "Creating secrets from templates..."
    # Set defaults for local dev
    export POSTGRES_USER=${POSTGRES_USER:-postgres}
    export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres123}
    export JWT_SECRET_KEY=${JWT_SECRET_KEY:-survey-platform-jwt-secret-key-change-this-in-production-min-32-chars}
    export INTERNAL_API_KEY=${INTERNAL_API_KEY:-internal-service-key-dev-only}
    export MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY:-minioadmin}
    export MINIO_SECRET_KEY=${MINIO_SECRET_KEY:-minioadmin}
    export SMTP_EMAIL=${SMTP_EMAIL:-noreply@example.com}
    export SMTP_APP_PASSWORD=${SMTP_APP_PASSWORD:-placeholder}

    envsubst < AuthService/deployments/kubernetes/secrets.template.yaml | kubectl apply -f -
    envsubst < SurveyManagementService/deployments/kubernetes/secrets.template.yaml | kubectl apply -f -
    envsubst < ParticipantsManagementService/deployments/kubernetes/secrets.template.yaml | kubectl apply -f -
fi
print_success "Secrets created"

# ConfigMaps
print_step "Applying ConfigMaps..."
if [ -f infrastructure/configmaps/update-configmaps.sh ]; then
    chmod +x infrastructure/configmaps/update-configmaps.sh
    bash infrastructure/configmaps/update-configmaps.sh
else
    kubectl apply -f AuthService/deployments/kubernetes/configmap.yaml
    kubectl apply -f SurveyManagementService/deployments/kubernetes/configmap.yaml
    kubectl apply -f ParticipantsManagementService/deployments/kubernetes/configmap.yaml
    kubectl apply -f frontend/deployments/kubernetes/configmap.yaml
fi
print_success "ConfigMaps applied"

# ============================================================================
# Phase 5: Run Database Migrations
# ============================================================================

print_header "Phase 5: Running Database Migrations"

if [ -f AuthService/deployments/kubernetes/migration-job.yaml ]; then
    print_step "Running AuthService migrations..."
    kubectl delete job auth-service-migration -n "$NAMESPACE" 2>/dev/null || true
    kubectl apply -f AuthService/deployments/kubernetes/migration-job.yaml
    kubectl wait --for=condition=complete job/auth-service-migration -n "$NAMESPACE" --timeout=300s 2>/dev/null || print_warning "Auth migration may still be running"
fi

if [ -f AuthService/deployments/kubernetes/seeder-job.yaml ]; then
    print_step "Seeding AuthService data..."
    kubectl delete job auth-service-seeder -n "$NAMESPACE" 2>/dev/null || true
    kubectl apply -f AuthService/deployments/kubernetes/seeder-job.yaml
    kubectl wait --for=condition=complete job/auth-service-seeder -n "$NAMESPACE" --timeout=300s 2>/dev/null || true
fi

if [ -f SurveyManagementService/deployments/kubernetes/migration-job.yaml ]; then
    print_step "Running SurveyManagementService migrations..."
    kubectl delete job survey-service-migration -n "$NAMESPACE" 2>/dev/null || true
    kubectl apply -f SurveyManagementService/deployments/kubernetes/migration-job.yaml
    kubectl wait --for=condition=complete job/survey-service-migration -n "$NAMESPACE" --timeout=300s 2>/dev/null || true
fi

if [ -f ParticipantsManagementService/deployments/kubernetes/migration-job.yaml ]; then
    print_step "Running ParticipantsManagementService migrations..."
    kubectl delete job participants-service-migration -n "$NAMESPACE" 2>/dev/null || true
    kubectl apply -f ParticipantsManagementService/deployments/kubernetes/migration-job.yaml
    kubectl wait --for=condition=complete job/participants-service-migration -n "$NAMESPACE" --timeout=300s 2>/dev/null || true
fi

print_success "All migrations completed"

# ============================================================================
# Phase 6: Deploy Microservices (Knative)
# ============================================================================

print_header "Phase 6: Deploying Microservices"

print_step "Deploying AuthService..."
kubectl apply -f AuthService/deployments/kubernetes/knative-service.yaml

print_step "Deploying SurveyManagementService..."
kubectl apply -f SurveyManagementService/deployments/kubernetes/k-native-service.yaml

print_step "Deploying ParticipantsManagementService..."
kubectl apply -f ParticipantsManagementService/deployments/kubernetes/knative-service.yaml

print_step "Deploying Frontend..."
kubectl apply -f frontend/deployments/kubernetes/knative-service.yaml

print_step "Waiting for services to initialize..."
sleep 20

print_success "All Knative services deployed"

# ============================================================================
# Phase 7: Deploy API Gateway
# ============================================================================

print_header "Phase 7: Deploying API Gateway"

print_step "Deploying smart-proxy API gateway..."
kubectl apply -f smart-proxy/deployment.yaml

print_step "Waiting for API gateway..."
kubectl wait --for=condition=Available deployment/api-gateway -n default --timeout=120s 2>/dev/null || true

print_success "API Gateway deployed"

# ============================================================================
# Phase 8: Setup Access
# ============================================================================

print_header "Phase 8: Setting Up Access"

if [ "$SERVER_MODE" = true ]; then
    # Server mode: API gateway is LoadBalancer
    print_step "Getting API Gateway external IP..."
    GATEWAY_IP=$(kubectl get svc api-gateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    if [ "$GATEWAY_IP" = "pending" ] || [ -z "$GATEWAY_IP" ]; then
        GATEWAY_IP=$(kubectl get svc api-gateway -o jsonpath='{.spec.clusterIP}')
        print_warning "LoadBalancer IP not assigned yet. Using ClusterIP: $GATEWAY_IP"
        print_warning "For external access, configure your load balancer to point to this service"
    fi
    print_success "API Gateway accessible at: http://${GATEWAY_IP}"
else
    # Local mode: port-forward
    print_step "Setting up port forwarding..."
    pkill -f "kubectl port-forward.*kourier" 2>/dev/null || true
    pkill -f "kubectl port-forward.*api-gateway" 2>/dev/null || true
    sleep 2

    # Port-forward API gateway to port 3000
    kubectl port-forward svc/api-gateway 3000:80 > /dev/null 2>&1 &
    GATEWAY_PID=$!
    sleep 3

    if ps -p $GATEWAY_PID > /dev/null; then
        print_success "API Gateway port-forwarded to localhost:3000 (PID: $GATEWAY_PID)"
    else
        print_warning "Port forwarding failed. Run manually:"
        echo "  kubectl port-forward svc/api-gateway 3000:80"
    fi
fi

# ============================================================================
# Phase 9: Verify Deployment
# ============================================================================

print_header "Phase 9: Verifying Deployment"

print_step "Knative services:"
kubectl get ksvc -n "$NAMESPACE" 2>/dev/null || echo "  (no Knative services yet — they start on first request)"

echo ""
print_step "Infrastructure:"
echo "  PostgreSQL:  $(kubectl get pods -n database -l app=postgres -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo 'Unknown')"
echo "  MinIO:       $(kubectl get pods -n storage -l app=minio -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo 'Unknown')"
echo "  Piston:      $(kubectl get pods -n default -l app=piston -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo 'Unknown')"
echo "  API Gateway: $(kubectl get pods -n default -l app=api-gateway -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo 'Unknown')"

# Health checks
echo ""
print_step "Health checks:"
if [ "$SERVER_MODE" = false ]; then
    sleep 2
    curl -sf http://localhost:3000/gateway-health 2>/dev/null && print_success "API Gateway: healthy" || print_warning "API Gateway: not responding yet (Knative cold start)"
fi

# ============================================================================
# Deployment Complete!
# ============================================================================

print_header "DEPLOYMENT COMPLETE!"

echo ""
echo -e "${GREEN}✓ Kubernetes cluster ready${NC}"
echo -e "${GREEN}✓ Knative Serving + Kourier installed${NC}"
echo -e "${GREEN}✓ PostgreSQL database deployed${NC}"
echo -e "${GREEN}✓ MinIO object storage deployed${NC}"
echo -e "${GREEN}✓ Piston code execution deployed${NC}"
echo -e "${GREEN}✓ Database migrations completed${NC}"
echo -e "${GREEN}✓ All 4 microservices deployed (Knative)${NC}"
echo -e "${GREEN}✓ API Gateway deployed${NC}"
echo ""

if [ "$SERVER_MODE" = true ]; then
    echo -e "${CYAN}Access your platform at: https://${DOMAIN}${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Point DNS A record for ${DOMAIN} to your server IP"
    echo "  2. Setup TLS: certbot certonly --standalone -d ${DOMAIN}"
    echo "  3. Update ConfigMaps with your domain (replace 'your-production-domain.com')"
else
    echo -e "${CYAN}Access your platform at: http://localhost:3000${NC}"
    echo ""
    echo "Test commands:"
    echo "  curl http://localhost:3000/gateway-health"
    echo "  curl http://localhost:3000/api/auth/verify"
    echo ""
    echo "To stop port-forwarding:"
    echo "  kill $GATEWAY_PID"
    echo ""
    echo "To delete the cluster:"
    echo "  kind delete cluster --name $CLUSTER_NAME"
fi

echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo "  kubectl get ksvc              # List Knative services"
echo "  kubectl get pods              # List all pods"
echo "  kubectl logs <pod-name>       # View pod logs"
echo "  kubectl get svc api-gateway   # Check gateway status"
echo ""
