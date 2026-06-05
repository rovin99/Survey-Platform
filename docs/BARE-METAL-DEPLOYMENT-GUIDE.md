# Bare Metal Deployment Guide

Deploy the Survey Platform on your own servers — college lab, on-premise data center, or any Linux machine.

---

## Quick Decision: Which Approach?


| Question                             | Docker Compose  | Kubernetes (k3s)           |
| ------------------------------------ | --------------- | -------------------------- |
| Concurrent users < 500?              | **Use this**    | Overkill                   |
| Need auto-scaling?                   | No              | **Use this**               |
| Multiple colleges sharing?           | No              | **Use this**               |
| Budget for 1 server only?            | **Use this**    | Possible (single-node k3s) |
| Want zero-downtime deploys?          | Manual restarts | **Use this**               |
| Team knows Kubernetes?               | Not needed      | **Use this**               |
| Want scale-to-zero (save resources)? | No              | **Use this**               |


---

## Platform Components


| Component                | Technology      | Purpose                              | Resource Usage        |
| ------------------------ | --------------- | ------------------------------------ | --------------------- |
| **API Gateway**          | Nginx           | Routes traffic to services           | 10-50 MB RAM          |
| **Auth Service**         | .NET 9          | Login, JWT, user management          | 150-300 MB RAM        |
| **Survey Service**       | Go/Fiber        | Survey CRUD, invitations, email      | 30-100 MB RAM         |
| **Participants Service** | Go/Fiber        | Sessions, evaluation, grading        | 30-100 MB RAM         |
| **Frontend**             | Next.js         | React web UI                         | 200-400 MB RAM        |
| **PostgreSQL**           | Postgres 15     | Database for all services            | 200 MB - 1 GB RAM     |
| **MinIO**                | MinIO           | S3-compatible media storage          | 100-200 MB RAM        |
| **Piston**               | Piston          | Sandboxed code execution (50+ langs) | 200 MB - 2 GB RAM     |
| **Knative**              | Knative Serving | Auto-scaling, scale-to-zero          | 500 MB RAM (K8s only) |
| **Kourier**              | Kourier         | Knative networking layer             | 100 MB RAM (K8s only) |


---

## Resource Requirements

### Verified Resource Usage (Load Tested)

Actual measured values from running the platform with 200 concurrent users (k6 load test, 198 req/sec):

| Service | RAM (Idle) | RAM (Under Load) | CPU (Idle) |
|---------|-----------|-------------------|-----------|
| Auth Service (.NET) | 179 MB | ~300 MB | 0.96% |
| Survey Service (Go) | 23 MB | ~80 MB | 0.09% |
| Participants Service (Go) | 21 MB | ~80 MB | 0.05% |
| Frontend (Next.js) | 93 MB | ~200 MB | 0.00% |
| PostgreSQL | 64 MB | ~300 MB | 0.00% |
| MinIO | 169 MB | ~200 MB | 0.10% |
| Piston (code execution) | 181 MB | ~2 GB | 0.00% |
| Nginx (API gateway) | 5 MB | ~20 MB | 0.00% |
| **Total (without Piston)** | **~554 MB** | **~1.2 GB** | |
| **Total (with Piston)** | **~735 MB** | **~3.2 GB** | |

Load test results (200 virtual users, 2 minutes):
- Throughput: **198 requests/sec**
- Average response: **6.48ms**
- p95 response: **18.56ms**
- Max response: **52.47ms**

### Sizing Guide

| Scale | Concurrent Users | CPU | RAM | Storage | Code Execution | Example |
|-------|-----------------|-----|-----|---------|:-:|---------|
| **Minimum** | 50 | 2 cores | 4 GB | 50 GB SSD | No | One class quiz |
| **Recommended** | 200 | **2 cores** | **4 GB** | **50 GB SSD** | **No** | **Department exam — verified by load test** |
| **With code questions** | 200 | 4 cores | 8 GB | 100 GB SSD | Yes (Piston) | Programming assessments |
| **Large** | 500 | 4 cores | 8 GB | 100 GB SSD | No | Multiple simultaneous quizzes |
| **Large + code** | 500 | 8 cores | 16 GB | 100 GB SSD | Yes | College-wide coding exam |
| **XL** | 1000+ | 8 cores | 16 GB | 250 GB SSD | Optional | College-wide exam day |

### Single-Node k3s with KVM (Recommended Setup)

**For up to 200 concurrent users without code execution:**

```
┌──────────── Physical Server (x86/amd64, Ubuntu 22.04) ──────────┐
│                                                                    │
│  KVM Hypervisor                                                   │
│                                                                    │
│  ┌─ VM: survey-platform ────────────────────────────────────┐    │
│  │                                                           │    │
│  │  Ubuntu 22.04 LTS                                        │    │
│  │  2 cores, 4 GB RAM, 50 GB SSD                            │    │
│  │                                                           │    │
│  │  k3s (single node = master + worker)                      │    │
│  │  Knative + Kourier (auto-scaling, scale-to-zero)         │    │
│  │                                                           │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │    │
│  │  │API GW  │ │Auth Svc│ │Survey  │ │Parts.  │            │    │
│  │  │(nginx) │ │(.NET)  │ │Svc(Go) │ │Svc(Go) │            │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘            │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐                        │    │
│  │  │Frontend│ │Postgres│ │ MinIO  │                        │    │
│  │  │(Next)  │ │  (DB)  │ │(files) │                        │    │
│  │  └────────┘ └────────┘ └────────┘                        │    │
│  │                                                           │    │
│  │  Total idle: ~1.5 GB   Under load: ~2.7 GB               │    │
│  │  Headroom: ~1.3 GB                                        │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                    │
│  Remaining server resources available for other VMs               │
└────────────────────────────────────────────────────────────────────┘
```

**VM Specification:**

| Resource | Value | Why |
|----------|-------|-----|
| **CPU** | 2 cores (x86/amd64) | Handles 198 req/sec verified |
| **RAM** | 4 GB | Services use ~1.2 GB under load + 1 GB for OS/k3s + 1.8 GB buffer |
| **Storage** | 50 GB SSD | ~10 GB base + room for data growth |
| **OS** | Ubuntu 22.04 LTS | Docker, k3s, .NET, Go all officially supported |
| **Architecture** | x86/amd64 (Intel/AMD) | Required if using Piston. ARM works for everything else. |

### With Code Execution (Piston)

If you need programming questions, add more resources to the same VM:

| Resource | Without Piston | With Piston |
|----------|:---:|:---:|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 50 GB | 100 GB |
| **Architecture** | x86 or ARM | x86 only (Piston is x86 native) |

### Multi-Node k3s with KVM (For 500+ Users or Team Isolation)

| VM | Role | CPU | RAM | Storage | Runs |
|----|------|-----|-----|---------|------|
| **k8s-master** | Master + Worker | 4 cores | 8 GB | 100 GB SSD | k3s control plane, PostgreSQL, Knative |
| **k8s-worker-1** | Worker | 4 cores | 8 GB | 50 GB SSD | Auth, Survey, Participants, Frontend |
| **k8s-worker-2** | Worker | 4 cores | 8 GB | 50 GB SSD | Piston (code exec), MinIO |
| **Total** | | **12 cores** | **24 GB** | **200 GB** | |

### Scaling Reference

| Event | What Happens | Resources Needed |
|-------|-------------|-----------------|
| 50 students take MCQ quiz | Light DB reads/writes | 2 cores, 4 GB (verified) |
| 200 students take MCQ quiz | Moderate DB load, 198 req/sec | 2 cores, 4 GB (verified) |
| 200 students with code execution | Piston bottleneck | 4 cores, 8 GB |
| 500 students take MCQ quiz | Heavy DB + service load | 4 cores, 8 GB |
| 1000 students submit at same time | DB write spike | 8 cores, 16 GB, SSD required |
| Image uploads (50 students, 5MB each) | 250 MB MinIO writes | Network bandwidth matters |

### Per-Service Auto-Scaling (Kubernetes Only)

| Service | Min Replicas | Max Replicas | Scale Trigger |
|---------|:---:|:---:|--------------|
| Auth Service | 0 (scale-to-zero) | 10 | 10 concurrent requests |
| Survey Service | 0 | 15 | 10 concurrent requests |
| Participants Service | 0 | 15 | 10 concurrent requests |
| Frontend | 1 (always on) | 3 | 10 concurrent requests |
| Piston | 1 (always on) | 3 | Manual scaling |
| PostgreSQL | 1 (always on) | 1 | Single instance |
| MinIO | 1 (always on) | 1 | Single instance |


---

## Dependencies Checklist

### Server Software


| Software           | Version   | Purpose                  | Install Command                                              |
| ------------------ | --------- | ------------------------ | ------------------------------------------------------------ |
| **Ubuntu**         | 22.04 LTS | OS                       | —                                                            |
| **Docker**         | 24+       | Container runtime        | `curl -fsSL [https://get.docker.com](https://get.docker.com) |
| **Docker Compose** | v2.20+    | Orchestration (Option 1) | `sudo apt install docker-compose-plugin`                     |
| **k3s**            | v1.28+    | Kubernetes (Option 2)    | `curl -sfL [https://get.k3s.io](https://get.k3s.io)          |
| **kubectl**        | v1.28+    | K8s CLI (Option 2)       | Bundled with k3s                                             |
| **Git**            | 2.34+     | Clone repo               | `sudo apt install git`                                       |
| **certbot**        | Latest    | TLS certs                | `sudo apt install certbot`                                   |
| **envsubst**       | Latest    | Template secrets         | `sudo apt install gettext-base`                              |


### Network Requirements


| Port     | Direction     | Purpose               |
| -------- | ------------- | --------------------- |
| 22/tcp   | Inbound       | SSH                   |
| 80/tcp   | Inbound       | HTTP → HTTPS redirect |
| 443/tcp  | Inbound       | HTTPS (main entry)    |
| 6443/tcp | Internal only | k3s API (K8s option)  |
| 5432/tcp | Internal only | PostgreSQL            |
| 9000/tcp | Internal only | MinIO API             |
| 2000/tcp | Internal only | Piston API            |


### DNS


| Record                   | Type | Value                   |
| ------------------------ | ---- | ----------------------- |
| `survey.yourcollege.edu` | A    | Your server's public IP |


### External Services (Optional)


| Service       | Purpose                                   | Cost                        |
| ------------- | ----------------------------------------- | --------------------------- |
| Gmail SMTP    | Email (magic links, results, invitations) | Free (500/day)              |
| OpenAI API    | AI survey generation                      | Pay-per-use (~$0.01/survey) |
| Let's Encrypt | TLS certificate                           | Free                        |


---

## Option 1: Docker Compose (Single Server)

### Quick Start (5 minutes)

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Clone and start
cd /opt
sudo git clone https://github.com/your-org/Survey-Platform.git
cd Survey-Platform
sudo chown -R $USER:$USER .

# 3. Start (uses docker-compose.local.yml as-is)
docker compose -f docker-compose.local.yml up -d

# 4. Check
docker compose -f docker-compose.local.yml ps
echo "Ready at http://$(hostname -I | awk '{print $1}'):3000"
```

### Production Hardening

```bash
# Generate strong secrets
JWT_SECRET=$(openssl rand -base64 48)
DB_PASS=$(openssl rand -base64 24)
MINIO_PASS=$(openssl rand -base64 24)

# Update docker-compose.local.yml with these values (replace defaults)
# Then restart: docker compose -f docker-compose.local.yml up -d

# Firewall
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable

# TLS
sudo certbot certonly --standalone -d survey.yourcollege.edu

# Database backup (daily at 2 AM)
echo '0 2 * * * docker exec survey-postgres pg_dump -U postgres SurveyDb | gzip > /opt/backups/db_$(date +\%Y\%m\%d).sql.gz' | sudo tee /etc/cron.d/survey-backup
```

---

## Option 2: Kubernetes with k3s

### Architecture

```
                    ┌─────────────┐
                    │   Internet   │
                    └──────┬──────┘
                           │ HTTPS
                    ┌──────▼──────┐
                    │ API Gateway  │ (nginx, path-based routing)
                    │ LoadBalancer │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
   │ Auth Service │ │Survey Service│ │Participants │
   │  (Knative)  │ │  (Knative)  │ │  (Knative)  │
   │ scale 0→10  │ │ scale 0→15  │ │ scale 0→15  │
   └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
   │  PostgreSQL  │ │    MinIO    │ │   Piston    │
   │   (PVC)     │ │    (PVC)    │ │ (sandboxed) │
   └─────────────┘ └─────────────┘ └─────────────┘
```

### Step 1: Install k3s

**Single-node:**

```bash
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc
```

**Multi-node (Master):**

```bash
# On Node 1 (master)
curl -sfL https://get.k3s.io | sh -
sudo cat /var/lib/rancher/k3s/server/node-token  # Save this token
```

**Multi-node (Workers):**

```bash
# On Node 2, Node 3
curl -sfL https://get.k3s.io | K3S_URL=https://<NODE1_IP>:6443 K3S_TOKEN=<TOKEN> sh -
```

### Step 2: Deploy Everything

```bash
cd /opt/Survey-Platform

# Set your domain
export DOMAIN=survey.yourcollege.edu

# Set secrets
export POSTGRES_USER=surveydb
export POSTGRES_PASSWORD=$(openssl rand -base64 24)
export JWT_SECRET_KEY=$(openssl rand -base64 48)
export INTERNAL_API_KEY=$(openssl rand -base64 32)
export MINIO_ACCESS_KEY=minio_admin
export MINIO_SECRET_KEY=$(openssl rand -base64 24)
export SMTP_EMAIL=your-email@gmail.com
export SMTP_APP_PASSWORD=your-app-password

# Run the deployment script
./deploy-local-cluster.sh --server
```

The script handles everything:

1. Connects to your k3s cluster
2. Installs Knative + Kourier
3. Deploys PostgreSQL, MinIO, Piston
4. Creates secrets and ConfigMaps
5. Runs database migrations
6. Deploys all 4 microservices as Knative services
7. Deploys the API gateway
8. Verifies everything is healthy

### Step 3: Setup TLS

```bash
sudo apt install certbot -y
sudo certbot certonly --standalone -d $DOMAIN

# Create TLS secret in K8s
kubectl create secret tls survey-tls \
  --cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem \
  --key=/etc/letsencrypt/live/$DOMAIN/privkey.pem

# Auto-renew
echo "0 3 * * * certbot renew --quiet && kubectl create secret tls survey-tls --cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem --key=/etc/letsencrypt/live/$DOMAIN/privkey.pem --dry-run=client -o yaml | kubectl apply -f -" | sudo tee /etc/cron.d/cert-renewal
```

### Step 4: Update Domain in ConfigMaps

```bash
# Replace placeholder domain in all ConfigMaps
for cm in auth-service-config survey-service-config participants-service-config frontend-config; do
  kubectl get configmap $cm -o yaml | \
    sed "s/your-production-domain.com/$DOMAIN/g" | \
    kubectl apply -f -
done

# Restart services to pick up new config
kubectl delete pods --all -n default
```

---

## Maintenance

### Daily Monitoring

```bash
# Quick health check
kubectl get pods -A | grep -v Running | grep -v Completed

# Service status
kubectl get ksvc

# Resource usage
kubectl top pods    # Requires metrics-server
kubectl top nodes

# Logs
kubectl logs -l app=auth-service --tail=50
kubectl logs -l app=survey-management-service --tail=50
```

### Database Backup

```bash
# Manual backup
kubectl exec -n database deploy/postgres -- pg_dump -U postgres SurveyDb | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip < backup_20260328.sql.gz | kubectl exec -i -n database deploy/postgres -- psql -U postgres SurveyDb

# Automated daily backup (add to crontab)
0 2 * * * kubectl exec -n database deploy/postgres -- pg_dump -U postgres SurveyDb | gzip > /opt/backups/db_$(date +\%Y\%m\%d).sql.gz
```

### Updating the Platform

```bash
cd /opt/Survey-Platform
git pull origin main

# Rebuild images (if building locally)
docker build -t auth-service:latest ./AuthService
docker build -t survey-service:latest ./SurveyManagementService
docker build -t participant-service:latest ./ParticipantsManagementService
docker build -t frontend:latest ./frontend

# Push to local registry or load into k3s
# For k3s with local images:
sudo k3s ctr images import <image.tar>

# Update Knative services
kn service update auth-service --image auth-service:latest
kn service update survey-management-service --image survey-service:latest
kn service update participants-management-service --image participant-service:latest
kn service update frontend --image frontend:latest
```

### Scaling During Exams

```bash
# Pre-warm services before a big exam (prevent cold-start delays)
kubectl scale deployment --replicas=2 -l app=auth-service
kubectl scale deployment --replicas=2 -l app=survey-management-service
kubectl scale deployment --replicas=3 -l app=participants-management-service

# Add more Piston capacity for code-heavy exams
kubectl scale deployment/piston --replicas=3

# After exam: let Knative scale back to zero
# (happens automatically after 30 seconds of no traffic)
```

---

## Option 3: Kubernetes with KVM Virtual Machines as Nodes

Use this when your college IT requires VM-level isolation, or you have one large server shared across multiple teams/departments.

**Zero application code changes.** Same Docker images, same Knative YAMLs, same deploy script. Only the infrastructure underneath differs.

### Architecture

```
┌──────────── Physical Server (128 GB RAM, 32 cores) ──────────┐
│                                                                │
│  Ubuntu 22.04 + KVM/libvirt (or Proxmox)                      │
│                                                                │
│  ┌─ VM: k8s-master ────────┐  ┌─ VM: k8s-worker-1 ────────┐ │
│  │ Ubuntu 22.04             │  │ Ubuntu 22.04               │ │
│  │ 8 cores, 32 GB, 100 GB  │  │ 8 cores, 32 GB, 100 GB    │ │
│  │ IP: 192.168.122.10      │  │ IP: 192.168.122.11         │ │
│  │ k3s server (master)      │  │ k3s agent (worker)         │ │
│  └──────────────────────────┘  └────────────────────────────┘ │
│                                                                │
│  ┌─ VM: k8s-worker-2 ──────┐  ┌─ Remaining ────────────────┐ │
│  │ Ubuntu 22.04             │  │ 8 cores, 32 GB             │ │
│  │ 8 cores, 32 GB, 100 GB  │  │ Available for future VMs   │ │
│  │ IP: 192.168.122.12      │  │ or other applications      │ │
│  │ k3s agent (worker)       │  │                             │ │
│  └──────────────────────────┘  └─────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### VM Resource Allocation

**Single-Node (Recommended for ≤ 200 users, no Piston):**

| VM | Role | CPU | RAM | Storage | Runs |
|----|------|-----|-----|---------|------|
| **survey-platform** | Master + Worker | **2 cores** | **4 GB** | **50 GB SSD** | Everything (verified by load test) |

**Single-Node with Piston (≤ 200 users + code execution):**

| VM | Role | CPU | RAM | Storage | Runs |
|----|------|-----|-----|---------|------|
| **survey-platform** | Master + Worker | **4 cores** | **8 GB** | **100 GB SSD** | Everything including Piston |

**Multi-Node (500+ users or team isolation on large server):**

| VM | Role | CPU | RAM | Storage | Runs |
|----|------|-----|-----|---------|------|
| **k8s-master** | Master + Worker | 4 cores | 8 GB | 100 GB SSD | k3s control plane, PostgreSQL, Knative |
| **k8s-worker-1** | Worker | 4 cores | 8 GB | 50 GB SSD | Auth, Survey, Participants, Frontend |
| **k8s-worker-2** | Worker | 4 cores | 8 GB | 50 GB SSD | Piston (code exec), MinIO |
| **Total** | | **12 cores** | **24 GB** | **200 GB** | |


### Step 1: Install KVM on the Physical Server

```bash
# Install KVM and management tools
sudo apt update
sudo apt install -y qemu-kvm libvirt-daemon-system virtinst bridge-utils

# Verify KVM is working
sudo systemctl status libvirtd
virsh list --all

# Download Ubuntu 22.04 server ISO
wget https://releases.ubuntu.com/22.04/ubuntu-22.04.4-live-server-amd64.iso
```

### Step 2: Create VMs

```bash
# Single-Node VM (2 cores, 4 GB RAM, 50 GB disk — handles 200 users)
sudo virt-install \
  --name survey-platform \
  --ram 4096 \
  --vcpus 2 \
  --disk size=50 \
  --os-variant ubuntu22.04 \
  --cdrom ubuntu-22.04.4-live-server-amd64.iso \
  --network bridge=virbr0 \
  --graphics vnc

# OR: With Piston (4 cores, 8 GB RAM, 100 GB disk)
# sudo virt-install \
#   --name survey-platform \
#   --ram 8192 \
#   --vcpus 4 \
#   --disk size=100 \
#   --os-variant ubuntu22.04 \
#   --cdrom ubuntu-22.04.4-live-server-amd64.iso \
#   --network bridge=virbr0 \
#   --graphics vnc

# OR: Multi-Node (create 3 VMs for 500+ users)
# sudo virt-install --name k8s-master   --ram 8192 --vcpus 4 --disk size=100 ...
# sudo virt-install --name k8s-worker-1 --ram 8192 --vcpus 4 --disk size=50 ...
# sudo virt-install --name k8s-worker-2 --ram 8192 --vcpus 4 --disk size=50 ...
```

Complete the Ubuntu installer on each VM (set hostname, user, SSH enabled).

### Step 3: Install Docker on All VMs

```bash
# Run on each VM
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Step 4: Install k3s (Identical to Bare Metal)

```bash
# On master VM (192.168.122.10)
curl -sfL https://get.k3s.io | sh -
sudo cat /var/lib/rancher/k3s/server/node-token
# Save this token for workers

# On worker-1 VM (192.168.122.11)
curl -sfL https://get.k3s.io | K3S_URL=https://192.168.122.10:6443 K3S_TOKEN=<TOKEN> sh -

# On worker-2 VM (192.168.122.12)
curl -sfL https://get.k3s.io | K3S_URL=https://192.168.122.10:6443 K3S_TOKEN=<TOKEN> sh -

# Verify on master
kubectl get nodes
# Should show 3 nodes: master, worker-1, worker-2
```

### Step 5: Deploy Survey Platform (IDENTICAL to Bare Metal)

```bash
# On master VM
cd /opt
git clone https://github.com/your-org/Survey-Platform.git
cd Survey-Platform

# Same deploy script as bare metal
./deploy-local-cluster.sh --server
```

From this point onward, everything is identical — same Knative services, same ConfigMaps, same CI/CD pipeline.

### VM Management Commands

```bash
# List all VMs
virsh list --all

# Start/stop VMs
virsh start k8s-master
virsh shutdown k8s-worker-1

# Snapshot (before upgrades)
virsh snapshot-create-as k8s-master "pre-upgrade-2026-04-13"
virsh snapshot-revert k8s-master "pre-upgrade-2026-04-13"  # Rollback

# Console access
virsh console k8s-master

# Resource monitoring
virt-top
```

### KVM vs Proxmox


|               | KVM/libvirt (CLI)                 | Proxmox VE (Web UI)                    |
| ------------- | --------------------------------- | -------------------------------------- |
| **Cost**      | Free                              | Free                                   |
| **Install**   | `apt install qemu-kvm`            | Replace OS with Proxmox ISO            |
| **Create VM** | `virt-install` command            | Click buttons in browser               |
| **Monitor**   | `virt-top`, `virsh`               | Web dashboard at `https://server:8006` |
| **Snapshots** | `virsh snapshot-create`           | One click in UI                        |
| **Backups**   | Manual scripts                    | Built-in scheduled backups             |
| **Best for**  | Linux admins comfortable with CLI | Everyone else                          |


If your college IT manages the infrastructure, **Proxmox** is easier for them. If you're managing it yourself and comfortable with the terminal, **KVM/libvirt** is lighter.

### Multi-Team Isolation with VMs

If multiple departments share the physical server, each team gets their own VM(s):

```
Physical Server (128 GB)
├─ VM: cs-dept     (32 GB) → runs full Survey Platform for CS department
├─ VM: ee-dept     (32 GB) → runs full Survey Platform for EE department
├─ VM: management  (32 GB) → runs full Survey Platform for admin
└─ VM: spare       (32 GB) → future expansion
```

Each VM runs its own independent Docker Compose or k3s installation. Complete isolation — one department's crash doesn't affect others.

### What Changes Between Bare Metal and VMs


| Component               | Change Needed                         |
| ----------------------- | ------------------------------------- |
| Application code        | None                                  |
| Docker images           | None                                  |
| Knative YAMLs           | None                                  |
| ConfigMaps / Secrets    | None                                  |
| deploy-local-cluster.sh | None                                  |
| CI/CD pipeline          | None                                  |
| k3s installation        | Same commands, run inside VMs         |
| Network configuration   | VM bridge IPs instead of physical IPs |
| **Total effort**        | ~1 hour (create VMs + install k3s)    |


---

## Troubleshooting


| Problem                   | Diagnosis                                  | Fix                                         |
| ------------------------- | ------------------------------------------ | ------------------------------------------- |
| 502 Bad Gateway           | `kubectl get pods` — crashed pod?          | `kubectl delete pod <name>` (auto-restarts) |
| Service not starting      | `kubectl describe pod <name>`              | Check image pull, resource limits           |
| Code execution fails      | `kubectl logs -l app=piston`               | Piston needs privileged mode                |
| Database connection error | `kubectl logs -l app=postgres -n database` | Check secrets match                         |
| Slow first request        | Knative cold-start (normal)                | Pre-warm before exams                       |
| Out of memory             | `kubectl top pods`                         | Increase node RAM or add node               |
| Disk full                 | `df -h` on node                            | `docker system prune` or expand PVC         |


---

## Cost Estimate

### Hardware Options


**Without Piston (2 cores, 4 GB — sufficient for 200 users):**

| Option | Specs | Monthly | One-Time | Best For |
|--------|-------|---------|----------|----------|
| **Existing lab server** | Any x86 machine with 4 GB+ | $0 | $0 | Testing & small deployments |
| **Hetzner CX22** | 2 cores, 4 GB, 40 GB SSD | **$4/mo** | — | **Cheapest cloud option** |
| **Hetzner CPX11** | 2 cores, 4 GB, 80 GB SSD | **$5/mo** | — | Dedicated CPU |
| **DigitalOcean** | 2 cores, 4 GB, 80 GB SSD | $24/mo | — | Easy cloud |
| **AWS t3.medium** | 2 cores, 4 GB | $30/mo | — | AWS ecosystem |

**With Piston (4 cores, 8 GB — code execution):**

| Option | Specs | Monthly | One-Time | Best For |
|--------|-------|---------|----------|----------|
| **Hetzner CPX21** | 3 cores, 4 GB, 80 GB | $9/mo | — | Budget with code |
| **Hetzner CPX31** | 4 cores, 8 GB, 160 GB | **$16/mo** | — | **Recommended** |
| **Refurbished server** | 4+ core, 8+ GB | — | $150-300 | Self-hosted |
| **DigitalOcean** | 4 cores, 8 GB | $48/mo | — | Easy cloud |

**Multi-Node (500+ users):**

| Option | Specs | Monthly | Best For |
|--------|-------|---------|----------|
| **3x Hetzner CX22** | 6 cores, 12 GB total | $12/mo | Budget cluster |
| **3x Hetzner CPX21** | 9 cores, 12 GB total | $27/mo | With code execution |
| **Dedicated server** | 16+ cores, 32+ GB | $40-80/mo | High load |

### Recurring Costs

| Item | Cost |
|------|------|
| Domain name | $10-15/year |
| TLS certificate | Free (Let's Encrypt) |
| Gmail SMTP | Free |
| Electricity (1 server) | $5-10/month |
| **Total (self-hosted)** | **$15/year** |
| **Total (cheapest cloud)** | **$4-5/month** |
| **Total (recommended cloud)** | **$16/month** |


