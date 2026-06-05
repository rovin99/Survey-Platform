#!/bin/bash

# Script to build and deploy frontend to local Kubernetes cluster

set -e

DOCKER_USERNAME="${1:-rovin123}"

echo "======================================"
echo "🚀 Frontend Deployment to Kubernetes"
echo "======================================"
echo ""

# Step 1: Build Docker image
echo "📦 Step 1: Building frontend Docker image..."
cd frontend
docker build -t ${DOCKER_USERNAME}/frontend:v1 .
cd ..
echo "✅ Frontend image built!"
echo ""

# Step 2: Push to Docker Hub (optional, can use local image with Kind)
echo "📤 Step 2: Pushing to Docker Hub..."
docker push ${DOCKER_USERNAME}/frontend:v1
echo "✅ Image pushed!"
echo ""

# Step 3: Apply ConfigMap
echo "⚙️  Step 3: Creating ConfigMap..."
kubectl apply -f frontend/deployments/kubernetes/configmap.yaml
echo "✅ ConfigMap created!"
echo ""

# Step 4: Deploy frontend service
echo "🚀 Step 4: Deploying frontend to Knative..."
kubectl apply -f frontend/deployments/kubernetes/knative-service.yaml
echo "✅ Frontend service deployed!"
echo ""

# Step 5: Wait for service to be ready
echo "⏳ Step 5: Waiting for frontend to be ready..."
kubectl wait --for=condition=Ready ksvc/frontend --timeout=300s || echo "⚠️  Timeout - check status manually"
echo ""

# Step 6: Get service URL
echo "🌐 Step 6: Getting frontend URL..."
FRONTEND_URL=$(kubectl get ksvc frontend -o jsonpath='{.status.url}')
echo "✅ Frontend URL: $FRONTEND_URL"
echo ""

# Step 7: Show access instructions
echo "======================================"
echo "✅ Frontend Deployment Complete!"
echo "======================================"
echo ""
echo "📋 Frontend URL:"
echo "   $FRONTEND_URL"
echo ""
echo "🔧 To check service status:"
echo "   kubectl get ksvc frontend"
echo ""






