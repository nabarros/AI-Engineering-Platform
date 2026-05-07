---
ai_priority: tier-2
context_type: observability-runbook
load_when: incident-response, alert-investigation, performance-issues
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Observability Runbook

Alert → response mapping. For full incident protocol, see `.ai/playbooks/incident-response.md`.

---

## Alert Response Quick Reference

| Alert Name | Severity | First Response |
|---|---|---|
| `LLMGatewayErrorRateHigh` | P1 | Check provider status, switch fallback |
| `LLMLatencyP95High` | P2 | Check provider latency, semantic cache hit rate |
| `PromptServiceDown` | P1 | Check pod health, recent deployments |
| `AuthServiceDown` | P0 | All services affected; page on-call immediately |
| `KafkaConsumerLag` | P2 | Check consumer pod health, offset lag |
| `PostgresConnectionPoolSaturated` | P1 | Check active queries, kill long-running |
| `LLMCostDailySpike` | P2 | Check usage by org, possible abuse |
| `AgentRuntimeStepTimeout` | P3 | Check tool availability, increase timeout if needed |
| `WeaviateIndexingLatencyHigh` | P3 | Check Weaviate pod resources, reduce batch size |

---

## Datadog Dashboards

| Dashboard | URL Pattern | Use For |
|---|---|---|
| AIEP Platform Overview | `app.datadoghq.com/dashboard/aiep-overview` | First-look during incidents |
| LLM Gateway | `app.datadoghq.com/dashboard/aiep-llm-gateway` | Provider latency, error rates, cache |
| Prompt Service | `app.datadoghq.com/dashboard/aiep-prompt-svc` | Prompt query performance |
| Agent Runtime | `app.datadoghq.com/dashboard/aiep-agent-runtime` | Workflow execution, step durations |
| Database | `app.datadoghq.com/dashboard/aiep-postgres` | Query performance, connections |
| Kafka | `app.datadoghq.com/dashboard/aiep-kafka` | Consumer lag, throughput |

---

## Common Diagnosis Commands

### Service health
```bash
# All pod statuses in prod namespace
kubectl -n aiep-prod get pods

# Recent logs (last 100 lines)
kubectl -n aiep-prod logs deploy/<service-name> --tail=100

# Follow logs in real time
kubectl -n aiep-prod logs -f deploy/<service-name>

# Logs from a specific pod (when one pod is failing)
kubectl -n aiep-prod logs <pod-name>
```

### LLM Gateway — provider issues
```bash
# Check current provider error rates (Datadog CLI or dashboard)
# Check if fallback is active:
kubectl -n aiep-prod logs deploy/llm-gateway --tail=200 | grep "fallback"

# Manually trigger fallback (set feature flag in LaunchDarkly):
# Flag: llm-gateway.force-anthropic-fallback = true
```

### PostgreSQL — connection pool
```bash
# Check active connections
kubectl -n aiep-prod exec deploy/prompt-service -- \
  psql $DB_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Kill long-running queries (> 5 minutes)
kubectl -n aiep-prod exec deploy/prompt-service -- \
  psql $DB_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"
```

### Kafka consumer lag
```bash
# Check lag for all consumer groups
kubectl -n aiep-prod exec deploy/kafka-tools -- \
  kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS --list

# Describe a specific group
kubectl -n aiep-prod exec deploy/kafka-tools -- \
  kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS \
  --group aiep-audit-consumer --describe
```

### Redis — semantic cache
```bash
# Check Redis memory usage
kubectl -n aiep-prod exec deploy/llm-gateway -- redis-cli -u $REDIS_URL INFO memory | grep used_memory_human

# Check hit rate
kubectl -n aiep-prod exec deploy/llm-gateway -- redis-cli -u $REDIS_URL INFO stats | grep "keyspace_hits\|keyspace_misses"

# Flush cache (last resort, causes temporary latency increase)
kubectl -n aiep-prod exec deploy/llm-gateway -- redis-cli -u $REDIS_URL FLUSHDB
```

---

## SLO Thresholds

| SLO | Target | Alert Threshold |
|---|---|---|
| LLM gateway p95 latency | ≤ 350ms | > 500ms for 5 min |
| LLM gateway error rate | ≤ 0.5% | > 1% for 5 min |
| prompt-service availability | 99.9% | > 1 min downtime |
| auth-service availability | 99.95% | > 30s downtime |
| Agent workflow completion rate | ≥ 95% | < 92% for 10 min |

---

## Related Files

- `.ai/playbooks/incident-response.md` — full incident response protocol
- `.ai/playbooks/debugging.md` — debugging workflow
- `.ai/deployment/rollback-procedures.md` — rollback steps
