# Authentication Service API Documentation

## Overview
The Authentication Service is a .NET-based RESTful API that provides user authentication, registration, and role management functionality. This service uses JWT (JSON Web Tokens) for authentication and supports role-based access control.

## Flow Diagram


## Base URL
```
/api/Auth
```

## Authentication
- Protected endpoints require a valid JWT token in the Authorization header
- Format: `Authorization: Bearer {token}`
- Tokens are obtained through the login endpoint

## Endpoints

### 1. Register User
Creates a new user account.

**Endpoint:** `POST /api/Auth/register`

**Request Body:**
```json
{
    "username": "string",
    "email": "string",
    "password": "string"
}
```

**Validation Rules:**
- Username: 2-20 characters, alphanumeric with underscores only
- Email: Valid email format required
- Password: Minimum 6 characters

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "User registered successfully",
    "data": {
        "userId": "integer",
        "username": "string",
        "email": "string"
    },
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 400 Bad Request (Validation Error)
```json
{
    "success": false,
    "message": "Validation failed",
    "data": null,
    "statusCode": 400,
    "error": {
        "message": "Validation failed",
        "code": "VALIDATION_ERROR",
        "details": [
            "Username must be between 2 and 20 characters",
            "A valid email address is required"
        ]
    }
}
```
- 409 Conflict (Duplicate User)
```json
{
    "success": false,
    "message": "Username or email already exists",
    "data": null,
    "statusCode": 409,
    "error": {
        "message": "Username or email already exists",
        "code": "DUPLICATE_ERROR"
    }
}
```

### 2. Login
Authenticates a user and returns a JWT token.

**Endpoint:** `POST /api/Auth/login`

**Request Body:**
```json
{
    "username": "string",
    "password": "string"
}
```

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "token": "string"
    },
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 401 Unauthorized
```json
{
    "success": false,
    "message": "Invalid username or password",
    "data": null,
    "statusCode": 401,
    "error": {
        "message": "Invalid username or password",
        "code": "INVALID_CREDENTIALS"
    }
}
```

### 3. Get Current User
Returns the profile of the currently authenticated user.

**Endpoint:** `GET /api/Auth/user`

**Authorization:** Required (Bearer Token)

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "User retrieved successfully",
    "data": {
        "userId": "integer",
        "username": "string",
        "email": "string"
    },
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 401 Unauthorized (Invalid/Missing Token)
- 404 Not Found (User not found)

### 4. Get All Users
Returns a list of all users (Admin only).

**Endpoint:** `GET /api/Auth/users`

**Authorization:** Required (Bearer Token with Admin role)

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "Users retrieved successfully",
    "data": [
        {
            "userId": "integer",
            "username": "string",
            "email": "string"
        }
    ],
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 401 Unauthorized (Invalid/Missing Token)
- 403 Forbidden (Non-Admin User)

### 5. Add User Role
Assigns a role to a user (Admin only).

**Endpoint:** `POST /api/Auth/users/{userId}/roles`

**Authorization:** Required (Bearer Token with Admin role)

**URL Parameters:**
- userId: Integer (User ID)

**Request Body:**
```json
{
    "userId": "integer",
    "roleName": "string"
}
```

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "Role '{roleName}' added to user successfully",
    "data": null,
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 400 Bad Request (User ID mismatch)
- 401 Unauthorized
- 403 Forbidden (Non-Admin User)

### 6. Remove User Role
Removes a role from a user (Admin only).

**Endpoint:** `DELETE /api/Auth/users/{userId}/roles`

**Authorization:** Required (Bearer Token with Admin role)

**URL Parameters:**
- userId: Integer (User ID)

**Request Body:**
```json
{
    "userId": "integer",
    "roleName": "string"
}
```

**Success Response:** (200 OK)
```json
{
    "success": true,
    "message": "Role '{roleName}' removed from user successfully",
    "data": null,
    "statusCode": 200,
    "error": null
}
```

**Error Responses:**
- 400 Bad Request (User ID mismatch)
- 401 Unauthorized
- 403 Forbidden (Non-Admin User)


## Installation and Setup Guide



#### Steps to Run Locally

1. **Clone the Repository**
```bash
git clone <repository-url>
cd AuthService
```

2. **Configure Environment Variables**
Create a `.env` file in the root directory:
```env
# Database Configuration
CONNECTION_STRING="Host=localhost;Port=5432;Database=SurveyDb;Username=postgres;Password="

JWT_KEY="ThisIsASecretKeyWithAtLeast128Bits"
JWT_ISSUER="AuthService"
JWT_AUDIENCE="SurveyApp"
JWT_DURATION="60"
```

3. **Restore Dependencies**
```bash
dotnet restore
```

4. **Update Database**
```bash
dotnet ef database update
```

5. **Run the Application**
```bash
dotnet run
```

The API will be available at `http://localhost:5171`

### Docker Deployment

#### Prerequisites
- Docker Desktop
- Docker Compose (optional, for multi-container deployments)

#### Using Docker
1. **Build the Container**
```bash
docker run -d \
  --name auth-service \
  -p 5001:5000 \
  --env-file .env \
  --add-host=host.docker.internal:host-gateway \
  auth-service:latest
```

2. **Run the Docker Image**
```bash
docker start auth-service
```

3. **Test Registration Endpoint**
```bash
curl -X POST http://localhost:5001/api/Auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!"
  }'
```


3. **Useful Commands**
```bash
# Clean solution
dotnet clean

# Run tests
dotnet test

# Watch for changes
dotnet watch run

# Generate EF migrations
dotnet ef migrations add MigrationName

# Remove last migration
dotnet ef migrations remove
```

# Authentication Service Kubernetes Deployment

This guide explains how to deploy the Authentication Service on a Kubernetes cluster using deployment and service configurations.

## Prerequisites

- Kubernetes cluster is set up and running
- `kubectl` CLI tool is installed and configured to connect to your cluster

## Deployment Steps

### 1. Configuration Files

Create a `deployment.yaml` file with the following configuration:

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 2
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
        - name: auth-service
          image: rovin123/auth-service:latest
          ports:
            - containerPort: 80
          env:
            - name: ASPNETCORE_URLS
              value: http://*:80
  selector:
    matchLabels:
      app: auth-service

---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 80
      nodePort: 32001
  selector:
    app: auth-service
```

### 2. Deploy to Cluster

Apply the configuration to your cluster:

```bash
kubectl apply -f deployment.yaml
```

### 3. Verify Deployment

Check the status of your deployment:

```bash
# Verify pods are running
kubectl get pods

# Verify service is created
kubectl get services
```

### 4. Access the Service

The service will be accessible at:
```
http://<NODE_IP>:32001
```
Replace `<NODE_IP>` with your Kubernetes cluster node's IP address.

## Common Kubernetes Commands

Here are some useful commands for managing and troubleshooting your deployment:

### Deployment Management
```bash
# List all deployments
kubectl get deployments

# List all pods
kubectl get pods

# List all services
kubectl get services
```

### Troubleshooting
```bash
# Get detailed information about a pod
kubectl describe pod <POD_NAME>

# View pod logs
kubectl logs <POD_NAME>
```

### Cleanup
```bash
# Remove the deployment
kubectl delete deployment auth-service
```

# Knative Serverless Deployment for Survey Microservices: AuthService

This guide details how to deploy the `AuthService` microservice using Knative Serving for serverless capabilities (scale-to-zero, autoscaling) and expose it securely via the Kong API Gateway.

## Table of Contents

* [Prerequisites](#prerequisites)
* [Configuration](#configuration)
  * [Database Connection String](#database-connection-string)
  * [Secrets and ConfigMaps](#secrets-and-configmaps)
  * [Docker Image](#docker-image)
  * [Knative Service](#knative-service)
  * [Kong Ingress](#kong-ingress)
* [Build and Push Docker Image](#build-and-push-docker-image)
* [Deployment Steps](#deployment-steps)
* [Verification and Testing](#verification-and-testing)
  * [Check Deployment Status](#check-deployment-status)
  * [Get Kong Gateway URL](#get-kong-gateway-url)
  * [Test Scale-to-Zero](#test-scale-to-zero)
  * [Test API Endpoint](#test-api-endpoint)
  * [Test Autoscaling (Optional)](#test-autoscaling-optional)
* [Cleanup](#cleanup)
* [Troubleshooting](#troubleshooting)

## Prerequisites

1. **Kubernetes Cluster:** A running Kubernetes cluster (e.g., Minikube, Kind, GKE, EKS, AKS).
2. **kubectl:** Configured to interact with your cluster (`kubectl cluster-info`).
3. **Knative Serving:** Installed on your cluster. Follow the [official Knative installation guide](https://knative.dev/docs/install/). Verify with `kubectl get pods -n knative-serving`.
4. **Kong Kubernetes Ingress Controller:** Installed on your cluster (typically in the `kong` namespace). Follow the [official Kong Ingress Controller documentation](https://docs.konghq.com/kubernetes-ingress-controller/latest/deployment/overview/). Verify with `kubectl get pods -n kong`. Ensure the Kong proxy service is accessible (usually type LoadBalancer).
5. **Docker:** Installed locally for building the service image. Docker Hub account (or other registry) for pushing the image.
6. **Database:** A PostgreSQL database accessible *from within* the Kubernetes cluster. You will need its service name/address, port, database name, username, and password. **Using `localhost` will not work.**

## Configuration

Before deploying, ensure you've updated the provided YAML files:

### Database Connection String

1. **File:** `secrets.yaml`
2. **Key:** `CONNECTION_STRING`
3. **Action:** Replace the placeholder value with your *actual* PostgreSQL connection string.
   * **Host:** Use the Kubernetes service name (e.g., `postgres-service.database-namespace.svc.cluster.local`) or the external address if the DB is outside the cluster. **Do NOT use `localhost`**.
   * **Password:** Include the correct password.
   * **Example:** `Host=my-postgres.db.svc.cluster.local;Port=5432;Database=SurveyDb;Username=postgres;Password=YourSecretPassword`

### Secrets and ConfigMaps

1. **File:** `secrets.yaml`
   * Ensure `JWT_KEY` has a strong, unique secret key.
   * Contains the sensitive information like database connection string and JWT key.

2. **File:** `config-map.yaml`
   * Contains non-sensitive configuration like JWT issuer, audience, and duration settings.
   * Contains the ASPNETCORE_ENVIRONMENT setting.

### Docker Image

1. **File:** `Dockerfile`
   * A streamlined Dockerfile that builds the .NET application and creates a minimal runtime image.

2. **File:** `k-native-service.yaml`
   * **Key:** `spec.template.spec.containers[0].image`
   * **Action:** Change `rovin123/auth-service:v1.0.0` to use your own specific, immutable tag that you will build and push (e.g., `your-dockerhub-username/auth-service:v1.0.0`).

### Knative Service

1. **File:** `k-native-service.yaml`
   * Configured to use the proper container port (80) and ASPNETCORE_URLS.
   * Configured for scale-to-zero functionality with autoscaling options.
   * Properly injects environment variables from ConfigMap and Secrets.

### Kong Ingress

1. **File:** `kong-gateway.yaml`
2. **Resource:** `kind: Ingress`, `metadata.name: auth-gateway`
3. **Key:** `spec.rules[0].http.paths[0].backend.service.name`
4. **Action:** Points to the Fully Qualified Domain Name (FQDN) of the stable Kubernetes service created by Knative: `auth-service.default.svc.cluster.local`

## Build and Push Docker Image

1. Navigate to the directory containing your `AuthService` project code and the updated `Dockerfile`.
2. Build the image, replacing placeholders:
   ```bash
   docker build -t your-dockerhub-username/auth-service:your-tag .
   # Example: docker build -t myuser/auth-service:v1.0.0 .
   ```
3. Log in to your Docker registry:
   ```bash
   docker login
   # Or docker login your-private-registry.com
   ```
4. Push the image:
   ```bash
   docker push your-dockerhub-username/auth-service:your-tag
   # Example: docker push myuser/auth-service:v1.0.0
   ```

## Deployment Steps

Apply the configurations to your cluster in the following order. Ensure you are in the directory containing the YAML files. The `auth-service` will be deployed to the `default` namespace, and the Kong components are deployed to the `kong` namespace.

```bash
# 0. Create Kong Namespace (if not already done by Kong installation)
kubectl apply -f kong-gateway.yaml # Applies the Namespace part first

# 1. Apply AuthService Secret (ensure it's configured correctly!)
kubectl apply -f secrets.yaml

# 2. Apply AuthService ConfigMap
kubectl apply -f config-map.yaml

# 3. Apply Knative Service (ensure image tag is correct!)
kubectl apply -f k-native-service.yaml

# --- Wait for Knative service to be ready (optional, see verification) ---

# 4. Apply Kong Rate Limiting Plugin (to kong namespace)
# 5. Apply Kong Ingress (ensure backend service name is correct!)
# 6. Apply Kong Proxy Service (if not already done by Kong installation)
kubectl apply -f kong-gateway.yaml # Applies the remaining parts
```

## Verification and Testing

### Check Deployment Status

Check Knative Service:
```bash
kubectl get ksvc auth-service
# Wait for READY=True
```

Check Pods: Initially, there might be no pods if traffic is zero.
```bash
kubectl get pods -l serving.knative.dev/service=auth-service
```

Check Kong Ingress:
```bash
kubectl get ingress auth-gateway -n kong
```

### Get Kong Gateway URL

Find the external IP or hostname assigned to the kong-proxy service:
```bash
kubectl get service kong-proxy -n kong
# Look for the EXTERNAL-IP (might take a minute to be assigned on cloud providers)
# If using Minikube, you might need: minikube service kong-proxy -n kong --url
```

### Test Scale-to-Zero

Wait for a period longer than the Knative scale-to-zero grace period (default is often 60 seconds).

Check if the pods have terminated:
```bash
kubectl get pods -l serving.knative.dev/service=auth-service
# Should show "No resources found"
```

### Test API Endpoint

Make a request to your service through the Kong gateway. Replace `<KONG_EXTERNAL_IP>` and adjust the endpoint path as needed.

```bash
# Example: Test a login endpoint
curl -k -X POST https://<KONG_EXTERNAL_IP>/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "test", "password": "password"}'

# The -k flag ignores certificate validation if using self-signed certs
```

After the first request, check the pods again. A new pod should have been created:
```bash
kubectl get pods -l serving.knative.dev/service=auth-service
# Should show 1 pod running or creating
```

### Test Autoscaling (Optional)

Use a load testing tool (like hey, k6, or siege) to send sustained traffic:

```bash
# Example using 'hey' (install it first)
# Send 200 requests, 10 concurrently
hey -n 200 -c 10 https://<KONG_EXTERNAL_IP>/api/auth/login
```

While the load test is running, monitor the number of pods:
```bash
watch kubectl get pods -l serving.knative.dev/service=auth-service
```

You should see the number of pods increase based on traffic (up to the maxScale limit). After the load stops, the pods should scale back down, eventually reaching zero.

## Cleanup

To remove the deployed resources:

```bash
# Delete resources in the application namespace
kubectl delete ksvc auth-service
kubectl delete secret auth-service-secrets
kubectl delete configmap auth-service-config

# Delete resources in the kong namespace
kubectl delete ingress auth-gateway -n kong
kubectl delete kongplugin rate-limiting -n kong

# Optionally delete Kong namespace if you want to remove Kong entirely
# kubectl delete namespace kong
```

## Troubleshooting

* **ImagePullBackOff / ErrImagePull**: Check if the image name/tag in k-native-service.yaml is correct and exists in the registry. Check if your cluster has credentials to pull from the registry (if private).

* **CrashLoopBackOff**: The pod is starting and crashing. Check logs: `kubectl logs <pod-name>`. Common causes:
  * Incorrect connection string (cannot reach DB)
  * Missing or incorrect environment variables
  * Application error on startup
  * Port mismatch (ensure app listens on port 80)

* **503 Service Unavailable / 504 Gateway Timeout** (from Kong):
  * Check if the Knative service auth-service is Ready (`kubectl get ksvc auth-service`)
  * Verify the Kong Ingress backend.service.name points to the correct FQDN
  * Check logs of the Knative activator or queue-proxy if pods aren't starting: `kubectl logs -n knative-serving -l app=activator`
  * Check Kong proxy logs: `kubectl logs -n kong -l app=kong`

* **Connection Refused** (in pod logs): Usually means the database connection string Host is incorrect or the database is not reachable from within the cluster.

* **Scale-to-Zero Not Working**: Check Knative autoscaler configuration. Ensure no constant requests (even health checks not through Knative's endpoint) are keeping it alive.

