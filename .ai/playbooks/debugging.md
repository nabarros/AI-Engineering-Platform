---
ai_priority: tier-3
context_type: debugging-workflow
load_when: debugging, production-investigation, failure-diagnosis
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Playbook: Debugging

Systematic debugging workflows by failure type.

---

## Decision Tree — Where to Start

```
Is there an active alert? ──YES──► See incident-response.md
         │ NO
         ▼
Is it reproducible locally? ──NO──► Check logs/traces first (Section 1)
         │ YES
         ▼
Is it a test failure? ──YES──► Section 4
         │ NO
         ▼
Is it a performance issue? ──YES──► Section 3
         │ NO
         ▼
Section 2: Functional bug
```

---

## 1. Production Issue — Log and Trace First

```bash
# 1a. Find error in Datadog Logs
# Filter: @level:error service:<service-name> @env:production
# Sort: newest first
# Look for: error message, stack trace, requestId, traceId

# 1b. Find the trace
# Copy the traceId from the log
# Open Datadog APM → search by traceId
# Identify: which service failed, which span, what error

# 1c. Check recent deployments
kubectl rollout history deployment/<service> -n aiep | tail -5
# Did a deploy happen around the time errors started?

# 1d. Check upstream dependencies
kubectl get events -n aiep --sort-by=.lastTimestamp | tail -20
# Any pods crashing, OOMKilled, or restarting?
```

---

## 2. Functional Bug — Reproduce and Isolate

### Step 1: Write a failing test first
```typescript
// tests/regression/bug-1867.test.ts
it('should not leak memory when tool executor times out', async () => {
  // This test must fail before the fix, pass after
  const service = createAgentRuntime();
  
  // Simulate timeout condition
  mockTool.execute.mockImplementation(() => 
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
  );

  for (let i = 0; i < 100; i++) {
    await service.executeWorkflowStep({ type: 'tool', toolId: 'mock-tool' });
  }

  const { heapUsed } = process.memoryUsage();
  expect(heapUsed).toBeLessThan(50 * 1024 * 1024); // < 50MB
});
```

### Step 2: Find the root cause
```bash
# Enable verbose logging locally
LOG_LEVEL=trace ts-node src/services/<service>/index.ts

# Use Node.js inspector
node --inspect-brk ./dist/services/<service>/index.js
# Connect Chrome DevTools: chrome://inspect

# Heap snapshot on demand
kill -USR2 $(pgrep -f "node.*<service>")  # if heap profiler plugin enabled
```

### Step 3: Fix minimally
- Change only what is necessary to fix the specific bug
- Do not refactor surrounding code in the same PR
- The failing test from Step 1 must now pass
- Existing tests must not break

---

## 3. Performance Issue — Profile First

```bash
# 3a. Check current metrics baseline
# Datadog: service:<name> @http.status_code:200
# Measure: p50, p95, p99 over last 7 days vs current

# 3b. Find the slow span in traces
# Datadog APM → sort by duration (slowest first)
# Look for: unexpected DB calls, sequential async operations, large payloads

# 3c. Check database
psql -h $DB_HOST -U $DB_USER aiep_<service> -c "
  SELECT left(query, 80), round(mean_exec_time) as mean_ms, calls
  FROM pg_stat_statements
  WHERE mean_exec_time > 100
  ORDER BY mean_exec_time DESC LIMIT 10;"

# 3d. Check Redis hit rate
redis-cli -h $REDIS_HOST INFO stats | grep -E "keyspace_hits|keyspace_misses"
# Hit rate = hits / (hits + misses) — should be > 80% for hot paths

# 3e. CPU flame graph (if CPU-bound)
# See .ai/skills/debugging-node.md Section 5
```

---

## 4. Test Failure — Diagnose Category

```bash
# Run failing test with verbose output
pnpm vitest run --reporter=verbose src/path/to/failing.test.ts

# Check for test isolation issues (state leaking between tests)
pnpm vitest run --reporter=verbose --no-threads src/path/to/failing.test.ts

# Check for flakiness (run 10 times)
for i in {1..10}; do pnpm vitest run src/path/to/failing.test.ts && echo "PASS $i" || echo "FAIL $i"; done
```

**Common test failure patterns:**

| Symptom | Likely Cause | Fix |
|---|---|---|
| Fails only in CI, not locally | Different env vars or timezone | Check CI env; use UTC in all date logic |
| Passes alone, fails with other tests | State leaking from other test | Add `beforeEach` cleanup; use `isolate: true` |
| Flaky (50% fail rate) | Race condition or timing | Use fake timers; avoid real `setTimeout` |
| `ReferenceError: <mock> is not defined` | Mock import order issue | Move mock to top of file before imports |
| Snapshot mismatch | Intentional change not updated | Run `pnpm vitest -u` to update snapshots |

---

## 5. Database Issue

```sql
-- Check for lock contention
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND (now() - pg_stat_activity.query_start) > interval '5 seconds';

-- Check for lock waits
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks ON (
  blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation = blocked_locks.relation
  AND blocking_locks.granted = true
  AND blocked_locks.granted = false
)
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid;

-- Kill a blocking query (CAUTION: confirm this is safe first)
-- SELECT pg_terminate_backend(<pid>);
```

---

## 6. After the Fix

```
□ Failing test now passes
□ All existing tests pass (pnpm test --run)
□ No new TypeScript errors (pnpm build)
□ Root cause documented in PR description
□ Regression test added (named: tests/regression/bug-<jira-id>.test.ts)
□ Known-issues.md entry updated or removed
□ If production issue: post-mortem ticket created
```

---

## Related Files

- `.ai/skills/debugging-node.md` — Node.js and Python debugging techniques
- `.ai/playbooks/incident-response.md` — for active production incidents
- `docs/OBSERVABILITY.md` — log and trace conventions
