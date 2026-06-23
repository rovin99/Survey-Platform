# Survey-Platform on single-node k3s (2 cores / 4 GB VM)

Lean k3s deployment using **plain Deployments** (no Knative) behind k3s's built-in **Traefik**
ingress → an in-cluster **nginx gateway**. Sized for a 2c/4GB VM. Access over **HTTP at the VM IP**.
**Piston (code-execution) is intentionally excluded** to fit memory.

## Topology
```
browser ─ http://<vm-ip> ─▶ Traefik(:80) ─▶ survey-gateway (nginx) ─▶ frontend / auth / survey / participants
                                                                   └─▶ minio (uploads)
                                          postgres (db ns) ◀── all services        minio (storage ns)
```
- One Postgres DB `SurveyDb` shared by all services. Persistent via k3s `local-path` PVCs.
- AuthService runs EF migrate + role/admin seed on startup; Go services AutoMigrate on startup. No migration jobs.

## Prerequisites
- A VM with k3s-capable Linux, **≥25 GB disk**, and ideally **2 GB swap** added (insurance for spikes).
- A container registry you can push to (Docker Hub, GHCR, …) reachable from the VM.
- Docker on a **build machine** (your laptop/CI) — do NOT build on the 4 GB VM (OOM risk).

## Deploy
1. **Edit secrets** in `01-secrets.yaml` (DB password, `JWT_SECRET_KEY` ≥32 chars, `INTERNAL_API_KEY`,
   MinIO creds, SMTP `EMAIL`/`APP_PASS`). `JWT_SECRET_KEY` and `INTERNAL_API_KEY` must match across services.
2. **Build & push images** from your build machine (bakes the VM URL into the frontend):
   ```bash
   ./build-and-push.sh docker.io/<you> <vm-ip>
   ```
3. **Deploy on the VM**:
   ```bash
   sudo ./deploy-k3s.sh docker.io/<you> <vm-ip>
   ```
   It installs k3s if needed, substitutes registry/IP, applies everything in order, waits for rollouts,
   and prints `http://<vm-ip>`.

## Verify
- `k3s kubectl get pods -A` → all Running/Ready.
- Open `http://<vm-ip>`: register a conductor → create+publish a quiz → onboard a student → log in as
  the student (email + default password) → take the quiz → see results. (Exercises cross-service calls,
  cookies over HTTP, Postgres, and MinIO uploads.)
- `k3s kubectl top pods -A` → steady-state memory under limits; `k3s kubectl get events` for OOMKills.

## Resource budget (limits)
k3s ~0.6G · postgres 512Mi · minio 384Mi · auth 448Mi · survey 192Mi · participants 192Mi · frontend
256Mi · gateway 64Mi ≈ **2.6 GB** of limits (~1.8 GB requested) → fits 4 GB with headroom.

## Notes & limits
- **HTTP only.** Cookies are set non-Secure because AuthService runs with `ASPNETCORE_ENVIRONMENT=Development`
  (see `02-config.yaml`); required for cookie auth over plain HTTP. For production use a domain + TLS
  (Traefik + cert-manager/Let's Encrypt) and flip the env so cookies become `Secure`.
- **Frontend URL is baked at build time** → rebuild + redeploy if the VM IP/host changes.
- **No code-execution questions** (Piston excluded). To enable later, deploy Piston and re-add its
  upstream/location to the gateway nginx config (needs ~0.8–2 GB more).
- Defaults in `01-secrets.yaml` are dev values — change them before any non-test use.
