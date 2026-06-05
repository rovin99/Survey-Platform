# CI/CD overview

## Workflows
| File | Trigger | Purpose |
|---|---|---|
| `auth-service-ci.yml`, `survey-service-ci.yml`, `participant-service-ci.yml`, `frontend-ci.yml` | PR + push to `main`/`develop` (path-filtered) | Test, lint, security scan. Build & push the image to GHCR **only on PR + `develop`** (sanity), not on `main`. |
| `deploy-k3s-cd.yml` | **push to `main`** + manual | **Primary deploy.** Builds changed services to GHCR and rolls them onto the k3s cluster (`kubectl set image` + `rollout status`). Applies `k3s/` manifests when infra/config changes. |
| `deploy-cd.yml` | **manual only** (`workflow_dispatch`) | Optional Knative deploy. Builds to GHCR and applies the `…/deployments/kubernetes/*native-service.yaml` with the new image substituted in (no `kn` dependency). |

Images: `ghcr.io/<owner>/<repo>/{auth-service,survey-service,participant-service,frontend}` tagged with the commit SHA (and branch/PR tags from CI). The `main` image is built by the deploy workflow, so there is no duplicate build.

## Required setup
**Branch protection (the deploy gate):** on `main`, enable *Require status checks to pass before merging* and select each service CI's **Test & Quality Check** job. Because main is only updated via reviewed/CI-green PRs, the push-to-main deploy is inherently safe.

**Repository variable**
- `FRONTEND_PUBLIC_URL` — the public base URL users hit (e.g. `http://203.0.113.10` or `https://survey.college.edu`). Baked into the frontend at build time and used for CORS.

**Repository secrets**
- `KUBE_CONFIG` — kubeconfig for the target cluster (k3s for the auto deploy; a Knative cluster for the manual one).
- `GITHUB_TOKEN` — provided automatically (GHCR push).

**Cluster image pull:** make the GHCR packages public, **or** create a `dockerconfigjson` pull secret in the cluster and add `imagePullSecrets` to the k3s Deployments (the cluster must be able to pull `ghcr.io/<owner>/<repo>/*`).

## Bootstrap vs ongoing deploys (k3s)
- **First-time cluster setup** is done once with `k3s/deploy-k3s.sh` (installs k3s, applies all
  manifests, creates the Deployments). See `k3s/README.md`.
- **Ongoing**: `deploy-k3s-cd.yml` rolls new images onto the existing Deployments (`kubectl set image`)
  and only re-applies the `k3s/` manifests when infra/config (`k3s/**`, `infrastructure/**`,
  `smart-proxy/**`) changes — so unchanged services aren't disturbed.

## Notes
- Real automated tests are still minimal (stub `main_test.go`); CI keeps a lenient "no tests" fallback. Add real suites over time.
- Each service has one canonical root `Dockerfile` (used by compose, the `k3s/` kit, and all workflows). The `<svc>/docker/*` Dockerfiles are legacy and unused by CI/CD.
