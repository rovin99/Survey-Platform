#!/usr/bin/env bash
# Deploy Survey-Platform on a single-node k3s VM. Run ON the VM.
# Prereqs: images already built & pushed (see build-and-push.sh) to <registry>.
#
# Usage:  sudo ./deploy-k3s.sh <registry> [vm-ip]
#   e.g.  sudo ./deploy-k3s.sh docker.io/rovin99 203.0.113.10
# If vm-ip is omitted, the default route IP is auto-detected.
set -euo pipefail

REGISTRY="${1:?usage: deploy-k3s.sh <registry> [vm-ip]}"
VM_IP="${2:-$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')}"
DIR="$(cd "$(dirname "$0")" && pwd)"
: "${VM_IP:?could not detect VM IP; pass it as the 2nd argument}"

echo ">> Deploying with registry=${REGISTRY} vm-ip=${VM_IP}"

# 1. Install k3s if not present (ships Traefik ingress + local-path storage + metrics-server).
if ! command -v k3s >/dev/null 2>&1; then
  echo ">> Installing k3s..."
  curl -sfL https://get.k3s.io | sh -
fi
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
KC="k3s kubectl"

# 2. Render manifests (substitute placeholders) into a temp dir.
RENDER="$(mktemp -d)"
trap 'rm -rf "$RENDER"' EXIT
for f in "$DIR"/*.yaml; do
  sed -e "s|__REGISTRY__|${REGISTRY}|g" -e "s|__VM_IP__|${VM_IP}|g" "$f" > "$RENDER/$(basename "$f")"
done

# 3. Apply in dependency order.
echo ">> Namespaces, secrets, config"
$KC apply -f "$RENDER/00-namespaces.yaml"
$KC apply -f "$RENDER/01-secrets.yaml"
$KC apply -f "$RENDER/02-config.yaml"

echo ">> Infrastructure (postgres, minio)"
$KC apply -f "$RENDER/10-postgres.yaml"
$KC apply -f "$RENDER/11-minio.yaml"
$KC -n database rollout status deploy/postgres --timeout=180s
$KC -n storage  rollout status deploy/minio    --timeout=180s

echo ">> App services + gateway"
$KC apply -f "$RENDER/20-apps.yaml"
$KC apply -f "$RENDER/30-gateway.yaml"

echo ">> Waiting for rollouts (auth runs DB migrate+seed on first start)..."
for d in auth-service survey-service participants-service frontend survey-gateway; do
  $KC -n default rollout status deploy/$d --timeout=240s
done

echo ""
echo "==================================================================="
echo " Survey-Platform is up:  http://${VM_IP}"
echo " Pods:   k3s kubectl get pods -A"
echo " Memory: k3s kubectl top pods -A"
echo "==================================================================="
