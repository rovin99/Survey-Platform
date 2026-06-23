#!/usr/bin/env bash
# Build all four images on a capable machine (NOT the 4GB VM) and push to a registry.
# The frontend is environment-specific: its NEXT_PUBLIC_* URLs are baked at build time, so it must
# be built with the VM's public address.
#
# Usage:  ./build-and-push.sh <registry> <vm-ip-or-host>
#   e.g.  ./build-and-push.sh docker.io/rovin99 203.0.113.10
set -euo pipefail

REGISTRY="${1:?usage: build-and-push.sh <registry> <vm-ip-or-host>}"
VM_HOST="${2:?usage: build-and-push.sh <registry> <vm-ip-or-host>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="http://${VM_HOST}"

echo ">> Registry: ${REGISTRY}   App URL baked into frontend: ${BASE_URL}"

echo ">> auth-service"
docker build -t "${REGISTRY}/auth-service:latest" "${ROOT}/AuthService"
docker push "${REGISTRY}/auth-service:latest"

echo ">> survey-service"
docker build -t "${REGISTRY}/survey-service:latest" "${ROOT}/SurveyManagementService"
docker push "${REGISTRY}/survey-service:latest"

echo ">> participant-service"
docker build -t "${REGISTRY}/participant-service:latest" "${ROOT}/ParticipantsManagementService"
docker push "${REGISTRY}/participant-service:latest"

echo ">> frontend (baked with ${BASE_URL})"
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL="${BASE_URL}" \
  --build-arg NEXT_PUBLIC_AUTH_SERVICE_URL="${BASE_URL}" \
  --build-arg NEXT_PUBLIC_SURVEY_SERVICE_URL="${BASE_URL}" \
  --build-arg NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL="${BASE_URL}" \
  -t "${REGISTRY}/frontend:latest" "${ROOT}/frontend"
docker push "${REGISTRY}/frontend:latest"

echo ">> Done. Now run k3s/deploy-k3s.sh ${REGISTRY} ${VM_HOST} on the VM."
