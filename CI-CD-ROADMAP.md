# CI/CD Pipeline Roadmap for Survey Platform
## 2-Day Implementation Plan

> **Tech Stack**: GitHub Actions (CI/CD), Docker (Containerization), Kubernetes/K3s (Orchestration), ArgoCD (GitOps), SonarQube (Code Quality), Trivy (Security Scanning)

---

## Overview

### Services to Deploy:
1. **AuthService** (.NET Core)
2. **SurveyManagementService** (Go)
3. **ParticipantsManagementService** (Go)
4. **Frontend** (Next.js)
5. **PostgreSQL** (Database)

### CI/CD Architecture:
```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│   GitHub    │─────>│    GitHub    │─────>│   Docker    │─────>│  Kubernetes  │
│    Push     │      │   Actions    │      │   Registry  │      │   Cluster    │
└─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
                            │                                           │
                            │                                           │
                            ▼                                           ▼
                     ┌──────────────┐                            ┌──────────────┐
                     │  Code Quality│                            │   ArgoCD     │
                     │  & Security  │                            │   (GitOps)   │
                     └──────────────┘                            └──────────────┘
```

---

# Day 1: Foundation & CI Pipeline

## Morning Session (4 hours): Infrastructure & Setup

### 1. Project Structure Setup (30 mins)
**Goal**: Organize repository for CI/CD

#### Tasks:
- [ ] Create `.github/workflows/` directory
- [ ] Create `k8s/` directory for Kubernetes manifests
- [ ] Create `docker/` directory for centralized Dockerfiles
- [ ] Create `scripts/` directory for automation scripts
- [ ] Update `.gitignore` to exclude CI/CD artifacts

**File Structure**:
```
Survey-Platform/
├── .github/
│   └── workflows/
│       ├── auth-service-ci.yml
│       ├── survey-service-ci.yml
│       ├── participant-service-ci.yml
│       ├── frontend-ci.yml
│       └── deploy-cd.yml
├── k8s/
│   ├── base/
│   │   ├── namespaces/
│   │   ├── configmaps/
│   │   ├── secrets/
│   │   └── services/
│   ├── dev/
│   ├── staging/
│   └── production/
├── docker/
│   ├── auth-service.Dockerfile
│   ├── survey-service.Dockerfile
│   ├── participant-service.Dockerfile
│   └── frontend.Dockerfile
├── scripts/
│   ├── setup-cluster.sh
│   ├── deploy.sh
│   └── rollback.sh
└── README.md
```

---

### 2. Docker Registry Setup (30 mins)
**Goal**: Set up container image storage

#### Option A: GitHub Container Registry (Recommended - Free)
```yaml
# No additional setup needed
# Uses ghcr.io/your-username/image-name
```

#### Option B: Docker Hub
```bash
# Create account at hub.docker.com
# Add secrets to GitHub:
# - DOCKER_USERNAME
# - DOCKER_PASSWORD
```

#### Tasks:
- [ ] Choose registry (GitHub Container Registry recommended)
- [ ] Add registry credentials to GitHub Secrets
- [ ] Test authentication from local machine

---

### 3. Kubernetes Cluster Setup (2 hours)
**Goal**: Set up local/cloud Kubernetes cluster

#### Option A: Local Development (K3s/Kind)
```bash
# Install K3s (lightweight Kubernetes)
curl -sfL https://get.k3s.io | sh -

# Or use Kind (Kubernetes in Docker)
brew install kind
kind create cluster --name survey-platform
```

#### Option B: Cloud Provider (GKE/EKS/AKS)
```bash
# Example: Google Cloud (GKE)
gcloud container clusters create survey-platform \
  --num-nodes=3 \
  --machine-type=e2-medium \
  --zone=us-central1-a

# Example: AWS (EKS)
eksctl create cluster \
  --name survey-platform \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3
```

#### Tasks:
- [ ] Install Kubernetes cluster (K3s for local, GKE/EKS for cloud)
- [ ] Install `kubectl` CLI tool
- [ ] Configure `kubectl` to connect to cluster
- [ ] Verify cluster access: `kubectl get nodes`
- [ ] Install Helm: `brew install helm` (for package management)

---

### 4. Install Essential Kubernetes Tools (1 hour)

#### A. Install Nginx Ingress Controller
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

#### B. Install Cert-Manager (SSL/TLS)
```bash
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

#### C. Install ArgoCD (GitOps)
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

#### Tasks:
- [ ] Install Nginx Ingress Controller
- [ ] Install Cert-Manager
- [ ] Install ArgoCD
- [ ] Access ArgoCD UI and change admin password
- [ ] Install ArgoCD CLI: `brew install argocd`

---

## Afternoon Session (4 hours): CI Pipeline Implementation

### 5. Build Optimized Dockerfiles (1 hour)

#### A. AuthService Dockerfile (Multi-stage)
```dockerfile
# docker/auth-service.Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY ["AuthService/AuthService.csproj", "AuthService/"]
RUN dotnet restore "AuthService/AuthService.csproj"

# Copy everything else and build
COPY AuthService/ AuthService/
WORKDIR "/src/AuthService"
RUN dotnet build "AuthService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "AuthService.csproj" -c Release -o /app/publish

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Create non-root user
RUN addgroup --system --gid 1001 dotnet && \
    adduser --system --uid 1001 --ingroup dotnet dotnet && \
    chown -R dotnet:dotnet /app

USER dotnet
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "AuthService.dll"]
```

#### B. SurveyManagementService Dockerfile
```dockerfile
# docker/survey-service.Dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY SurveyManagementService/go.mod SurveyManagementService/go.sum ./
RUN go mod download

# Copy source code
COPY SurveyManagementService/ .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Runtime image
FROM alpine:latest
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/main .

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001
CMD ["./main"]
```

#### C. ParticipantsManagementService Dockerfile
```dockerfile
# docker/participant-service.Dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git

COPY ParticipantsManagementService/go.mod ParticipantsManagementService/go.sum ./
RUN go mod download

COPY ParticipantsManagementService/ .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates

WORKDIR /root/
COPY --from=builder /app/main .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8081
CMD ["./main"]
```

#### D. Frontend Dockerfile
```dockerfile
# docker/frontend.Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

#### Tasks:
- [ ] Create all Dockerfiles in `docker/` directory
- [ ] Test each Dockerfile locally
- [ ] Optimize image sizes using multi-stage builds
- [ ] Add .dockerignore files

---

### 6. GitHub Actions CI Workflows (2 hours)

#### A. AuthService CI Pipeline
```yaml
# .github/workflows/auth-service-ci.yml
name: AuthService CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'AuthService/**'
      - 'docker/auth-service.Dockerfile'
      - '.github/workflows/auth-service-ci.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'AuthService/**'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/auth-service

jobs:
  test:
    name: Test & Quality Check
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Shallow clones disabled for SonarQube
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'
      
      - name: Restore dependencies
        run: dotnet restore AuthService/AuthService.csproj
      
      - name: Build
        run: dotnet build AuthService/AuthService.csproj --no-restore
      
      - name: Run tests
        run: dotnet test AuthService/AuthService.csproj --no-build --verbosity normal --collect:"XPlat Code Coverage"
      
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        with:
          args: >
            -Dsonar.projectKey=survey-platform-auth
            -Dsonar.organization=your-org
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          flags: authservice

  build-and-push:
    name: Build and Push Docker Image
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/auth-service.Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Run Trivy security scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

#### B. Go Services CI (Template for Survey & Participant Services)
```yaml
# .github/workflows/survey-service-ci.yml
name: SurveyManagementService CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'SurveyManagementService/**'
      - 'docker/survey-service.Dockerfile'
  pull_request:
    branches: [main, develop]
    paths:
      - 'SurveyManagementService/**'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/survey-service

jobs:
  test:
    name: Test & Quality Check
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Cache Go modules
        uses: actions/cache@v3
        with:
          path: ~/go/pkg/mod
          key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
          restore-keys: |
            ${{ runner.os }}-go-
      
      - name: Install dependencies
        working-directory: ./SurveyManagementService
        run: go mod download
      
      - name: Run golangci-lint
        uses: golangci/golangci-lint-action@v3
        with:
          version: latest
          working-directory: ./SurveyManagementService
      
      - name: Run tests
        working-directory: ./SurveyManagementService
        run: go test -v -race -coverprofile=coverage.out -covermode=atomic ./...
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./SurveyManagementService/coverage.out
          flags: surveyservice
      
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  build-and-push:
    name: Build and Push Docker Image
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/survey-service.Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Run Trivy security scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
```

#### C. Frontend CI Pipeline
```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'frontend/**'
      - 'docker/frontend.Dockerfile'
  pull_request:
    branches: [main, develop]
    paths:
      - 'frontend/**'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/frontend

jobs:
  test:
    name: Test & Quality Check
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Run ESLint
        working-directory: ./frontend
        run: npm run lint
      
      - name: Run type check
        working-directory: ./frontend
        run: npm run type-check || npx tsc --noEmit
      
      - name: Run tests
        working-directory: ./frontend
        run: npm test -- --coverage || echo "No tests configured"
      
      - name: Build application
        working-directory: ./frontend
        run: npm run build
        env:
          NEXT_PUBLIC_AUTH_API_URL: ${{ secrets.NEXT_PUBLIC_AUTH_API_URL }}
      
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  build-and-push:
    name: Build and Push Docker Image
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/frontend.Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_AUTH_API_URL=${{ secrets.NEXT_PUBLIC_AUTH_API_URL }}
```

#### Tasks:
- [ ] Create all CI workflow files
- [ ] Configure GitHub Secrets (SONAR_TOKEN, etc.)
- [ ] Test each workflow by pushing to a test branch
- [ ] Verify Docker images are pushed to registry
- [ ] Check security scan results

---

### 7. Setup Code Quality Tools (1 hour)

#### A. SonarCloud Setup
```bash
# 1. Go to sonarcloud.io
# 2. Sign in with GitHub
# 3. Import your repository
# 4. Get SONAR_TOKEN from SonarCloud
# 5. Add to GitHub Secrets
```

#### B. Create sonar-project.properties
```properties
# sonar-project.properties
sonar.projectKey=survey-platform
sonar.organization=your-org

# Language-specific settings
sonar.sources=.
sonar.exclusions=**/node_modules/**,**/bin/**,**/obj/**,**/*.test.ts,**/*.test.tsx

# Go settings
sonar.go.coverage.reportPaths=**/coverage.out

# .NET settings
sonar.cs.opencover.reportsPaths=**/coverage.xml

# JavaScript/TypeScript settings
sonar.javascript.lcov.reportPaths=**/coverage/lcov.info
```

#### C. Setup Codecov
```bash
# 1. Go to codecov.io
# 2. Sign in with GitHub
# 3. Enable your repository
# 4. Add CODECOV_TOKEN to GitHub Secrets (optional for public repos)
```

#### Tasks:
- [ ] Sign up for SonarCloud
- [ ] Import repository to SonarCloud
- [ ] Add SONAR_TOKEN to GitHub Secrets
- [ ] Sign up for Codecov
- [ ] Create sonar-project.properties file
- [ ] Test code quality scans

---

# Day 2: CD Pipeline & GitOps

## Morning Session (4 hours): Kubernetes Manifests

### 8. Create Kubernetes Base Manifests (2 hours)

#### A. Namespace
```yaml
# k8s/base/namespaces/survey-platform.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: survey-platform
  labels:
    name: survey-platform
```

#### B. ConfigMap
```yaml
# k8s/base/configmaps/app-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: survey-platform
data:
  # Database
  DB_HOST: "postgresql-service"
  DB_PORT: "5432"
  DB_NAME: "SurveyDb"
  DB_SSLMODE: "disable"
  
  # Services URLs
  AUTH_SERVICE_URL: "http://auth-service:8080"
  SURVEY_SERVICE_URL: "http://survey-service:3001"
  PARTICIPANT_SERVICE_URL: "http://participant-service:8081"
  
  # App Configuration
  APP_ENV: "development"
  LOG_LEVEL: "info"
```

#### C. Secrets (Template)
```yaml
# k8s/base/secrets/app-secrets.yaml.template
# Copy to app-secrets.yaml and add to .gitignore
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: survey-platform
type: Opaque
stringData:
  # Database
  DB_USER: "postgres"
  DB_PASSWORD: "<YOUR_DB_PASSWORD>"
  
  # JWT
  JWT_KEY: "<YOUR_JWT_SECRET>"
  JWT_ISSUER: "SurveyPlatform"
  JWT_AUDIENCE: "SurveyPlatformAPI"
  
  # Email (if using)
  EMAIL_USERNAME: ""
  EMAIL_PASSWORD: ""
```

#### D. PostgreSQL Deployment
```yaml
# k8s/base/services/postgresql.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgresql-pvc
  namespace: survey-platform
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgresql
  namespace: survey-platform
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      containers:
      - name: postgresql
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgresql-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgresql-storage
        persistentVolumeClaim:
          claimName: postgresql-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgresql-service
  namespace: survey-platform
spec:
  selector:
    app: postgresql
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

#### E. AuthService Deployment
```yaml
# k8s/base/services/auth-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: survey-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
        version: v1
    spec:
      containers:
      - name: auth-service
        image: ghcr.io/YOUR_USERNAME/survey-platform/auth-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: ASPNETCORE_ENVIRONMENT
          value: "Production"
        - name: ConnectionStrings__DefaultConnection
          value: "Host=$(DB_HOST);Port=$(DB_PORT);Database=$(DB_NAME);Username=$(DB_USER);Password=$(DB_PASSWORD);SSL Mode=$(DB_SSLMODE)"
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/auth/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/auth/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
      imagePullSecrets:
      - name: ghcr-secret
---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: survey-platform
spec:
  selector:
    app: auth-service
  ports:
  - port: 8080
    targetPort: 8080
    name: http
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: survey-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### F. SurveyService & ParticipantService (Similar structure)
```yaml
# k8s/base/services/survey-service.yaml
# Similar to auth-service but with different image and ports
apiVersion: apps/v1
kind: Deployment
metadata:
  name: survey-service
  namespace: survey-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: survey-service
  template:
    metadata:
      labels:
        app: survey-service
    spec:
      containers:
      - name: survey-service
        image: ghcr.io/YOUR_USERNAME/survey-platform/survey-service:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 20
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: survey-service
  namespace: survey-platform
spec:
  selector:
    app: survey-service
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
```

#### G. Frontend Deployment
```yaml
# k8s/base/services/frontend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: survey-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: ghcr.io/YOUR_USERNAME/survey-platform/frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_AUTH_API_URL
          value: "https://api.survey-platform.com/api/auth"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "400m"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: survey-platform
spec:
  selector:
    app: frontend
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

#### H. Ingress Configuration
```yaml
# k8s/base/ingress/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: survey-platform-ingress
  namespace: survey-platform
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - survey-platform.com
    - api.survey-platform.com
    secretName: survey-platform-tls
  rules:
  - host: survey-platform.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 3000
  - host: api.survey-platform.com
    http:
      paths:
      - path: /api/auth
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 8080
      - path: /api/v1
        pathType: Prefix
        backend:
          service:
            name: survey-service
            port:
              number: 3001
      - path: /api/participants
        pathType: Prefix
        backend:
          service:
            name: participant-service
            port:
              number: 8081
```

#### Tasks:
- [ ] Create all Kubernetes manifest files
- [ ] Create separate overlays for dev/staging/prod using Kustomize
- [ ] Test manifests locally: `kubectl apply -f k8s/base/`
- [ ] Verify all pods are running: `kubectl get pods -n survey-platform`

---

### 9. Setup Kustomize for Environment Management (1 hour)

#### Base Kustomization
```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: survey-platform

resources:
  - namespaces/survey-platform.yaml
  - configmaps/app-config.yaml
  - secrets/app-secrets.yaml
  - services/postgresql.yaml
  - services/auth-service.yaml
  - services/survey-service.yaml
  - services/participant-service.yaml
  - services/frontend.yaml
  - ingress/ingress.yaml

commonLabels:
  app.kubernetes.io/managed-by: kustomize
  app.kubernetes.io/part-of: survey-platform
```

#### Dev Environment
```yaml
# k8s/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: survey-platform-dev

bases:
  - ../base

nameSuffix: -dev

replicas:
  - name: auth-service
    count: 1
  - name: survey-service
    count: 1
  - name: participant-service
    count: 1
  - name: frontend
    count: 1

images:
  - name: ghcr.io/YOUR_USERNAME/survey-platform/auth-service
    newTag: develop
  - name: ghcr.io/YOUR_USERNAME/survey-platform/survey-service
    newTag: develop
  - name: ghcr.io/YOUR_USERNAME/survey-platform/participant-service
    newTag: develop
  - name: ghcr.io/YOUR_USERNAME/survey-platform/frontend
    newTag: develop

configMapGenerator:
  - name: app-config
    behavior: merge
    literals:
      - APP_ENV=development
      - LOG_LEVEL=debug
```

#### Production Environment
```yaml
# k8s/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: survey-platform-prod

bases:
  - ../base

nameSuffix: -prod

replicas:
  - name: auth-service
    count: 3
  - name: survey-service
    count: 3
  - name: participant-service
    count: 3
  - name: frontend
    count: 3

images:
  - name: ghcr.io/YOUR_USERNAME/survey-platform/auth-service
    newTag: v1.0.0
  - name: ghcr.io/YOUR_USERNAME/survey-platform/survey-service
    newTag: v1.0.0
  - name: ghcr.io/YOUR_USERNAME/survey-platform/participant-service
    newTag: v1.0.0
  - name: ghcr.io/YOUR_USERNAME/survey-platform/frontend
    newTag: v1.0.0

configMapGenerator:
  - name: app-config
    behavior: merge
    literals:
      - APP_ENV=production
      - LOG_LEVEL=info
```

#### Tasks:
- [ ] Create kustomization files for base, dev, staging, and prod
- [ ] Test with `kubectl kustomize k8s/dev`
- [ ] Apply dev environment: `kubectl apply -k k8s/dev`

---

### 10. Database Migrations Job (30 minutes)

```yaml
# k8s/base/jobs/db-migrations.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: auth-db-migrations
  namespace: survey-platform
spec:
  template:
    spec:
      containers:
      - name: migrations
        image: ghcr.io/YOUR_USERNAME/survey-platform/auth-service:latest
        command: ["dotnet", "ef", "database", "update"]
        env:
        - name: ConnectionStrings__DefaultConnection
          value: "Host=$(DB_HOST);Port=$(DB_PORT);Database=$(DB_NAME);Username=$(DB_USER);Password=$(DB_PASSWORD)"
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
      restartPolicy: OnFailure
  backoffLimit: 3
```

---

## Afternoon Session (4 hours): CD Pipeline & GitOps

### 11. ArgoCD Application Setup (1.5 hours)

#### A. Create ArgoCD Application Manifest
```yaml
# k8s/argocd/survey-platform-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: survey-platform-dev
  namespace: argocd
spec:
  project: default
  
  source:
    repoURL: https://github.com/YOUR_USERNAME/Survey-Platform.git
    targetRevision: develop
    path: k8s/dev
  
  destination:
    server: https://kubernetes.default.svc
    namespace: survey-platform-dev
  
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
    - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: survey-platform-prod
  namespace: argocd
spec:
  project: default
  
  source:
    repoURL: https://github.com/YOUR_USERNAME/Survey-Platform.git
    targetRevision: main
    path: k8s/production
  
  destination:
    server: https://kubernetes.default.svc
    namespace: survey-platform-prod
  
  syncPolicy:
    automated:
      prune: true
      selfHeal: false  # Manual approval for production
    syncOptions:
    - CreateNamespace=true
```

#### B. Apply ArgoCD Applications
```bash
# Apply the ArgoCD application
kubectl apply -f k8s/argocd/survey-platform-app.yaml

# Or use ArgoCD CLI
argocd app create survey-platform-dev \
  --repo https://github.com/YOUR_USERNAME/Survey-Platform.git \
  --path k8s/dev \
  --dest-namespace survey-platform-dev \
  --dest-server https://kubernetes.default.svc \
  --sync-policy automated \
  --auto-prune \
  --self-heal
```

#### Tasks:
- [ ] Create ArgoCD application manifests
- [ ] Apply ArgoCD applications
- [ ] Verify applications in ArgoCD UI
- [ ] Test sync by pushing changes to Git

---

### 12. GitHub Actions CD Workflow (1.5 hours)

```yaml
# .github/workflows/deploy-cd.yml
name: Deploy to Kubernetes

on:
  push:
    branches:
      - main
      - develop
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - staging
          - production

env:
  REGISTRY: ghcr.io

jobs:
  update-manifests:
    name: Update Kubernetes Manifests
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.PAT_TOKEN }}  # Personal Access Token for pushing
      
      - name: Determine environment
        id: env
        run: |
          if [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
            echo "environment=${{ github.event.inputs.environment }}" >> $GITHUB_OUTPUT
          elif [ "${{ github.ref }}" == "refs/heads/main" ]; then
            echo "environment=production" >> $GITHUB_OUTPUT
          else
            echo "environment=dev" >> $GITHUB_OUTPUT
          fi
      
      - name: Update image tags in kustomization
        run: |
          ENV=${{ steps.env.outputs.environment }}
          TAG="${{ github.sha }}"
          
          cd k8s/${ENV}
          
          # Update image tags using kustomize
          kustomize edit set image \
            ghcr.io/${{ github.repository }}/auth-service=ghcr.io/${{ github.repository }}/auth-service:${TAG} \
            ghcr.io/${{ github.repository }}/survey-service=ghcr.io/${{ github.repository }}/survey-service:${TAG} \
            ghcr.io/${{ github.repository }}/participant-service=ghcr.io/${{ github.repository }}/participant-service:${TAG} \
            ghcr.io/${{ github.repository }}/frontend=ghcr.io/${{ github.repository }}/frontend:${TAG}
      
      - name: Commit and push changes
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
          
          git add k8s/
          git commit -m "Update ${{ steps.env.outputs.environment }} deployment to ${{ github.sha }}"
          git push
      
      - name: Trigger ArgoCD sync
        if: steps.env.outputs.environment == 'production'
        run: |
          # Wait for ArgoCD to detect changes
          echo "ArgoCD will automatically sync the changes"
          # Or manually trigger sync using ArgoCD API
          # argocd app sync survey-platform-prod

  notify:
    name: Send Deployment Notification
    needs: update-manifests
    runs-on: ubuntu-latest
    
    steps:
      - name: Send Slack notification
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "Deployment to ${{ needs.update-manifests.outputs.environment }} completed",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Deployment Successful* :white_check_mark:\n*Environment:* ${{ needs.update-manifests.outputs.environment }}\n*Commit:* ${{ github.sha }}\n*Author:* ${{ github.actor }}"
                  }
                }
              ]
            }
```

#### Tasks:
- [ ] Create CD workflow file
- [ ] Generate Personal Access Token (PAT) for GitHub
- [ ] Add PAT to GitHub Secrets as `PAT_TOKEN`
- [ ] Test deployment workflow
- [ ] Verify ArgoCD syncs changes automatically

---

### 13. Monitoring & Observability Setup (1 hour)

#### A. Install Prometheus & Grafana
```bash
# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus + Grafana stack
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=admin123

# Access Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

#### B. ServiceMonitor for Applications
```yaml
# k8s/base/monitoring/service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: auth-service-monitor
  namespace: survey-platform
spec:
  selector:
    matchLabels:
      app: auth-service
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

#### C. Install Loki for Logs
```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set promtail.enabled=true \
  --set grafana.enabled=false
```

#### Tasks:
- [ ] Install Prometheus + Grafana
- [ ] Create ServiceMonitors for all services
- [ ] Access Grafana dashboard
- [ ] Install Loki for centralized logging
- [ ] Configure log aggregation

---

### 14. Backup & Disaster Recovery (30 minutes)

#### A. Install Velero (Kubernetes Backup)
```bash
# Install Velero CLI
brew install velero

# Install Velero in cluster (example with AWS S3)
velero install \
  --provider aws \
  --bucket survey-platform-backups \
  --backup-location-config region=us-west-2 \
  --snapshot-location-config region=us-west-2 \
  --secret-file ./credentials-velero
```

#### B. Create Backup Schedule
```yaml
# k8s/base/backups/schedule.yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: survey-platform-daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  template:
    includedNamespaces:
    - survey-platform
    - survey-platform-dev
    - survey-platform-prod
    ttl: 720h0m0s  # 30 days retention
```

#### C. Database Backup CronJob
```yaml
# k8s/base/backups/db-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: survey-platform
spec:
  schedule: "0 1 * * *"  # Daily at 1 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h postgresql-service -U $POSTGRES_USER $POSTGRES_DB | \
              gzip > /backups/backup-$(date +%Y%m%d-%H%M%S).sql.gz
            env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: DB_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: DB_PASSWORD
            - name: POSTGRES_DB
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: DB_NAME
            volumeMounts:
            - name: backup-storage
              mountPath: /backups
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
```

#### Tasks:
- [ ] Install Velero
- [ ] Configure backup storage (S3/GCS/Azure)
- [ ] Create backup schedules
- [ ] Test backup and restore process
- [ ] Create database backup CronJob

---

### 15. Security Hardening & Best Practices (30 minutes)

#### A. Network Policies
```yaml
# k8s/base/security/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-service-network-policy
  namespace: survey-platform
spec:
  podSelector:
    matchLabels:
      app: auth-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

#### B. Pod Security Standards
```yaml
# k8s/base/security/pod-security.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: survey-platform
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

#### C. RBAC Configuration
```yaml
# k8s/base/security/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: survey-platform-sa
  namespace: survey-platform
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: survey-platform-role
  namespace: survey-platform
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: survey-platform-rolebinding
  namespace: survey-platform
subjects:
- kind: ServiceAccount
  name: survey-platform-sa
roleRef:
  kind: Role
  name: survey-platform-role
  apiGroup: rbac.authorization.k8s.io
```

#### Tasks:
- [ ] Create Network Policies for all services
- [ ] Enable Pod Security Standards
- [ ] Configure RBAC
- [ ] Run security scans with Trivy
- [ ] Review and fix security vulnerabilities

---

## Final Steps & Documentation

### 16. Create Automation Scripts (30 minutes)

#### A. Deployment Script
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-dev}
TAG=${2:-latest}

echo "🚀 Deploying Survey Platform to ${ENVIRONMENT}..."

# Update image tags
cd k8s/${ENVIRONMENT}
kustomize edit set image \
  ghcr.io/YOUR_USERNAME/survey-platform/auth-service=ghcr.io/YOUR_USERNAME/survey-platform/auth-service:${TAG} \
  ghcr.io/YOUR_USERNAME/survey-platform/survey-service=ghcr.io/YOUR_USERNAME/survey-platform/survey-service:${TAG} \
  ghcr.io/YOUR_USERNAME/survey-platform/participant-service=ghcr.io/YOUR_USERNAME/survey-platform/participant-service:${TAG} \
  ghcr.io/YOUR_USERNAME/survey-platform/frontend=ghcr.io/YOUR_USERNAME/survey-platform/frontend:${TAG}

# Apply changes
kubectl apply -k .

# Wait for rollout
echo "⏳ Waiting for deployment to complete..."
kubectl rollout status deployment/auth-service -n survey-platform-${ENVIRONMENT}
kubectl rollout status deployment/survey-service -n survey-platform-${ENVIRONMENT}
kubectl rollout status deployment/participant-service -n survey-platform-${ENVIRONMENT}
kubectl rollout status deployment/frontend -n survey-platform-${ENVIRONMENT}

echo "✅ Deployment completed successfully!"
```

#### B. Rollback Script
```bash
#!/bin/bash
# scripts/rollback.sh

set -e

ENVIRONMENT=${1:-dev}
SERVICE=${2:-all}

echo "🔙 Rolling back ${SERVICE} in ${ENVIRONMENT}..."

if [ "$SERVICE" == "all" ]; then
  kubectl rollout undo deployment/auth-service -n survey-platform-${ENVIRONMENT}
  kubectl rollout undo deployment/survey-service -n survey-platform-${ENVIRONMENT}
  kubectl rollout undo deployment/participant-service -n survey-platform-${ENVIRONMENT}
  kubectl rollout undo deployment/frontend -n survey-platform-${ENVIRONMENT}
else
  kubectl rollout undo deployment/${SERVICE} -n survey-platform-${ENVIRONMENT}
fi

echo "✅ Rollback completed!"
```

#### C. Cluster Setup Script
```bash
#!/bin/bash
# scripts/setup-cluster.sh

set -e

echo "🔧 Setting up Kubernetes cluster..."

# Install prerequisites
echo "📦 Installing Nginx Ingress..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

echo "📦 Installing Cert-Manager..."
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

echo "📦 Installing ArgoCD..."
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "📦 Installing Monitoring Stack..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace

echo "✅ Cluster setup completed!"
echo "🔑 Get ArgoCD password:"
echo "kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
```

#### Tasks:
- [ ] Create deployment script
- [ ] Create rollback script
- [ ] Create cluster setup script
- [ ] Make scripts executable: `chmod +x scripts/*.sh`
- [ ] Test all scripts

---

### 17. Documentation (30 minutes)

#### Create CI-CD-README.md
```markdown
# CI/CD Pipeline Documentation

## Quick Start

### Prerequisites
- Kubernetes cluster (K3s/GKE/EKS/AKS)
- kubectl configured
- Helm installed
- Docker installed
- GitHub account with repository access

### Setup

1. **Setup Cluster**
   ```bash
   ./scripts/setup-cluster.sh
   ```

2. **Configure Secrets**
   ```bash
   # Copy template and fill in values
   cp k8s/base/secrets/app-secrets.yaml.template k8s/base/secrets/app-secrets.yaml
   # Edit app-secrets.yaml with your values
   
   # Apply secrets
   kubectl apply -f k8s/base/secrets/app-secrets.yaml
   ```

3. **Deploy Application**
   ```bash
   # Deploy to dev
   ./scripts/deploy.sh dev latest
   
   # Deploy to production
   ./scripts/deploy.sh production v1.0.0
   ```

### CI/CD Workflows

#### Continuous Integration
- **Trigger**: Push to any branch or pull request
- **Steps**:
  1. Checkout code
  2. Run tests
  3. Code quality scan (SonarCloud)
  4. Build Docker image
  5. Security scan (Trivy)
  6. Push image to registry

#### Continuous Deployment
- **Trigger**: Push to main/develop branches
- **Steps**:
  1. Update Kubernetes manifests
  2. Commit changes to Git
  3. ArgoCD syncs automatically
  4. Deployment verification
  5. Slack notification

### Environments

| Environment | Branch | Auto-Deploy | Replicas |
|-------------|--------|-------------|----------|
| Development | develop | Yes | 1 |
| Staging | staging | Yes | 2 |
| Production | main | Manual approval | 3 |

### Monitoring

- **Grafana**: http://localhost:3000 (port-forward)
- **ArgoCD**: http://localhost:8080 (port-forward)
- **Prometheus**: http://localhost:9090 (port-forward)

### Rollback

```bash
# Rollback all services
./scripts/rollback.sh production all

# Rollback specific service
./scripts/rollback.sh production auth-service
```

### Troubleshooting

#### View logs
```bash
kubectl logs -f deployment/auth-service -n survey-platform-dev
```

#### Check pod status
```bash
kubectl get pods -n survey-platform-dev
```

#### Describe pod
```bash
kubectl describe pod <pod-name> -n survey-platform-dev
```

#### Access pod shell
```bash
kubectl exec -it <pod-name> -n survey-platform-dev -- /bin/sh
```

### Backup & Restore

#### Create backup
```bash
velero backup create survey-platform-backup \
  --include-namespaces survey-platform-prod
```

#### Restore from backup
```bash
velero restore create --from-backup survey-platform-backup
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Developer                            │
└──────────────┬──────────────────────────────────────────────┘
               │ git push
               ▼
┌─────────────────────────────────────────────────────────────┐
│                       GitHub Actions                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Test    │─▶│  Build   │─▶│ Security │─▶│   Push   │   │
│  │          │  │          │  │   Scan   │  │  Image   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Container Registry                        │
│                  (GitHub Container Registry)                 │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                         ArgoCD                               │
│                     (GitOps Engine)                          │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │  Survey  │  │Participant│ │ Frontend │   │
│  │ Service  │  │ Service  │  │  Service  │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   PostgreSQL                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Support

For issues or questions, please create an issue on GitHub.
```

#### Tasks:
- [ ] Create comprehensive CI/CD documentation
- [ ] Document all scripts and workflows
- [ ] Add troubleshooting guide
- [ ] Create architecture diagrams
- [ ] Document security practices

---

## Checklist Summary

### Day 1 Checklist
- [ ] Project structure organized
- [ ] Docker registry configured
- [ ] Kubernetes cluster running
- [ ] Essential tools installed (Ingress, Cert-Manager, ArgoCD)
- [ ] Dockerfiles created and tested
- [ ] CI workflows implemented
- [ ] Code quality tools configured (SonarCloud, Codecov)
- [ ] Security scanning enabled

### Day 2 Checklist
- [ ] Kubernetes manifests created
- [ ] Kustomize overlays configured
- [ ] Database migrations automated
- [ ] ArgoCD applications deployed
- [ ] CD workflows implemented
- [ ] Monitoring stack installed
- [ ] Backup strategy implemented
- [ ] Security hardened
- [ ] Automation scripts created
- [ ] Documentation complete

---

## Next Steps (Post-Implementation)

1. **Week 1-2**: Monitor and optimize
   - Review metrics and logs
   - Tune resource limits
   - Optimize build times
   - Fix any issues

2. **Week 3-4**: Advanced features
   - Blue-green deployments
   - Canary releases
   - A/B testing
   - Feature flags

3. **Month 2**: Production readiness
   - Load testing
   - Disaster recovery drills
   - Security audit
   - Performance optimization

4. **Ongoing**:
   - Regular dependency updates
   - Security patching
   - Cost optimization
   - Team training

---

## Estimated Time Breakdown

| Task | Time | Priority |
|------|------|----------|
| Infrastructure Setup | 4 hours | P0 |
| CI Pipeline | 4 hours | P0 |
| K8s Manifests | 3 hours | P0 |
| CD Pipeline | 2 hours | P0 |
| Monitoring | 1 hour | P1 |
| Security | 1 hour | P1 |
| Backup | 30 mins | P2 |
| Documentation | 30 mins | P1 |
| Testing & Debugging | 2 hours | P0 |
| **Total** | **~18 hours** | |

---

## Resources

### Learning Materials
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

### Tools
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm](https://helm.sh/)
- [kustomize](https://kustomize.io/)
- [ArgoCD CLI](https://argo-cd.readthedocs.io/en/stable/cli_installation/)

### Community
- [Kubernetes Slack](https://slack.k8s.io/)
- [CNCF Slack](https://slack.cncf.io/)
- [r/kubernetes](https://reddit.com/r/kubernetes)

---

**Good luck with your CI/CD implementation! 🚀**

