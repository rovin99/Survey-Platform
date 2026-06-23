#!/bin/bash

# ============================================================================
# Create Kubernetes Secrets for Survey Platform
# ============================================================================
# This script creates actual secrets from templates for all microservices
# 
# Usage: ./create-secrets.sh
# 
# WARNING: This script contains sensitive data. DO NOT commit to version control!
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Survey Platform - Secrets Creation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================================
# Configuration Variables
# ============================================================================

# Database credentials
DB_USER="postgres"
DB_PASSWORD="postgres123"  # Change this for production!
DB_HOST="postgres-db.database.svc.cluster.local"
DB_PORT="5432"
DB_NAME="SurveyDb"

# JWT Configuration (IMPORTANT: Use same key across all services!)
JWT_SECRET_KEY="survey-platform-jwt-secret-key-change-this-in-production-min-32-chars"
JWT_ISSUER="AuthService"
JWT_AUDIENCE="SurveyApp"
JWT_DURATION="60"

# SMTP Configuration (for email notifications)
SMTP_EMAIL="your-email@gmail.com"
SMTP_APP_PASSWORD="your-app-password"  # Gmail app password or SMTP password

# Target namespace
NAMESPACE="default"

# ============================================================================
# Functions
# ============================================================================

create_secret_if_not_exists() {
    local secret_name=$1
    local namespace=$2
    
    if kubectl get secret "$secret_name" -n "$namespace" &> /dev/null; then
        echo -e "${YELLOW}⚠️  Secret '$secret_name' already exists in namespace '$namespace'${NC}"
        read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kubectl delete secret "$secret_name" -n "$namespace"
            echo -e "${GREEN}✓ Deleted existing secret${NC}"
            return 0
        else
            echo -e "${BLUE}→ Skipping '$secret_name'${NC}"
            return 1
        fi
    fi
    return 0
}

# ============================================================================
# Create AuthService Secrets
# ============================================================================

echo -e "${BLUE}Creating AuthService secrets...${NC}"

if create_secret_if_not_exists "auth-service-secrets" "$NAMESPACE"; then
    kubectl create secret generic auth-service-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=CONNECTION_STRING="Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD}" \
        --from-literal=JWT_KEY="$JWT_SECRET_KEY" \
        --from-literal=JWT_ISSUER="$JWT_ISSUER" \
        --from-literal=JWT_AUDIENCE="$JWT_AUDIENCE" \
        --from-literal=JWT_DURATION="$JWT_DURATION"
    
    echo -e "${GREEN}✓ AuthService secrets created${NC}"
fi

echo ""

# ============================================================================
# Create SurveyManagementService Secrets
# ============================================================================

echo -e "${BLUE}Creating SurveyManagementService secrets...${NC}"

if create_secret_if_not_exists "survey-service-secrets" "$NAMESPACE"; then
    kubectl create secret generic survey-service-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=DB_USER="$DB_USER" \
        --from-literal=DB_PASSWORD="$DB_PASSWORD" \
        --from-literal=JWT_SECRET_KEY="$JWT_SECRET_KEY" \
        --from-literal=EMAIL="$SMTP_EMAIL" \
        --from-literal=APP_PASS="$SMTP_APP_PASSWORD"
    
    echo -e "${GREEN}✓ SurveyManagementService secrets created${NC}"
fi

echo ""

# ============================================================================
# Create ParticipantsManagementService Secrets
# ============================================================================

echo -e "${BLUE}Creating ParticipantsManagementService secrets...${NC}"

if create_secret_if_not_exists "participants-service-secrets" "$NAMESPACE"; then
    kubectl create secret generic participants-service-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=DB_USER="$DB_USER" \
        --from-literal=DB_PASSWORD="$DB_PASSWORD" \
        --from-literal=JWT_SECRET_KEY="$JWT_SECRET_KEY"
    
    echo -e "${GREEN}✓ ParticipantsManagementService secrets created${NC}"
fi

echo ""

# ============================================================================
# Verify Secrets
# ============================================================================

echo -e "${BLUE}Verifying created secrets...${NC}"
echo ""

kubectl get secrets -n "$NAMESPACE" | grep -E "(auth-service-secrets|survey-service-secrets|participants-service-secrets)" || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Secrets creation completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  SECURITY NOTES:${NC}"
echo -e "${YELLOW}1. These are development secrets. Change them for production!${NC}"
echo -e "${YELLOW}2. JWT_SECRET_KEY must be the same across all services${NC}"
echo -e "${YELLOW}3. Consider using Sealed Secrets or External Secrets Operator for production${NC}"
echo -e "${YELLOW}4. DO NOT commit this script with actual secrets to version control${NC}"
echo ""

