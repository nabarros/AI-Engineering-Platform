---
ai_priority: tier-2
context_type: incident-response
load_when: production-incident, alert-firing, service-degradation
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Playbook: Incident Response

Incident classification, response steps, and communication templates.

---

## Severity Classification

| Severity | Definition | Response Time | Examples |
|---|---|---|---|
| SEV-1 | Complete service outage, data loss risk, security breach | Immediate (< 5 min) | All LLM requests failing, auth-service down, data leak detected |
| SEV-2 | Significant degradation, major feature unavailable | < 15 min | > 5% error rate, p95 latency > 5s, inference failing for one model tier |
| SEV-3 | Partial degradation, workaround exists | < 1 hour | Single provider failing (fallback active), specific endpoint slow |
| SEV-4 | Minor issue, no user impact | Next business day | Non-critical metric missing, alert misconfigured |

---

## Response Protocol

### Step 1 — Acknowledge and Classify (< 5 min)

```
□ Acknowledge PagerDuty alert
□ Join #incidents Slack channel
□ Post: "Investigating [alert name]. Will update in 10 min. Severity: [SEV-X]"
□ Assign Incident Commander (usually on-call engineer)
```

### Step 2 — Assess Scope (< 10 min)

```bash
# Check overall service health
kubectl get pods -n aiep  # any CrashLoopBackOff or Pending?
kubectl top pods -n aiep  # any pods near resource limits?

# Check recent deployments (most common cause)
kubectl rollout history deployment -n aiep | grep -v "revision"

# Check Datadog error rate
# Filter: env:production @level:error
# Group by: service
# Sort by: count (highest first)

# Check Kafka consumer lag (async service delays)
# Datadog: kafka.consumer_lag by consumer_group
```

### Step 3 — Contain (reduce user impact first)

**If a recent deployment is the cause:**
```bash
# Rollback immediately — do not investigate while users are affected
argocd app rollback aiep-prod-<service> 1
kubectl rollout status deployment/<service> -n aiep
```

**If a provider is failing:**
```bash
# Force failover to backup provider via feature flag
# LaunchDarkly: llm_primary_provider → 'anthropic'
# This takes effect within 30s (flag poll interval)
```

**If database is overloaded:**
```bash
# Check connection pool
psql -h $PGBOUNCER_HOST -p 6432 pgbouncer -c "SHOW POOLS;"

# If pool exhausted: identify and kill runaway queries
SELECT pid, query_start, query FROM pg_stat_activity WHERE state = 'active' ORDER BY query_start ASC;
-- SELECT pg_terminate_backend(<pid>);  -- only if identified as runaway
```

### Step 4 — Communicate

**Every 15 minutes until resolved:**
```
[STATUS UPDATE - SEV-X - HH:MM UTC]
Service: <service name>
Impact: <brief description of user impact>
Status: Investigating / Mitigation in progress / Resolved
Last action: <what was just done>
Next update: HH:MM UTC
```

### Step 5 — Resolve and Monitor

```
□ Confirm error rate back to baseline (< 0.1%)
□ Confirm p95 latency back to baseline
□ Confirm all pods Running and healthy
□ Monitor for 15 minutes after resolution
□ Post resolution message in #incidents
□ Create post-mortem ticket in Jira (due: 48h after incident)
```

---

## Common Incident Patterns

### LLM Gateway High Error Rate

```bash
# 1. Check which provider is failing
kubectl logs -n aiep deploy/llm-gateway --tail=100 | jq 'select(.level==50) | {provider, error}'

# 2. Check circuit breaker state
# GET /internal/health/circuit-breakers (admin endpoint)

# 3. If OpenAI is down: force Anthropic (flag change)
# If both failing: check API key validity (uncommon but happens on key rotation)
```

### Auth Service Latency Spike

```bash
# 1. Check auth-service pod resources
kubectl top pods -n aiep -l app=auth-service

# 2. Check DB latency (auth-service is DB-heavy)
# Datadog: db.query.duration service:auth-service p95

# 3. Emergency: scale up auth-service replicas
kubectl scale deployment auth-service -n aiep --replicas=6
```

### Kafka Consumer Group Stalled

```bash
# 1. Check lag
# Datadog: kafka.consumer_lag by consumer_group

# 2. Check consumer pod logs for deserialization errors
kubectl logs -n aiep deploy/audit-service --tail=100 | grep "error\|failed"

# 3. If messages are malformed: pause consumer, inspect DLQ
# POST /internal/kafka/pause (admin endpoint)
```

---

## Post-Mortem Template

```markdown
# Post-Mortem: <Service> <Date>

## Summary
[1-2 sentence description of what happened]

## Timeline
- HH:MM UTC — [Event]
- HH:MM UTC — [Event]
- HH:MM UTC — Resolved

## Root Cause
[Technical explanation]

## Impact
- Duration: X minutes
- Error rate peak: X%
- Affected users: ~X

## What Went Well
- [list]

## What Could Be Improved
- [list]

## Action Items
| Action | Owner | Due Date |
|---|---|---|
| [fix] | @engineer | YYYY-MM-DD |
```

---

## Related Files

- `.ai/playbooks/debugging.md` — technical debugging steps
- `.ai/playbooks/deployment.md` — rollback procedures
- `docs/OBSERVABILITY.md` — alert definitions and runbooks
