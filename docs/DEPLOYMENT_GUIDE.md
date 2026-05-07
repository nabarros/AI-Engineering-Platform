---
ai_priority: medium
context_type: governance
load_when: deployment questions, pre-release validation, rollback decisions
token_budget: medium
---

# Deployment Guide

## AI Agent Load Guidance

Load this file for deployment-related questions. For rollback procedures, load `.ai/deployment/rollback-procedures.md`. AI agents must NOT trigger deployments autonomously — all deployments require human approval.

---

## Deployment Architecture

```
Developer → PR → CI (GitHub Actions) → Staging → Manual Approval → Production
                   │
                   ├─ Unit tests
                   ├─ Integration tests
                   ├─ Security scan (SAST, secret scanning)
                   ├─ Container build
                   ├─ Vulnerability scan (Trivy)
                   └─ Contract tests
```

---

## Environments

| Environment | Purpose | Deployment | Data |
|-------------|---------|-----------|------|
| `development` | Local development | Docker Compose | Synthetic |
| `staging` | Pre-production validation | Auto on merge to `main` | Anonymized production copy |
| `production` | Live system | Manual approval required | Real data |

---

## Release Process

### Step 1: Pre-Release Checklist

Before any production deployment:

- [ ] All CI checks passing on the release commit
- [ ] E2E tests passing on staging
- [ ] Database migrations reviewed and tested on staging
- [ ] CHANGELOG.md updated for the release
- [ ] Service health dashboards nominal on staging (no elevated error rates)
- [ ] No unresolved critical or high security alerts
- [ ] Release tagged: `git tag v{major}.{minor}.{patch}`
- [ ] On-call engineer briefed on significant changes

### Step 2: Deployment Execution

Deployments use ArgoCD GitOps:

```bash
# Production deployment is triggered by updating the image tag in
# infra/argocd/production/{service}/values.yaml and merging to `release`

# Check deployment status
kubectl -n aiep-production get deployments

# Watch rollout
kubectl -n aiep-production rollout status deployment/llm-gateway
```

### Step 3: Post-Deployment Validation

Within 15 minutes of deployment:

```
[ ] Service health endpoints return 200 (GET /health/ready)
[ ] Error rate < baseline + 0.1% on Grafana dashboard
[ ] P95 latency < baseline + 20% on Grafana dashboard
[ ] No new alerts firing in Datadog
[ ] Smoke test suite passing (automated, runs post-deploy)
```

If any check fails → initiate rollback immediately (see `.ai/deployment/rollback-procedures.md`).

---

## Container Build Standards

### Dockerfile Requirements

```dockerfile
# GOOD — multi-stage, non-root, pinned base
FROM node:20.11.0-alpine3.19 AS builder
# ... build stage

FROM node:20.11.0-alpine3.19 AS runtime
RUN addgroup -g 1001 -S aiep && adduser -S aiep -u 1001 -G aiep
USER aiep                              # non-root user
COPY --chown=aiep:aiep --from=builder /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/health/live || exit 1
CMD ["node", "dist/main.js"]
```

Requirements:
- Multi-stage build (separate build and runtime)
- Non-root user (`USER aiep`)
- Pinned base image tag (not `:latest`)
- Health check defined
- No secrets in Dockerfile or build args
- Minimal base image (Alpine or distroless)

### Image Scanning

All images are scanned by Trivy in CI. Build fails if:
- Any CRITICAL severity CVE detected
- Any HIGH severity CVE without a documented exception

---

## Kubernetes Configuration

### Resource Limits (Required)

Every Kubernetes Deployment must specify resources:

```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### Availability

```yaml
replicas: 3                          # minimum in production
minReadySeconds: 30
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 1
    maxSurge: 1

# Disruption budget
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 2                    # at least 2 pods always available
```

### Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 20
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

---

## Database Migrations

**Migrations require extra care.** They are hard to reverse and affect running services.

### Migration Protocol

1. Migration PRs require 2 approvals (1 must be senior engineer familiar with the schema)
2. Run migration on staging with production-sized data load
3. Time the migration — it must complete in < 5 minutes or use an online migration strategy
4. Verify application works with both old and new schema (for zero-downtime deployments)
5. Deploy migration **before** deploying the application code that depends on it
6. Rollback script prepared and tested on staging

### Emergency Migration Halt

If a migration is running too long or causing issues:

```bash
# Check migration progress
SELECT * FROM schema_migrations WHERE completed = false;

# If migration must be cancelled
# 1. Kill the migration connection
SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE query LIKE '%migration%';
# 2. Run the rollback script
psql $DATABASE_URL < migrations/rollback/YYYY-MM-DD-NNN.sql
# 3. Alert the team
```

---

## Feature Flags

Use feature flags for incomplete features merged to `main`:

```typescript
// Feature flag check
if (await featureFlags.isEnabled('new-routing-algorithm', { userId: request.user.id })) {
  return await newRoutingAlgorithm.route(request);
}
return await legacyRoutingAlgorithm.route(request);
```

- All feature flags documented in `infra/feature-flags/README.md`
- Flags have a defined owner and expiry date
- Stale flags (> 30 days after full rollout) are removed in a cleanup PR

---

## Related Files

- Rollback procedures → `.ai/deployment/rollback-procedures.md`
- Observability runbook → `.ai/deployment/observability-runbook.md`
- Security rules → `docs/SECURITY_RULES.md`
