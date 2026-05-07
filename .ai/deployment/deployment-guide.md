---
ai_priority: tier-2
context_type: deployment-guide
load_when: deployment, release, environment-changes
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Deployment Guide (AI-Optimized)

Quick reference for deployments. Full playbook: `.ai/playbooks/deployment.md`.

---

## Service Registry

| Service | Port | K8s Namespace | ArgoCD App | Health Endpoint |
|---|---|---|---|---|
| llm-gateway | 3001 | `aiep-prod` | `aiep-llm-gateway` | `/health` |
| prompt-service | 3002 | `aiep-prod` | `aiep-prompt-service` | `/health` |
| agent-runtime | 3003 | `aiep-prod` | `aiep-agent-runtime` | `/health` |
| vector-store-service | 3004 | `aiep-prod` | `aiep-vector-store` | `/health` |
| model-registry | 3005 | `aiep-prod` | `aiep-model-registry` | `/health` |
| inference-service | 3006 | `aiep-prod` | `aiep-inference` | `/health` |
| observability-service | 3007 | `aiep-prod` | `aiep-observability` | `/health` |
| auth-service | 3008 | `aiep-prod` | `aiep-auth` | `/health` |
| audit-service | 3009 | `aiep-prod` | `aiep-audit` | `/health` |

---

## Environment Variables (Required Per Service)

### All Services (common)
```
NODE_ENV=production
LOG_LEVEL=info
SERVICE_NAME=<service-name>
DD_AGENT_HOST=datadog-agent.monitoring.svc.cluster.local
KAFKA_BROKERS=<MSK broker list>
KAFKA_SASL_USERNAME=<from Secrets Manager>
KAFKA_SASL_PASSWORD=<from Secrets Manager>
```

### llm-gateway
```
OPENAI_API_KEY=<from Secrets Manager: aiep/llm-gateway/openai-api-key>
ANTHROPIC_API_KEY=<from Secrets Manager: aiep/llm-gateway/anthropic-api-key>
AUTH_SERVICE_URL=http://auth-service.aiep-prod.svc.cluster.local:3008
PROMPT_SERVICE_URL=http://prompt-service.aiep-prod.svc.cluster.local:3002
REDIS_URL=<from Secrets Manager: aiep/common/redis-url>
```

### auth-service
```
JWT_SECRET=<from Secrets Manager: aiep/auth-service/jwt-secret>
DB_URL=<from Secrets Manager: aiep/auth-service/db-url>
REFRESH_TOKEN_TTL_DAYS=7
ACCESS_TOKEN_TTL_MINUTES=15
```

### prompt-service
```
DB_URL=<from Secrets Manager: aiep/prompt-service/db-url>
AUTH_SERVICE_URL=http://auth-service.aiep-prod.svc.cluster.local:3008
```

### vector-store-service (Python)
```
WEAVIATE_URL=http://weaviate.weaviate.svc.cluster.local:8080
WEAVIATE_API_KEY=<from Secrets Manager: aiep/vector-store/weaviate-api-key>
OPENAI_API_KEY=<from Secrets Manager: aiep/llm-gateway/openai-api-key>
AUTH_SERVICE_URL=http://auth-service.aiep-prod.svc.cluster.local:3008
```

---

## Deployment Commands

```bash
# Deploy a single service via ArgoCD
argocd app sync aiep-llm-gateway

# Force sync (skip diff check)
argocd app sync aiep-llm-gateway --force

# Check sync status
argocd app get aiep-llm-gateway

# Watch rollout
kubectl -n aiep-prod rollout status deployment/llm-gateway

# Check pod health
kubectl -n aiep-prod get pods -l app=llm-gateway
```

---

## Feature Flags

Feature flags in LaunchDarkly. Key flags:

| Flag Key | Default | Description |
|---|---|---|
| `llm-gateway.semantic-cache` | `false` | Enable Redis semantic caching for LLM responses |
| `agent-runtime.tool-use` | `false` | Enable agent tool use in workflows |
| `prompt-service.eval-auto` | `false` | Enable automated prompt evaluation |
| `llm-gateway.streaming` | `true` | Enable streaming LLM responses |

---

## Database Migration

```bash
# Run migrations for a specific service
kubectl -n aiep-prod exec deploy/prompt-service -- pnpm migrate:up

# Verify migrations applied
kubectl -n aiep-prod exec deploy/prompt-service -- pnpm migrate:status
```

Migrations must be backward-compatible. See `.ai/skills/migration-strategy.md`.

---

## Related Files

- `.ai/playbooks/deployment.md` — full deployment playbook with pre/post checklists
- `.ai/deployment/rollback-procedures.md` — rollback steps per service
- `.ai/deployment/observability-runbook.md` — alert responses
- `docs/DEPLOYMENT_GUIDE.md` — full deployment policy
