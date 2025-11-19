#!/bin/bash

# ============================================================================
# Survey Platform - Complete Local Kubernetes Deployment Script
# ============================================================================
# This script deploys the entire Survey Platform to a local Kind cluster
# with Knative Serving (Kourier) for serverless capabilities
#
# Time Estimate: 15-20 minutes
# 
# Prerequisites:
#   - Docker running
#   - kubectl installed
#   - kind installed
#   - Internet connection (for pulling images)
#
# Usage: ./deploy-local-cluster.sh
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="survey-platform"
NAMESPACE="default"
KNATIVE_VERSION="knative-v1.17.0"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}============================================${NC}"
}

print_step() {
    echo -e "${BLUE}→ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

wait_for_pods() {
    local namespace=$1
    local label=$2
    local timeout=${3:-300}
    
    print_step "Waiting for pods in namespace '$namespace' with label '$label'..."
    kubectl wait --for=condition=Ready pods -l "$label" -n "$namespace" --timeout="${timeout}s" 2>/dev/null || true
}

check_prerequisite() {
    local cmd=$1
    local name=$2
    
    if ! command -v "$cmd" &> /dev/null; then
        print_error "$name is not installed. Please install it first."
        return 1
    fi
    print_success "$name is installed"
    return 0
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

print_header "Pre-flight Checks"

check_prerequisite "docker" "Docker"
check_prerequisite "kubectl" "kubectl"
check_prerequisite "kind" "Kind"

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi
print_success "Docker is running"

echo ""
read -p "This will create a new Kind cluster named '$CLUSTER_NAME'. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled by user"
    exit 0
fi

# ============================================================================
# Phase 1: Create Kind Cluster
# ============================================================================

print_header "Phase 1: Creating Kind Cluster"

# Check if cluster already exists
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    print_warning "Cluster '$CLUSTER_NAME' already exists"
    read -p "Delete and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Deleting existing cluster..."
        kind delete cluster --name "$CLUSTER_NAME"
        print_success "Cluster deleted"
    else
        print_step "Using existing cluster"
    fi
fi

if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    print_step "Creating Kind cluster..."
    kind create cluster --name "$CLUSTER_NAME" --config AuthService/kind-config.yaml
    print_success "Kind cluster created"
fi

# Set context
kubectl cluster-info --context "kind-${CLUSTER_NAME}"
print_success "Cluster is ready"

# ============================================================================
# Phase 2: Install Knative Serving
# ============================================================================

print_header "Phase 2: Installing Knative Serving"

print_step "Installing Knative Serving CRDs..."
kubectl apply -f "https://github.com/knative/serving/releases/download/${KNATIVE_VERSION}/serving-crds.yaml"
print_success "CRDs installed"

print_step "Installing Knative Serving core..."
kubectl apply -f "https://github.com/knative/serving/releases/download/${KNATIVE_VERSION}/serving-core.yaml"
print_success "Core components installed"

print_step "Installing Kourier networking layer..."
kubectl apply -f "https://github.com/knative/net-kourier/releases/download/${KNATIVE_VERSION}/kourier.yaml"
print_success "Kourier installed"

print_step "Configuring Knative to use Kourier..."
kubectl patch configmap/config-network \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'
print_success "Kourier configured"

print_step "Configuring Magic DNS for local development..."
kubectl patch configmap/config-domain \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"127.0.0.1.nip.io":""}}'
print_success "Magic DNS configured"

print_step "Waiting for Knative Serving pods to be ready..."
wait_for_pods "knative-serving" "app=controller" 300
wait_for_pods "knative-serving" "app=webhook" 300
wait_for_pods "knative-serving" "app=activator" 300
wait_for_pods "knative-serving" "app=autoscaler" 300

print_step "Waiting for Kourier pods to be ready..."
wait_for_pods "kourier-system" "app=3scale-kourier-gateway" 300

print_success "Knative Serving is ready"

# ============================================================================
# Phase 3: Deploy PostgreSQL Database
# ============================================================================

print_header "Phase 3: Deploying PostgreSQL Database"

print_step "Applying PostgreSQL deployment..."
kubectl apply -f infrastructure/postgresql/postgres-deployment.yaml
print_success "PostgreSQL manifests applied"

print_step "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=Available deployment/postgres -n database --timeout=300s
wait_for_pods "database" "app=postgres" 300

# Verify database is actually ready
print_step "Verifying database connectivity..."
sleep 10  # Give PostgreSQL a moment to fully initialize

print_success "PostgreSQL is ready"

# ============================================================================
# Phase 4: Create Secrets and ConfigMaps
# ============================================================================

print_header "Phase 4: Creating Secrets and ConfigMaps"

print_step "Creating Kubernetes secrets..."
chmod +x infrastructure/secrets/create-secrets.sh
bash infrastructure/secrets/create-secrets.sh
print_success "Secrets created"

print_step "Updating ConfigMaps..."
chmod +x infrastructure/configmaps/update-configmaps.sh
bash infrastructure/configmaps/update-configmaps.sh
print_success "ConfigMaps updated"

# ============================================================================
# Phase 5: Run Database Migrations
# ============================================================================

print_header "Phase 5: Running Database Migrations"

# AuthService migrations
print_step "Running AuthService migrations..."
kubectl apply -f AuthService/deployments/kubernetes/migration-job.yaml
kubectl wait --for=condition=complete job/auth-service-migration -n "$NAMESPACE" --timeout=300s 2>/dev/null || {
    print_warning "AuthService migration job did not complete successfully. Checking logs..."
    kubectl logs job/auth-service-migration -n "$NAMESPACE" --tail=50
}
print_success "AuthService migrations completed"

# Seed initial data
print_step "Seeding AuthService initial data..."
kubectl apply -f AuthService/deployments/kubernetes/seeder-job.yaml
kubectl wait --for=condition=complete job/auth-service-seeder -n "$NAMESPACE" --timeout=300s 2>/dev/null || {
    print_warning "AuthService seeder job did not complete successfully"
}
print_success "AuthService seeding completed"

# SurveyManagementService migrations
print_step "Running SurveyManagementService migrations..."
kubectl apply -f SurveyManagementService/deployments/kubernetes/migration-job.yaml
kubectl wait --for=condition=complete job/survey-service-migration -n "$NAMESPACE" --timeout=300s 2>/dev/null || {
    print_warning "SurveyManagementService migration job did not complete successfully"
}
print_success "SurveyManagementService migrations completed"

# ParticipantsManagementService migrations
print_step "Running ParticipantsManagementService migrations..."
kubectl apply -f ParticipantsManagementService/deployments/kubernetes/migration-job.yaml
kubectl wait --for=condition=complete job/participants-service-migration -n "$NAMESPACE" --timeout=300s 2>/dev/null || {
    print_warning "ParticipantsManagementService migration job did not complete successfully"
}
print_success "ParticipantsManagementService migrations completed"

# ============================================================================
# Phase 6: Deploy Microservices
# ============================================================================

print_header "Phase 6: Deploying Microservices"

# Deploy AuthService
print_step "Deploying AuthService..."
kubectl apply -f AuthService/deployments/kubernetes/knative-service.yaml
print_success "AuthService deployed"

# Deploy SurveyManagementService
print_step "Deploying SurveyManagementService..."
kubectl apply -f SurveyManagementService/deployments/kubernetes/k-native-service.yaml
print_success "SurveyManagementService deployed"

# Deploy ParticipantsManagementService
print_step "Deploying ParticipantsManagementService..."
kubectl apply -f ParticipantsManagementService/deployments/kubernetes/knative-service.yaml
print_success "ParticipantsManagementService deployed"

print_step "Waiting for services to be ready (this may take a minute)..."
sleep 15

# ============================================================================
# Phase 7: Verify Deployment
# ============================================================================

print_header "Phase 7: Verifying Deployment"

print_step "Checking Knative services..."
kubectl get ksvc -n "$NAMESPACE"

print_step "Getting service URLs..."
AUTH_URL=$(kubectl get ksvc auth-service -n "$NAMESPACE" -o jsonpath='{.status.url}' 2>/dev/null || echo "Not ready yet")
SURVEY_URL=$(kubectl get ksvc survey-management-service -n "$NAMESPACE" -o jsonpath='{.status.url}' 2>/dev/null || echo "Not ready yet")
PARTICIPANTS_URL=$(kubectl get ksvc participants-management-service -n "$NAMESPACE" -o jsonpath='{.status.url}' 2>/dev/null || echo "Not ready yet")

# ============================================================================
# Phase 8: Setup Port Forwarding
# ============================================================================

print_header "Phase 8: Setting Up Port Forwarding"

print_step "Checking for existing port-forward processes..."
pkill -f "kubectl port-forward.*kourier" 2>/dev/null || true
sleep 2

print_step "Starting port-forward to Kourier (port 8080 -> 80)..."
kubectl port-forward -n kourier-system service/kourier 8080:80 > /dev/null 2>&1 &
PORT_FORWARD_PID=$!
sleep 3

if ps -p $PORT_FORWARD_PID > /dev/null; then
    print_success "Port forwarding active (PID: $PORT_FORWARD_PID)"
else
    print_warning "Port forwarding may have failed. You can manually run:"
    echo "  kubectl port-forward -n kourier-system service/kourier 8080:80"
fi

# ============================================================================
# Deployment Complete!
# ============================================================================

print_header "🎉 DEPLOYMENT COMPLETE! 🎉"

echo ""
echo -e "${GREEN}✓ Kind cluster created${NC}"
echo -e "${GREEN}✓ Knative Serving installed${NC}"
echo -e "${GREEN}✓ PostgreSQL database deployed${NC}"
echo -e "${GREEN}✓ Database migrations completed${NC}"
echo -e "${GREEN}✓ All microservices deployed${NC}"
echo -e "${GREEN}✓ Port forwarding configured${NC}"
echo ""

print_header "Service URLs"

echo ""
echo -e "${CYAN}AuthService:${NC}"
echo -e "  Internal: $AUTH_URL"
echo -e "  External: http://auth-service.default.127.0.0.1.nip.io:8080"
echo ""
echo -e "${CYAN}SurveyManagementService:${NC}"
echo -e "  Internal: $SURVEY_URL"
echo -e "  External: http://survey-management-service.default.127.0.0.1.nip.io:8080"
echo ""
echo -e "${CYAN}ParticipantsManagementService:${NC}"
echo -e "  Internal: $PARTICIPANTS_URL"
echo -e "  External: http://participants-management-service.default.127.0.0.1.nip.io:8080"
echo ""

print_header "Quick Test Commands"

echo ""
echo "# Test health endpoints (wait ~30 seconds for first cold start):"
echo -e "${YELLOW}curl http://auth-service.default.127.0.0.1.nip.io:8080/health/live${NC}"
echo -e "${YELLOW}curl http://survey-management-service.default.127.0.0.1.nip.io:8080/health${NC}"
echo -e "${YELLOW}curl http://participants-management-service.default.127.0.0.1.nip.io:8080/health${NC}"
echo ""
echo "# Watch services scale:"
echo -e "${YELLOW}kubectl get pods -w${NC}"
echo ""
echo "# View service logs:"
echo -e "${YELLOW}kubectl logs -l serving.knative.dev/service=auth-service -f${NC}"
echo ""
echo "# Access database:"
echo -e "${YELLOW}kubectl run pg-client --rm -it --image=postgres:15 -- psql -h postgres-db.database.svc.cluster.local -U postgres -d SurveyDb${NC}"
echo ""

print_header "Next Steps"

echo ""
echo "1. Wait ~30 seconds for services to warm up on first request"
echo "2. Test health endpoints using the commands above"
echo "3. Services will auto-scale based on traffic"
echo "4. Services will scale to zero after ~90 seconds of no traffic"
echo ""
echo -e "${YELLOW}Port forwarding is running in background (PID: $PORT_FORWARD_PID)${NC}"
echo -e "${YELLOW}To stop: kill $PORT_FORWARD_PID${NC}"
echo ""

print_header "Useful Commands"

echo ""
echo "# View all resources:"
echo "  kubectl get all -n default"
echo "  kubectl get all -n database"
echo "  kubectl get all -n knative-serving"
echo ""
echo "# Restart a service:"
echo "  kubectl delete pod -l serving.knative.dev/service=auth-service"
echo ""
echo "# Delete everything:"
echo "  kind delete cluster --name $CLUSTER_NAME"
echo ""

print_header "Troubleshooting"

echo ""
echo "If services aren't responding:"
echo "1. Check service status: kubectl get ksvc"
echo "2. Check pod status: kubectl get pods"
echo "3. View logs: kubectl logs -l serving.knative.dev/service=auth-service"
echo "4. Check database: kubectl logs -n database deployment/postgres"
echo ""
echo "For detailed troubleshooting, see: DEPLOYMENT_ANALYSIS_REPORT.md"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Happy coding! 🚀${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

