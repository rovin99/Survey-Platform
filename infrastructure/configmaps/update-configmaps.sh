#!/bin/bash

# ============================================================================
# Update ConfigMaps with Correct Database Configuration
# ============================================================================
# This script updates all ConfigMaps to point to the correct database host
# 
# Usage: ./update-configmaps.sh
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Updating ConfigMaps${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Database configuration
DB_HOST="postgres-db.database.svc.cluster.local"
DB_PORT="5432"
DB_NAME="SurveyDb"
DB_SSLMODE="disable"

NAMESPACE="default"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ============================================================================
# Update AuthService ConfigMap
# ============================================================================

echo -e "${BLUE}Updating AuthService ConfigMap...${NC}"

cat > /tmp/auth-service-configmap.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-service-config
  namespace: ${NAMESPACE}
data:
  ASPNETCORE_ENVIRONMENT: "Production"
  JWT_ISSUER: "AuthService"
  JWT_AUDIENCE: "SurveyApp"
  JWT_DURATION: "60"
  # Database host (non-sensitive)
  DB_HOST: "${DB_HOST}"
EOF

kubectl apply -f /tmp/auth-service-configmap.yaml
echo -e "${GREEN}✓ AuthService ConfigMap updated${NC}"
echo ""

# ============================================================================
# Update SurveyManagementService ConfigMap
# ============================================================================

echo -e "${BLUE}Updating SurveyManagementService ConfigMap...${NC}"

cat > /tmp/survey-service-configmap.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: survey-service-config
  namespace: ${NAMESPACE}
  labels:
    app: survey-management-service
data:
  # Application Environment
  ENVIRONMENT: "production"
  GIN_MODE: "release"
  
  # Database Configuration (non-sensitive)
  DB_HOST: "${DB_HOST}"
  DB_PORT: "${DB_PORT}"
  DB_NAME: "${DB_NAME}"
  DB_SSLMODE: "${DB_SSLMODE}"
  
  # JWT Configuration (non-sensitive)
  JWT_ISSUER: "AuthService"
  JWT_AUDIENCE: "SurveyApp"
  
  # Timezone
  TZ: "UTC"
EOF

kubectl apply -f /tmp/survey-service-configmap.yaml
echo -e "${GREEN}✓ SurveyManagementService ConfigMap updated${NC}"
echo ""

# ============================================================================
# Update ParticipantsManagementService ConfigMap
# ============================================================================

echo -e "${BLUE}Updating ParticipantsManagementService ConfigMap...${NC}"

cat > /tmp/participants-service-configmap.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: participants-service-config
  namespace: ${NAMESPACE}
  labels:
    app: participants-management-service
data:
  # Application Environment
  APP_ENV: "production"
  GIN_MODE: "release"
  
  # Database Configuration (non-sensitive)
  DB_HOST: "${DB_HOST}"
  DB_PORT: "${DB_PORT}"
  DB_NAME: "${DB_NAME}"
  DB_SSLMODE: "${DB_SSLMODE}"
  
  # Service Port (Knative will override with PORT env var)
  PORT: "8080"
  
  # Timezone
  TZ: "UTC"
  
  # CORS Configuration
  CORS_ORIGINS: "http://localhost:3000,https://your-production-domain.com"
  
  # Logging
  LOG_LEVEL: "info"
EOF

kubectl apply -f /tmp/participants-service-configmap.yaml
echo -e "${GREEN}✓ ParticipantsManagementService ConfigMap updated${NC}"
echo ""

# ============================================================================
# Cleanup and Verify
# ============================================================================

rm -f /tmp/auth-service-configmap.yaml
rm -f /tmp/survey-service-configmap.yaml
rm -f /tmp/participants-service-configmap.yaml

echo -e "${BLUE}Verifying ConfigMaps...${NC}"
kubectl get configmaps -n ${NAMESPACE} | grep -E "(auth-service-config|survey-service-config|participants-service-config)"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ ConfigMaps updated successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

