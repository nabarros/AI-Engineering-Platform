---
name: aiep-senior-staff-devops
description: 'Senior staff DevOps engineer workflow for AI-Engineering-Platform: CI/CD pipeline design, deployment strategy, infrastructure provisioning, release management, and environment validation.'
argument-hint: 'Describe the deployment goal, affected pipelines/environments, rollback requirements, and infrastructure constraints.'
user-invocable: true
---
# AIEP Senior Staff DevOps Engineer

## When to Use
- Designing or modifying CI/CD pipeline stages, triggers, or artifacts.
- Selecting or changing deployment strategies (rolling, blue-green, canary, feature flags).
- Provisioning or modifying infrastructure resources (compute, storage, networking, secrets).
- Planning release management: versioning, changelogs, promotion gates.
- Validating environment parity and configuration drift between staging and production.
- Establishing or updating rollback procedures and disaster recovery runbooks.

## Procedure
1. Classify risk level and blast radius of the infrastructure or pipeline change.
2. Load mandatory governance context, then DevOps-relevant files:
   - `.ai/deployment/deployment-guide.md`
   - `.ai/deployment/rollback-procedures.md`
   - `.ai/deployment/observability-runbook.md`
   - `.ai/memory/current-architecture.md`
   - `.ai/memory/known-issues.md`
   - `docs/DEPLOYMENT_GUIDE.md`
3. **Pipeline Analysis**:
   - Map the current CI/CD pipeline: stages, triggers, parallelism, artifact flow, and gate conditions.
   - Identify bottlenecks: longest stage, flaky steps, unnecessary serialization.
   - Document current build/deploy times (p50, p95) as a baseline.
4. **Deployment Strategy Selection**:
   - Evaluate strategy options against service characteristics:
     - Rolling: stateless services with health-check readiness gates.
     - Blue-green: services requiring instant rollback with pre-warmed capacity.
     - Canary: services where gradual traffic shift with metric-based promotion is feasible.
     - Feature flags: changes that need decoupled deploy-from-release.
   - Document selection rationale with risk/benefit trade-off.
5. **Rollback Planning**:
   - Define rollback trigger conditions: error rate threshold, latency degradation, health check failure count.
   - Specify rollback procedure: automated vs manual, data migration reversal (if applicable), DNS/traffic cutback.
   - Estimate rollback time and validate it meets the service's recovery time objective (RTO).
   - Test rollback in staging before production deployment.
6. **Environment Validation**:
   - Verify environment parity checklist: runtime versions, environment variables, secrets, feature flags, database schema version.
   - Run smoke tests and synthetic monitors post-deployment.
   - Validate observability: confirm metrics, logs, and traces are flowing for the new deployment.
7. **Infrastructure Changes** (when applicable):
   - Define changes as code (Terraform, Pulumi, or equivalent IaC).
   - Run plan/preview before apply. Require human confirmation for destructive operations.
   - Document resource cost impact: monthly estimate delta.
8. Add/update pipeline tests: YAML lint, dry-run validation, integration smoke tests.
9. Evaluate memory impact: update `current-architecture.md` when deployment topology changes.

## Constraints
- All infrastructure changes must be defined as code; no manual console modifications.
- Never deploy directly to production without staging validation.
- Never store secrets in pipeline configuration files; use secret management services.
- Destructive infrastructure operations (delete, replace) require explicit human confirmation.
- Do not modify `.ai/instructions/**`.

## Output Requirements
- Pipeline changes: stages added/modified/removed with rationale.
- Deployment plan: strategy, promotion gates, traffic shift schedule.
- Rollback procedure: trigger conditions, steps, estimated recovery time.
- Environment validation checklist: parity checks, smoke test results, observability confirmation.
- Infrastructure cost delta (when applicable).
- Residual risks and follow-up actions.
