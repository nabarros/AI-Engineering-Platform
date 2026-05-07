---
ai_priority: tier-3
context_type: operational-runbook
load_when: deployment, release-process, rollback-needed
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Playbook: Deployment

Step-by-step deployment runbook for AIEP services. Follow in order — do not skip steps.

---

## Pre-Deployment Checklist

```
□ CI pipeline is green on the release branch
□ All tests pass (unit + integration)
□ Security scan clean (no new High/Critical findings from Trivy/Snyk)
□ CHANGELOG updated with version bump
□ If database migration: reviewed by a second engineer
□ If new environment variable: confirmed set in production secrets
□ Feature flags configured (new features behind flag; not enabled by default)
□ Rollback plan confirmed (what to do if deployment fails)
□ On-call engineer aware of deployment window
```

---

## 1. Build and Push Container Image

```bash
# Tag format: <service>-<semver>
export SERVICE=llm-gateway
export VERSION=2.5.0
export ECR_REPO=123456789.dkr.ecr.us-east-1.amazonaws.com/aiep

# Authenticate to ECR
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin $ECR_REPO

# Build (use BuildKit for caching)
DOCKER_BUILDKIT=1 docker build \
  --target production \
  --cache-from $ECR_REPO/$SERVICE:latest \
  -t $ECR_REPO/$SERVICE:$VERSION \
  -t $ECR_REPO/$SERVICE:latest \
  ./src/services/$SERVICE

# Scan before push
trivy image --exit-code 1 --severity HIGH,CRITICAL $ECR_REPO/$SERVICE:$VERSION

# Push
docker push $ECR_REPO/$SERVICE:$VERSION
docker push $ECR_REPO/$SERVICE:latest
```

---

## 2. Run Database Migrations (If Applicable)

Run migrations before deploying the new service version — always migrations first, then code.

```bash
# Dry run first (validates syntax, lists pending migrations)
flyway -url=jdbc:postgresql://$PROD_DB_HOST/aiep_$SERVICE \
       -user=$DB_USER -password=$DB_PASS \
       info

# Apply migrations
flyway -url=jdbc:postgresql://$PROD_DB_HOST/aiep_$SERVICE \
       -user=$DB_USER -password=$DB_PASS \
       migrate

# Verify migration succeeded
flyway -url=... info | grep "Pending"
# Should return: no pending migrations
```

**Emergency halt:** If migration fails mid-run:
```bash
# DO NOT attempt rollback automatically
# 1. Assess which statements succeeded (check flyway_schema_history table)
# 2. Notify on-call + DBA channel
# 3. Manually complete or revert based on actual DB state
```

---

## 3. Deploy to Staging

```bash
# Update image tag in Helm values
cd infra/helm/charts/$SERVICE
sed -i "s|image.tag:.*|image.tag: $VERSION|" values-staging.yaml

# ArgoCD will auto-sync on push, or manually trigger:
argocd app sync aiep-staging-$SERVICE --timeout 300

# Watch rollout
kubectl rollout status deploy/$SERVICE -n aiep-staging --timeout=5m
```

**Observe staging for 10 minutes:**
- Check error rate in Datadog: `service:$SERVICE env:staging`
- Check p95 latency: should not increase > 20% from baseline
- If issues: do not proceed to production

---

## 4. Deploy to Production (Rolling Update)

ArgoCD handles production deployments. Update the production Helm values and push:

```bash
cd infra/helm/charts/$SERVICE
sed -i "s|image.tag:.*|image.tag: $VERSION|" values-production.yaml
git commit -m "chore: deploy $SERVICE $VERSION to production"
git push origin main

# ArgoCD auto-sync (10s interval) will detect and deploy
# Monitor in ArgoCD UI or via CLI:
argocd app sync aiep-prod-$SERVICE
kubectl rollout status deploy/$SERVICE -n aiep --timeout=10m
```

**Rolling update parameters (set in Helm values):**
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0  # always keep all replicas serving during update
```

---

## 5. Post-Deployment Validation

```bash
# Check pod status — all should be Running
kubectl get pods -n aiep -l app=$SERVICE

# Check recent logs for errors
kubectl logs -n aiep deploy/$SERVICE --tail=50 | grep '"level":50'

# Check health endpoint
kubectl exec -n aiep deploy/$SERVICE -- curl -sf http://localhost:<PORT>/health/ready

# In Datadog — verify for 5 minutes post-deploy:
# • Error rate: same or lower than pre-deploy
# • p95 latency: within 10% of pre-deploy baseline
# • No new alert firing
```

---

## Rollback

If validation fails after production deploy:

```bash
# Option 1: ArgoCD rollback (recommended)
argocd app rollback aiep-prod-$SERVICE 1  # revert to previous revision

# Option 2: Kubernetes image rollback
kubectl rollout undo deployment/$SERVICE -n aiep

# Option 3: Manual (if Helm values need updating)
git revert HEAD  # revert the image tag commit
git push origin main  # ArgoCD will auto-sync rollback

# After rollback: confirm all pods running previous version
kubectl get pods -n aiep -l app=$SERVICE -o jsonpath='{..image}'
```

---

## Related Files

- `docs/DEPLOYMENT_GUIDE.md` — full deployment architecture and environments
- `.ai/playbooks/incident-response.md` — if post-deploy issues escalate
- `.ai/playbooks/debugging.md` — diagnosing deployment failures
