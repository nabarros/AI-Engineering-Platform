---
ai_priority: tier-2
context_type: rollback-procedures
load_when: incident-response, rollback, deployment-failure
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Rollback Procedures

When to rollback vs fix-forward, and exact steps per service.

---

## Rollback vs Fix-Forward Decision

**Rollback when:**
- P0/P1 production incident caused by a recent deployment
- Error rate or latency SLO breached within 30 minutes of a deploy
- Data corruption risk identified
- Rollback can be completed in < 5 minutes

**Fix-forward when:**
- Bug is minor and a small patch can be deployed quickly
- Rollback would drop a database migration that has already run
- Rollback would cause data loss (e.g., new records written to new schema)

---

## Service Rollback Steps

### Standard Service Rollback (no DB migration)

```bash
# 1. Identify the previous good revision
argocd app history aiep-<service-name>

# 2. Roll back to previous revision (ID from history output)
argocd app rollback aiep-<service-name> <revision-id>

# 3. Verify rollout completed
kubectl -n aiep-prod rollout status deployment/<service-name>

# 4. Confirm health endpoint
curl https://internal.aiep.io/<service-name>/health
```

### Kubernetes Rollback (if ArgoCD unavailable)

```bash
# Roll back Kubernetes deployment directly
kubectl -n aiep-prod rollout undo deployment/<service-name>

# To a specific revision
kubectl -n aiep-prod rollout undo deployment/<service-name> --to-revision=<number>

# Check rollout history
kubectl -n aiep-prod rollout history deployment/<service-name>
```

---

## Database Migration Rollback

### If Migration Has NOT Been Applied in Production

```bash
# Simply rollback the service — migration hasn't run yet
argocd app rollback aiep-<service-name> <revision-id>
```

### If Migration HAS Been Applied

**Stop. Do not rollback the service code.** Running the old code against the new schema will likely cause errors. Options:

1. **Write a rollback migration** — add a `down` migration to reverse the schema change, then deploy
2. **Fix-forward** — patch the code to work with the new schema and deploy the patch

Consult `.ai/skills/migration-strategy.md` for zero-downtime migration patterns that support rollback.

---

## Per-Service Rollback Notes

| Service | Rollback Concern | Special Steps |
|---|---|---|
| llm-gateway | Prompt cache invalidation | After rollback, flush Redis: `redis-cli -u $REDIS_URL FLUSHDB` |
| auth-service | JWT key rotation | Never rollback if JWT secret was rotated — would invalidate all active sessions |
| vector-store-service | Weaviate schema changes | Schema changes are not auto-rolled back; consult Weaviate admin |
| audit-service | Append-only records | No concerns; records written remain |
| Kafka consumers (all) | Consumer group offset | After rollback, verify consumer group offset is not ahead of code capability |

---

## Kafka Consumer Rollback

```bash
# 1. Stop the consumer (rollback the service first)
# 2. Check current consumer group offset
kubectl -n aiep-prod exec deploy/kafka-tools -- \
  kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS \
  --group <group-id> --describe

# 3. If needed, reset offset to a specific time
kubectl -n aiep-prod exec deploy/kafka-tools -- \
  kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS \
  --group <group-id> --reset-offsets \
  --to-datetime 2026-01-01T12:00:00.000 \
  --topic <topic-name> \
  --execute
```

---

## Post-Rollback Checklist

- [ ] Error rate returned to baseline (< 0.1% for standard services)
- [ ] Health endpoints responding `200 OK` for rolled-back service
- [ ] Downstream services not affected (check dependency graph in `.ai/architecture/component-map.md`)
- [ ] Incident ticket updated with rollback confirmation
- [ ] Feature flag disabled if new feature caused the incident
- [ ] Post-mortem scheduled (for P0/P1)

---

## Related Files

- `.ai/playbooks/deployment.md` — deployment checklist
- `.ai/playbooks/incident-response.md` — incident response protocol
- `.ai/deployment/deployment-guide.md` — deployment commands reference
