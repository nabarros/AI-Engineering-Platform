---
ai_priority: high
context_type: governance
load_when: adding new services, instrumentation, debugging production issues, alerting
token_budget: medium
---

# Observability

## AI Agent Load Guidance

Load this file when adding instrumentation to new services, diagnosing production issues, or setting up alerting. Load `.ai/deployment/observability-runbook.md` for operational procedures.

---

## Observability Pillars

The system uses three pillars implemented consistently across all services:

| Pillar | Tool | Data |
|--------|------|------|
| Logs | Structured JSON → Datadog | Events, errors, business transactions |
| Metrics | Prometheus → Grafana | System health, SLOs, business KPIs |
| Traces | OpenTelemetry → Datadog APM | Request flows, latency breakdown |

All three must be present in a new service before it deploys to production.

---

## 1. Structured Logging

### Log Format

All services emit JSON logs. Use the `@aiep/logger` package which wraps Pino (Node.js) or structlog (Python).

```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "llm-gateway",
  "version": "2.1.4",
  "traceId": "trace-abc123",
  "requestId": "req-xyz789",
  "userId": "usr-001",
  "message": "LLM request completed",
  "provider": "openai",
  "model": "gpt-4o",
  "inputTokens": 142,
  "outputTokens": 380,
  "durationMs": 1840,
  "cost": 0.0053
}
```

### Required Fields

Every log entry must include:

| Field | Type | Source |
|-------|------|--------|
| `level` | string | logger |
| `timestamp` | ISO 8601 UTC | logger |
| `service` | string | env config |
| `version` | string | env config |
| `traceId` | string | propagated header |
| `requestId` | string | generated per request |
| `message` | string | caller |

### Logging Rules

- **PII prohibition:** Email addresses, names, phone numbers, IPs (unless needed for security) must not appear in logs at any level
- **Secret prohibition:** Tokens, passwords, API keys must never be logged
- **Prompt content:** LLM prompt content is logged only at `debug` level, and only in non-production environments
- **Response content:** LLM response content is not logged (privacy + cost)
- Level `info` and above in production; `debug` available via feature flag per service instance

### TypeScript Logging

```typescript
import { createLogger } from '@aiep/logger';

const logger = createLogger({
  service: 'llm-gateway',
  version: process.env.APP_VERSION,
});

// Good — structured fields, meaningful message
logger.info({ provider, model, durationMs, cost }, 'LLM request completed');

// Good — error with context
logger.error({ userId, promptId, error: result.error }, 'Prompt deployment failed');

// Bad — unstructured, no context
logger.info(`Request completed in ${duration}ms`);
logger.error(err);
```

### Python Logging

```python
import structlog

logger = structlog.get_logger().bind(service="agent-runtime")

# Good
logger.info("workflow_completed", workflow_id=workflow_id, steps=len(steps), duration_ms=duration_ms)

# Good
logger.error("weaviate_query_failed", query_id=query_id, error=str(exc))
```

---

## 2. Metrics

### Metric Naming Convention

```
aiep_{service}_{metric}_{unit}

aiep_llm_gateway_requests_total
aiep_llm_gateway_request_duration_seconds
aiep_prompt_service_deployments_total
aiep_agent_runtime_workflow_steps_active
```

### Standard Metrics (Required for All Services)

```typescript
// Register in service startup
const metrics = {
  requestsTotal: new Counter({
    name: 'aiep_{service}_requests_total',
    help: 'Total HTTP requests handled',
    labelNames: ['method', 'path', 'status_code'],
  }),
  requestDuration: new Histogram({
    name: 'aiep_{service}_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }),
  errorsTotal: new Counter({
    name: 'aiep_{service}_errors_total',
    help: 'Total errors by type',
    labelNames: ['error_code', 'severity'],
  }),
  activeConnections: new Gauge({
    name: 'aiep_{service}_active_connections',
    help: 'Current active connections',
  }),
};
```

### AI-Specific Metrics

The LLM Gateway and related services must also emit:

```typescript
const aiMetrics = {
  llmRequestsTotal: counter({ name: 'aiep_llm_requests_total', labels: ['provider', 'model', 'status'] }),
  llmTokensTotal: counter({ name: 'aiep_llm_tokens_total', labels: ['provider', 'model', 'direction'] }), // direction: input|output
  llmCostTotal: counter({ name: 'aiep_llm_cost_usd_total', labels: ['provider', 'model', 'team'] }),
  llmLatencySeconds: histogram({ name: 'aiep_llm_latency_seconds', labels: ['provider', 'model'] }),
  agentWorkflowsActive: gauge({ name: 'aiep_agent_workflows_active' }),
  vectorSearchDuration: histogram({ name: 'aiep_vector_search_duration_seconds' }),
};
```

### SLO Metrics

Alerting is driven by SLO metrics. Define these for every service endpoint:

| SLO | Target | Metric |
|-----|--------|--------|
| API availability | 99.9% | `sum(rate(requests_total{status!~"5.."})) / sum(rate(requests_total))` |
| P95 latency | < 500ms | `histogram_quantile(0.95, rate(request_duration_seconds_bucket))` |
| LLM error rate | < 1% | `sum(rate(llm_requests_total{status="error"})) / sum(rate(llm_requests_total))` |
| LLM P95 latency | < 3s | `histogram_quantile(0.95, rate(llm_latency_seconds_bucket))` |

---

## 3. Distributed Tracing

### Context Propagation

Every service must:
1. Extract trace context from incoming requests (`traceparent` header, W3C format)
2. Create a child span for its processing
3. Inject trace context into all outgoing requests and Kafka messages

```typescript
import { trace, context, propagation } from '@opentelemetry/api';

// In HTTP handler
const span = tracer.startSpan('prompt.deploy', {
  attributes: {
    'prompt.id': promptId,
    'user.id': request.user.id,
  },
});

try {
  const result = await promptService.deploy(promptId);
  span.setStatus({ code: SpanStatusCode.OK });
  return result;
} catch (error) {
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  span.recordException(error);
  throw error;
} finally {
  span.end();
}
```

### Span Naming Convention

```
{service}.{operation}
{http.method} {http.route}    ← HTTP spans (auto-instrumented)
{db.system}.{db.operation}   ← DB spans (auto-instrumented)

Examples:
llm-gateway.route_request
prompt-service.deploy
agent-runtime.execute_workflow
```

### Required Span Attributes

| Attribute | Required For |
|-----------|-------------|
| `user.id` | Authenticated requests |
| `prompt.id` | Prompt operations |
| `model.name` | LLM operations |
| `workflow.id` | Agent operations |
| `error.type` | Error spans |

---

## 4. Alerting

### Alert Routing

| Severity | Channel | Response Time |
|----------|---------|--------------|
| Critical | PagerDuty → On-call | < 5 minutes |
| High | #alerts-high Slack + PagerDuty | < 30 minutes |
| Medium | #alerts-medium Slack | < 4 hours |
| Low | Weekly digest | Next sprint |

### Required Alerts

Every service must have alerts for:

```yaml
- name: HighErrorRate
  expr: rate(errors_total[5m]) / rate(requests_total[5m]) > 0.05
  severity: high

- name: HighLatency
  expr: histogram_quantile(0.95, rate(request_duration_seconds_bucket[5m])) > 2
  severity: medium

- name: ServiceDown
  expr: up{job="aiep-service"} == 0
  severity: critical
```

### Runbook Requirement

Every alert must link to a runbook:

```yaml
annotations:
  runbook: "https://docs.internal/runbooks/high-error-rate"
  description: "Error rate > 5% for service {{ $labels.service }}"
```

---

## Health Checks

Every service must expose:

```
GET /health/live   → 200 if process is alive
GET /health/ready  → 200 if ready to serve traffic (dependencies healthy)
```

```typescript
fastify.get('/health/ready', async (request, reply) => {
  const [dbHealthy, redisHealthy] = await Promise.allSettled([
    db.query('SELECT 1'),
    redis.ping(),
  ]);

  if (dbHealthy.status === 'rejected' || redisHealthy.status === 'rejected') {
    return reply.status(503).send({ status: 'unhealthy' });
  }

  return reply.status(200).send({ status: 'healthy' });
});
```

---

## Dashboard Requirements

Each service must have a Grafana dashboard with:
- Request rate (RPS)
- Error rate (%)
- P50 / P95 / P99 latency
- Active connections
- Service-specific business metrics (e.g., tokens/second for LLM gateway)

Dashboards defined as code in `infra/dashboards/` and deployed via CI.
