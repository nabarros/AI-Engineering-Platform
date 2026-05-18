---
ai_priority: medium
context_type: operations
load_when: local setup, docker, first-time developer onboarding, deployment troubleshooting
token_budget: medium
---

# Docker Desktop Local Setup

Complete guide for running the AI Engineering Platform (AIEP) locally on Docker Desktop.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Quick Start — One Command](#quick-start--one-command)
- [Health Check Verification](#health-check-verification)
- [Environment Configuration](#environment-configuration)
- [Adding LLM API Keys](#adding-llm-api-keys)
- [Development Workflow](#development-workflow)
- [End-to-End Smoke Test](#end-to-end-smoke-test)
- [Troubleshooting](#troubleshooting)
- [Database Reset and Cleanup](#database-reset-and-cleanup)
- [Performance Tuning](#performance-tuning)
- [Stopping and Cleaning Up](#stopping-and-cleaning-up)
- [Related Documentation](#related-documentation)

---

## Prerequisites

### Required

| Tool | Minimum version | Check |
|---|---|---|
| Docker Desktop | 4.x | `docker --version` |
| Docker Compose | 2.x (bundled) | `docker compose version` |
| Git | any | `git --version` |
| Bash | any | macOS/Linux terminal |

### Optional

- **OpenAI API key** — enables LLM model calls and Weaviate OpenAI vectorizer
- **Anthropic API key** — enables Claude model calls

### Docker Desktop resource recommendations (macOS)

| Resource | Recommended |
|---|---|
| CPU | 4–6 cores |
| Memory | 8 GB minimum, 12 GB preferred |
| Disk | 60 GB free |

If Kafka or Weaviate restart unexpectedly, increase Docker Desktop memory in **Settings → Resources**.

---

## Architecture Overview

The local stack runs seven containers (including the optional MCP service), all on the `aiep-network` bridge:

| Container | Purpose | Host Port(s) |
|---|---|---|
| `aiep-app` | Orchestration API (8787) + Shared State Service (8790) | 8787, 8790 |
| `aiep-postgres` | PostgreSQL 16 — relational store | 5432 |
| `aiep-redis` | Redis 7.2 — cache / session | 6379 |
| `aiep-weaviate` | Weaviate 1.24 — vector database | 8080, 50051 |
| `kafka` | Apache Kafka 3.6 — event streaming | 9092 |
| `zookeeper` | Kafka coordinator | 2181 |
| `aiep-mcp` *(optional)* | Router Knowledge MCP server — VS Code knowledge tool | 8791 |

### Data persistence

Three Docker volumes survive `--down` restarts:

- `db-data` — PostgreSQL
- `redis-data` — Redis
- `weaviate-data` — Weaviate

Bind mounts give the `aiep-app` container live access to local source:

- `./src` → `/app/src`
- `./data` → `/app/data`

---

## Quick Start — One Command

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd AI-Engineering-Platform

# 2. Create your local environment file
cp .env.example .env

# 3. (Optional) Add LLM API keys — see "Adding LLM API Keys" below

# 4. Deploy everything
bash scripts/deploy-local-docker.sh --fresh
```

`--fresh` tears down any existing containers and volumes, rebuilds images, starts all services, and waits for health checks to pass.

### Other deployment modes

```bash
# Rebuild image and restart all containers
bash scripts/deploy-local-docker.sh --redeploy

# Restart containers without rebuilding (fastest for code-only changes)
bash scripts/deploy-local-docker.sh --redeploy --no-build

# Show running container status
bash scripts/deploy-local-docker.sh --status

# Stream logs from all services
bash scripts/deploy-local-docker.sh --logs

# Stop and remove all containers (volumes preserved)
bash scripts/deploy-local-docker.sh --down

# Reset PostgreSQL data only
bash scripts/deploy-local-docker.sh --reset-db
```

---

## Health Check Verification

### One-command status

```bash
bash scripts/deploy-local-docker.sh --status
```

### Manual endpoint probes

```bash
# Orchestration API
curl -sS http://localhost:8787/health | jq .

# Shared State Service
curl -sS http://localhost:8790/health | jq .

# Weaviate vector database
curl -sS http://localhost:8080/v1/.well-known/ready | jq .
```

### Container-level health

```bash
docker compose ps

# Inspect individual container health state
docker inspect --format='{{.Name}} → {{.State.Health.Status}}' \
  aiep-app aiep-postgres aiep-redis aiep-weaviate
```

Expected: all containers in `healthy` or `running` state within 30–60 seconds.

---

## Environment Configuration

Copy [.env.example](.env.example) to `.env` and adjust as needed. **Never commit `.env` to git.**

### Key variable groups

**Runtime**

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Runtime mode |
| `LOG_LEVEL` | `debug` | Log verbosity |

**Orchestration**

| Variable | Default | Purpose |
|---|---|---|
| `ORCHESTRATION_PORT` | `8787` | Orchestration API port |
| `ORCHESTRATION_STATE_PORT` | `8790` | Shared state service port |
| `ORCHESTRATION_STATE_API_KEY` | *(generated)* | API key for state service calls |
| `MCP_KNOWLEDGE_PORT` | `8791` | Port for the Router Knowledge MCP server |

**Data layer**

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://aiep_user:aiep_password@postgres:5432/aiep_dev` | Full PostgreSQL DSN |
| `REDIS_URL` | `redis://:aiep_redis_secret@redis:6379/0` | Full Redis URL |
| `WEAVIATE_URL` | `http://weaviate:8080` | Weaviate internal endpoint |
| `KAFKA_BROKERS` | `kafka:29092` | Kafka broker list (internal) |

**LLM services** — see section below.

**Router Knowledge Store (MCP)**

| Variable | Default | Purpose |
|---|---|---|
| `ROUTER_KNOWLEDGE_WEAVIATE_INDEX_ENABLED` | `true` | Enable async vector indexing when available |
| `ROUTER_KNOWLEDGE_EMBEDDING_ORDER` | `local,openai` | Embedding provider order (local-first) |
| `ROUTER_KNOWLEDGE_LOCAL_EMBEDDING_URL` | `http://host.docker.internal:11434/api/embeddings` | Local embedding endpoint |
| `ROUTER_KNOWLEDGE_LOCAL_EMBEDDING_MODEL` | `nomic-embed-text` | Local embedding model name |
| `ROUTER_KNOWLEDGE_OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI embedding model for optional enrichment |
| `ROUTER_KNOWLEDGE_ANTHROPIC_SCORING_ENABLED` | `false` | Enable optional Anthropic lexical re-scoring |
| `ROUTER_KNOWLEDGE_LOCAL_STORE_PATH` | *(empty)* | Optional custom path for local durable store |

### Security checklist

- [ ] Replace all default passwords before sharing with teammates
- [ ] Use a dedicated least-privilege API key per LLM provider
- [ ] Rotate keys if `.env` is accidentally exposed
- [ ] Never log the value of `ORCHESTRATION_STATE_API_KEY` or LLM keys

---

## Adding LLM API Keys

Edit `.env` and set the real values:

```dotenv
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-opus
```

Then restart the app container to pick up the new values:

```bash
bash scripts/deploy-local-docker.sh --redeploy --no-build
```

**Where to get keys:**

- OpenAI: <https://platform.openai.com/account/api-keys>
- Anthropic: <https://console.anthropic.com>

> The orchestration routing layer works without LLM keys — keys are only required when a specialist agent needs to call an external model for code generation or analysis.

---

## Development Workflow

### Starting the Router Knowledge MCP server

The MCP server starts automatically as part of the Docker stack when you run either:

```bash
bash scripts/deploy-local-docker.sh --fresh
bash scripts/deploy-local-docker.sh --redeploy
```

For MCP-only lifecycle operations:

```bash
# Start only MCP
docker compose up -d mcp

# Stop only MCP
docker compose stop mcp
```

VS Code continues to connect through `http://localhost:8791`, and routing remains non-blocking if MCP is down.
Without any API keys, the system still records prompts locally and performs lexical lookup fallback.

### Inner loop (code changes only)

Because `./src` is bind-mounted into the container, editing files locally is immediately reflected. For changes that don't require a Node.js restart:

```bash
# Just restart the app process
bash scripts/deploy-local-docker.sh --redeploy --no-build
```

### When a full rebuild is required

Rebuild the Docker image when:

- `package.json` or `package-lock.json` changed
- `Dockerfile` changed
- A native dependency was added

```bash
bash scripts/deploy-local-docker.sh --redeploy
```

### Log streaming

```bash
bash scripts/deploy-local-docker.sh --logs

# Or target a specific service
docker compose logs -f aiep
docker compose logs -f postgres kafka
```

---

## End-to-End Smoke Test

### 1. Verify health

```bash
curl -sS http://localhost:8787/health | jq .
# Expected: { "ok": true, "service": "orchestration-api", ... }
```

### 2. Route a single task

```bash
curl -sS -X POST http://localhost:8787/orchestrate \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: local-dev" \
  -d '{
    "requestId": "smoke-001",
    "task": {
      "domain": "backend",
      "risk": "MEDIUM",
      "description": "Design and implement a REST endpoint for user listing"
    },
    "budget": {
      "tokenBudgetTier": "MEDIUM",
      "latencyBudgetTier": "MEDIUM"
    },
    "confirmation": true,
    "executionEvidence": {
      "testsPassed": true,
      "securityChecksPassed": true,
      "contractChecksPassed": true,
      "errorHandlingValidated": true,
      "qualityScore": 0.92
    }
  }' | jq .selectedAgent
```

Expected: `"AIEP Senior Staff Backend Engineer"`

### 3. Test all five domain specialists

```bash
for DOMAIN in frontend backend ai devops architecture; do
  echo -n "$DOMAIN → "
  curl -sS -X POST http://localhost:8787/orchestrate \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: local-dev" \
    -d "{
      \"requestId\": \"smoke-$DOMAIN\",
      \"task\": { \"domain\": \"$DOMAIN\", \"risk\": \"LOW\", \"description\": \"Test task for $DOMAIN domain\" },
      \"budget\": { \"tokenBudgetTier\": \"MEDIUM\", \"latencyBudgetTier\": \"MEDIUM\" },
      \"confirmation\": true,
      \"executionEvidence\": { \"testsPassed\": true, \"securityChecksPassed\": true,
        \"contractChecksPassed\": true, \"errorHandlingValidated\": true, \"qualityScore\": 0.9 }
    }" | jq -r '.selectedAgent // .error // "no response"'
done
```

### 4. Check routing weights and metrics

```bash
curl -sS http://localhost:8787/weights | jq .
curl -sS http://localhost:8787/metrics | jq .
```

---

## Troubleshooting

### Port conflicts

**Symptom:** Service fails to start with `bind: address already in use`.

```bash
# Check which processes hold the ports
lsof -i :8787 -i :8790 -i :5432 -i :6379 -i :8080 -i :9092 -i :2181
```

Resolution:

1. Stop the conflicting local process, or
2. Change the host-side port mapping in `docker-compose.yml`, or
3. Run `bash scripts/deploy-local-docker.sh --down` then `--fresh`

---

### Container stuck in `unhealthy`

```bash
docker compose ps
docker compose logs aiep --tail=200
docker compose logs postgres redis weaviate kafka --tail=100
```

Common causes:

| Cause | Fix |
|---|---|
| Not enough Docker memory | Increase to 8+ GB in Docker Desktop Settings → Resources |
| Weaviate failed to start | Check for port 8080 conflict; restart with `--fresh` |
| Kafka/Zookeeper timeout | Wai 30 seconds; Kafka startup is slow on first run |
| AIEP app crash at boot | Check `docker compose logs aiep` for Node.js errors |

---

### Volume/permission errors

**Symptom:** Write failures to `/app/data` or database init errors.

```bash
bash scripts/deploy-local-docker.sh --down
mkdir -p data
chmod -R u+rwX data
bash scripts/deploy-local-docker.sh --fresh
```

---

### `docker-compose` command not found

The deploy script calls `docker-compose` (legacy v1 binary). If only `docker compose` (v2 plugin) is available:

```bash
# Create a shim
echo '#!/bin/bash\ndocker compose "$@"' > /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

Or run Docker commands directly with `docker compose` (space, not hyphen).

---

## Database Reset and Cleanup

```bash
# Reset only PostgreSQL (keeps other volumes)
bash scripts/deploy-local-docker.sh --reset-db

# Full reset — removes all containers and named volumes
bash scripts/deploy-local-docker.sh --fresh

# Manual complete teardown
docker compose down --remove-orphans -v
docker volume prune -f
```

---

## Performance Tuning

| Area | macOS (Docker Desktop) | Linux |
|---|---|---|
| Startup time | 30–60 s (VM overhead) | 10–20 s (native) |
| I/O | Keep repo on local SSD, not iCloud Drive | Standard local FS |
| Memory pressure | Raise Docker memory to 12 GB if Kafka/Weaviate restart | Tune `vm.max_map_count` for Weaviate |
| CPU | Allocate 4–6 cores | Use host CPUs directly |

**Linux-specific (Weaviate):**

```bash
# Required for Weaviate HNSW index performance
sudo sysctl -w vm.max_map_count=262144
```

---

## Stopping and Cleaning Up

```bash
# Stop containers (volumes preserved — fastest resume)
bash scripts/deploy-local-docker.sh --down

# Stop and delete all volumes (full clean slate)
docker compose down --remove-orphans -v

# Remove dangling images
docker image prune -f

# Remove all unused Docker objects (use carefully — affects all projects)
docker system prune -f
```

---

## Related Documentation

- [docs/DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — CI/CD and production deployment
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — Full system architecture
- [docs/TESTING_STRATEGY.md](TESTING_STRATEGY.md) — Testing approach
- [docs/SECURITY_RULES.md](SECURITY_RULES.md) — Security requirements
- [docs/ROUTER_BEHAVIOR_AUDIT.md](ROUTER_BEHAVIOR_AUDIT.md) — Router edge cases and known behaviors
- [README.md](../README.md) — Project overview and quick start
