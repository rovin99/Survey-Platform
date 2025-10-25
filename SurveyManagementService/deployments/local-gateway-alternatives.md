# API Gateway Options for K-Native Serverless Deployment

## 🏠 **Local Development Options**

### **Option 1: K-Native Magic DNS (Simplest)**
```bash
# No gateway needed! K-Native provides automatic DNS
# Services available at:
# http://auth-service.default.127.0.0.1.nip.io
# http://survey-management-service.default.127.0.0.1.nip.io

# Configure K-Native for local development
kubectl patch configmap/config-domain \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"127.0.0.1.nip.io":""}}'
```

### **Option 2: Istio Gateway (K-Native Native)**
```yaml
# istio-gateway-local.yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: survey-platform-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "api.local"
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: survey-platform-routes
spec:
  hosts:
  - "api.local"
  gateways:
  - survey-platform-gateway
  http:
  - match:
    - uri:
        prefix: /auth
    route:
    - destination:
        host: auth-service.default.svc.cluster.local
  - match:
    - uri:
        prefix: /surveys
    route:
    - destination:
        host: survey-management-service.default.svc.cluster.local
```

### **Option 3: Contour (Lightweight)**
```yaml
# contour-ingress-local.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: survey-platform-ingress
  annotations:
    kubernetes.io/ingress.class: contour
spec:
  rules:
  - host: api.local
    http:
      paths:
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 80
      - path: /surveys  
        pathType: Prefix
        backend:
          service:
            name: survey-management-service
            port:
              number: 80
```

### **Option 4: kubectl port-forward (Development Only)**
```bash
# Simple port forwarding for testing
kubectl port-forward service/auth-service 8080:80 &
kubectl port-forward service/survey-management-service 8081:80 &

# Services available at:
# http://localhost:8080 (auth)
# http://localhost:8081 (surveys)
```

## 🏢 **Production Options**

### **Option 1: Unified Kong Gateway (Recommended)**
Single Kong instance handling all services:

```yaml
# kong-unified-gateway.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kong
---
# Kong Rate Limiting Plugin
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: survey-platform-rate-limiting
  namespace: kong
plugin: rate-limiting
config:
  minute: 1000
  hour: 10000
  policy: local
---
# Kong CORS Plugin
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: survey-platform-cors
  namespace: kong
plugin: cors
config:
  origins: ["*"]
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  headers: ["Accept", "Content-Type", "Authorization"]
  credentials: true
---
# Unified Ingress for all services
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: survey-platform-gateway
  namespace: kong
  annotations:
    konghq.com/plugins: survey-platform-rate-limiting,survey-platform-cors
    konghq.com/protocols: "https"
    konghq.com/https-redirect-status-code: "301"
spec:
  ingressClassName: kong
  tls:
  - hosts:
    - api.yourplatform.com
    secretName: survey-platform-tls
  rules:
  - host: api.yourplatform.com
    http:
      paths:
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 80
      - path: /surveys
        pathType: Prefix  
        backend:
          service:
            name: survey-management-service
            port:
              number: 80
---
# Kong Proxy Service
apiVersion: v1
kind: Service
metadata:
  name: kong-proxy
  namespace: kong
spec:
  type: LoadBalancer
  ports:
  - name: proxy-ssl
    port: 443
    targetPort: 8443
  - name: proxy
    port: 80
    targetPort: 8000
  selector:
    app: kong
```

### **Option 2: Cloud-Native Gateways**

#### **Google Cloud (GKE)**
```yaml
# gcp-gateway.yaml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: survey-platform-ssl
spec:
  domains:
  - api.yourplatform.com
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: survey-platform-ingress
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "survey-platform-ip"
    networking.gke.io/managed-certificates: survey-platform-ssl
    kubernetes.io/ingress.class: "gce"
spec:
  rules:
  - host: api.yourplatform.com
    http:
      paths:
      - path: /auth/*
        pathType: ImplementationSpecific
        backend:
          service:
            name: auth-service
            port:
              number: 80
      - path: /surveys/*
        pathType: ImplementationSpecific
        backend:
          service:
            name: survey-management-service  
            port:
              number: 80
```

#### **AWS (EKS with ALB)**
```yaml
# aws-alb-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: survey-platform-alb
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/cert-id
    alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS-1-2-2017-01
spec:
  tls:
  - hosts:
    - api.yourplatform.com
  rules:
  - host: api.yourplatform.com
    http:
      paths:
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 80
      - path: /surveys
        pathType: Prefix
        backend:
          service:
            name: survey-management-service
            port:
              number: 80
```

## 📊 **Comparison Matrix**

| Gateway Option | Local Dev | Production | Complexity | Features | K-Native Native |
|---------------|-----------|------------|------------|----------|-----------------|
| **K-Native Magic DNS** | ✅ Perfect | ❌ No | 🟢 Minimal | 🟡 Basic | ✅ Yes |
| **Istio Gateway** | ✅ Good | ✅ Excellent | 🟡 Medium | 🟢 Rich | ✅ Yes |
| **Contour** | ✅ Good | ✅ Good | 🟢 Low | 🟡 Medium | ✅ Yes |
| **port-forward** | ✅ Perfect | ❌ No | 🟢 Minimal | 🔴 None | ✅ Yes |
| **Kong Gateway** | 🟡 Overkill | ✅ Excellent | 🔴 High | 🟢 Enterprise | 🟡 Compatible |
| **Cloud ALB/GCE** | ❌ No | ✅ Excellent | 🟡 Medium | 🟢 Managed | 🟡 Compatible |

## 🎯 **Recommendations**

### **For Local Development**
```bash
# Option 1: Use K-Native Magic DNS (Recommended)
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: config-domain
  namespace: knative-serving
data:
  127.0.0.1.nip.io: ""
EOF

# Services will be available at:
# http://auth-service.default.127.0.0.1.nip.io
# http://survey-management-service.default.127.0.0.1.nip.io
```

### **For Production**
```bash
# Option 1: Unified Kong Gateway (if you need enterprise features)
kubectl apply -f kong-unified-gateway.yaml

# Option 2: Istio Gateway (if you want K-Native native solution)
kubectl apply -f istio-gateway-production.yaml
```

## 🔧 **Migration Steps**

### **Step 1: Remove Duplicate Kong Files**
```bash
# Remove individual Kong files
rm AuthService/deployments/kubernetes/kong-gateway.yaml
rm SurveyManagementService/kong-gateway.yaml
```

### **Step 2: Choose Your Gateway Strategy**
```bash
# For local development
kubectl apply -f local-istio-gateway.yaml

# For production  
kubectl apply -f kong-unified-gateway.yaml
```

### **Step 3: Update Frontend Configuration**
```javascript
// Frontend API base URLs
const API_BASE = {
  local: {
    auth: 'http://auth-service.default.127.0.0.1.nip.io',
    surveys: 'http://survey-management-service.default.127.0.0.1.nip.io'
  },
  production: {
    auth: 'https://api.yourplatform.com/auth',
    surveys: 'https://api.yourplatform.com/surveys'
  }
}
```

---

**Recommendation**: Use **K-Native Magic DNS** for local development and **Unified Kong Gateway** for production! 