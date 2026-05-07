---
tags: [debugging, node, python, logging, tracing, profiling]
applies_to: [src/**]
priority: medium
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Skill: Debugging Node.js and Python Services

## Purpose

Systematic debugging workflows for Node.js/TypeScript and Python/FastAPI services. Load when diagnosing failures, tracing errors, or profiling performance issues.

## Applicability

Load when: diagnosing production incidents, debugging test failures, profiling slow endpoints, or reading distributed traces.

---

## 1. Node.js Debugging Workflow

### Step 1 — Reproduce Locally

```bash
# Start with debug logging enabled
LOG_LEVEL=debug NODE_ENV=development node --inspect ./dist/services/llm-gateway/index.js

# Or via ts-node with source maps
ts-node --require source-map-support/register src/services/llm-gateway/index.ts
```

### Step 2 — Attach Debugger (VS Code)

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to Node",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "sourceMaps": true,
      "outFiles": ["${workspaceRoot}/dist/**/*.js"],
      "restart": true
    },
    {
      "name": "Debug Unit Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "vitest",
      "args": ["--run", "--reporter=verbose", "${relativeFile}"],
      "sourceMaps": true
    }
  ]
}
```

### Step 3 — Read Structured Logs

```bash
# Local: pipe to pino-pretty for readable output
npx pino-pretty < app.log | grep '"level":50' # error level

# Filter by request ID to trace a single request
cat app.log | jq 'select(.requestId == "req-abc123")'

# Find all errors in last 5 minutes
cat app.log | jq 'select(.level >= 50 and .time > (now - 300) * 1000)'

# In production: DataDog Logs
# Filter: @level:error service:llm-gateway @requestId:req-abc123
```

### Step 4 — Inspect Process State

```bash
# Node.js heap snapshot
kill -USR2 <pid>  # if heap profiler is enabled

# Or via clinic.js for CPU profiling
npx clinic flame -- node ./dist/index.js
npx clinic doctor -- node ./dist/index.js
```

---

## 2. Python Debugging Workflow

### Interactive Debugging

```python
# Use debugpy for VS Code attach
import debugpy
debugpy.listen(5678)
debugpy.wait_for_client()  # blocks until debugger attaches — remove before commit

# Or: breakpoint() for inline debugging (Python 3.7+)
async def infer(request: InferenceRequest) -> InferenceResponse:
    breakpoint()  # inspect here — remove before commit
    result = await provider.complete(request.prompt)
    return result
```

```json
// .vscode/launch.json
{
  "name": "Attach to Python",
  "type": "python",
  "request": "attach",
  "port": 5678,
  "host": "localhost"
}
```

### Log Analysis

```bash
# Python logs are JSON via structlog
cat python-service.log | python3 -m json.tool | grep '"level": "error"'

# Or: use jq
cat python-service.log | jq 'select(.level == "error")'

# Trace a request
cat python-service.log | jq 'select(.request_id == "req-abc123")'
```

### Async Debugging

```python
# Check for blocked event loop
import asyncio
import traceback

def dump_tasks():
    for task in asyncio.all_tasks():
        print(f"Task: {task.get_name()}")
        task.print_stack()

# Set signal handler to dump tasks on SIGUSR1
import signal
signal.signal(signal.SIGUSR1, lambda sig, frame: dump_tasks())
```

---

## 3. Reading Distributed Traces

All services export traces to DataDog APM via OpenTelemetry. To trace a failure:

1. **Find the trace ID:** Look in the log line containing the error — it will have `traceId` field.
2. **Open DataDog APM:** Filter by `@traceId:<id>`.
3. **Read the flame chart:** Identify the span where duration spikes or errors appear.
4. **Examine span attributes:** Each span has `db.statement`, `http.url`, `llm.model`, `error.message` tags.
5. **Cross-reference logs:** The same `traceId` is injected into all log lines within the span.

```typescript
// How traceId is propagated in Node.js
import { trace } from '@opentelemetry/api';

function getCurrentTraceId(): string {
  return trace.getActiveSpan()?.spanContext().traceId ?? 'no-trace';
}

// In Fastify: automatically injected into request logger
fastify.addHook('onRequest', async (request) => {
  request.log = request.log.child({ traceId: getCurrentTraceId() });
});
```

---

## 4. Common Failure Patterns

### Database Connection Issues

```bash
# Check PgBouncer pool status
psql -h pgbouncer-host -p 6432 pgbouncer -c "SHOW POOLS;"

# Check for long-running queries (potential locks)
SELECT pid, duration, state, query
FROM pg_stat_activity
WHERE duration > interval '30 seconds'
ORDER BY duration DESC;
```

### Memory Leaks (Node.js)

```typescript
// Add periodic heap stats logging to identify growth
setInterval(() => {
  const mem = process.memoryUsage();
  logger.info({
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
  }, 'Memory stats');
}, 60_000);
```

### Event Loop Blocking

```typescript
import { monitorEventLoopDelay } from 'perf_hooks';

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();

setInterval(() => {
  if (h.mean > 50) { // > 50ms mean delay is a problem
    logger.warn({ meanDelayMs: h.mean / 1e6 }, 'Event loop delay detected');
  }
  h.reset();
}, 10_000);
```

### LLM Provider Timeouts

```typescript
// Check circuit breaker state
const circuitState = await circuitBreaker.getState('openai');
logger.info({ circuitState }, 'LLM provider circuit breaker state');

// Force circuit reset if needed (CAUTION: verify provider health first)
// await circuitBreaker.reset('openai');
```

---

## 5. Performance Profiling

### Node.js CPU Profile

```bash
# Generate flame graph with 0x
npm install -g 0x
0x -- node ./dist/services/llm-gateway/index.js

# Send load, then Ctrl+C — flame graph auto-generated in ./0x-pid/
```

### Python Profiling

```python
# Async profiling with yappi
import yappi
import asyncio

yappi.set_clock_type("wall")
yappi.start()

# ... run the code under test ...

yappi.stop()
yappi.get_func_stats().print_all(
    columns={0: ("name", 60), 1: ("ncall", 10), 2: ("ttot", 10), 3: ("tavg", 10)}
)
```

---

## 6. Kubernetes Debugging

```bash
# Get pod logs (last 100 lines)
kubectl logs -n aiep deploy/llm-gateway --tail=100

# Follow logs from all replicas
kubectl logs -n aiep -l app=llm-gateway -f --max-log-requests=5

# Exec into pod for inspection
kubectl exec -n aiep -it deploy/llm-gateway -- /bin/sh

# Check resource pressure
kubectl top pods -n aiep

# Describe pod for crash/OOM details
kubectl describe pod -n aiep llm-gateway-<hash>

# Check recent events
kubectl get events -n aiep --sort-by=.lastTimestamp | tail -20
```

---

## Anti-Patterns

| Anti-Pattern | Why It's Problematic |
|---|---|
| `console.log` for debugging | Leaves noise in production; use structured logger |
| Committing `debugpy.wait_for_client()` | Blocks all requests in production |
| Reading raw DB in production to debug | Use read replicas; never lock prod tables |
| Ignoring `traceId` in logs | Makes cross-service correlation impossible |
| Guessing root cause without traces | Always reproduce in traces before hypothesizing |
