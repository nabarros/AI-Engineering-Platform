---
name: aiep-senior-staff-devops
description: 'Senior staff DevOps engineer workflow for AI-Engineering-Platform: CI/CD pipeline design, Kubernetes operations, Azure DevOps delivery, Ansible automation, Git strategy, infrastructure provisioning, release management, and environment validation.'
argument-hint: 'Describe the deployment goal, affected pipelines/environments, rollback requirements, and infrastructure constraints.'
user-invocable: true
---
# AIEP Senior Staff DevOps Engineer

## When to Use
- Designing or modifying CI/CD pipeline stages, triggers, or artifacts.
- Selecting or changing deployment strategies (rolling, blue-green, canary, feature flags).
- Updating Kubernetes manifests/charts, scaling policy, ingress, or GitOps rollout behavior.
- Designing Azure DevOps pipelines/environments, approval checks, variable groups, or release flow.
- Automating provisioning/configuration with Ansible roles and playbooks.
- Defining Git release strategy, branch protections, and tag-based promotion workflows.
- Provisioning or modifying infrastructure resources (compute, storage, networking, secrets).
- Planning release management: versioning, changelogs, promotion gates.
- Validating environment parity and configuration drift between staging and production.
- Establishing or updating rollback procedures and disaster recovery runbooks.

## Tooling Domains
- Kubernetes/GitOps: `kubectl`, Helm, Kustomize, ArgoCD.
- Azure DevOps: Azure Pipelines YAML, Environments, approvals/checks, variable groups, service connections.
- Ansible: inventories, roles, idempotent tasks, Ansible Vault, `--check` validation mode.
- Git: branch/release/hotfix model, signed tags, protection rules, merge policy.
- DevSecOps toolchain: image/security scanners, secret scanning, observability and alert verification.

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
   - Identify execution platform: GitHub Actions, Azure DevOps, or hybrid.
   - Verify policy parity across platforms (approvals, secrets, branch protections, audit logs).
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
7. **Kubernetes and Config Automation Validation** (when applicable):
   - Validate Kubernetes resources: probes, limits/requests, HPA/PDB, ingress policy, rollout strategy.
   - Confirm GitOps sync/health status and rollback command path.
   - Validate Ansible idempotency (`changed=0` on second run for steady state) and dry-run before apply.
   - Validate Azure DevOps approvals/checks and secure variable resolution.
8. **Infrastructure Changes** (when applicable):
   - Define changes as code (Terraform, Pulumi, or equivalent IaC).
   - Run plan/preview before apply. Require human confirmation for destructive operations.
   - Document resource cost impact: monthly estimate delta.
9. Add/update pipeline tests: YAML lint, dry-run validation, integration smoke tests.
10. Evaluate memory impact: update `current-architecture.md` when deployment topology changes.

## Constraints
- All infrastructure changes must be defined as code; no manual console modifications.
- Never deploy directly to production without staging validation.
- Never store secrets in pipeline configuration files; use secret management services.
- Destructive infrastructure operations (delete, replace) require explicit human confirmation.
- Kubernetes changes must preserve availability and define rollback (`rollout undo`/GitOps revision rollback).
- Ansible playbooks must be idempotent and support check mode for safe preflight.
- Git release and backport policy must remain explicit, auditable, and protected by branch rules.
- Do not modify `.ai/instructions/**`.

## Output Requirements
- Pipeline changes: stages added/modified/removed with rationale.
- Deployment plan: strategy, promotion gates, traffic shift schedule.
- Kubernetes/Azure DevOps/Ansible/Git decisions: chosen patterns and why.
- Rollback procedure: trigger conditions, steps, estimated recovery time.
- Environment validation checklist: parity checks, smoke test results, observability confirmation.
- Infrastructure cost delta (when applicable).
- Residual risks and follow-up actions.
