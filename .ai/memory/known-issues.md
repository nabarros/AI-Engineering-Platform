---
ai_priority: tier-2
context_type: known-issues
load_when: debugging, bug-investigation, before-touching-affected-areas
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Known Issues

Active bugs, workarounds, and pitfalls. Check this file before debugging a problem — it may already be documented.

**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## Open Issues

### 🟠 LLM Gateway: Semantic cache false positives on short prompts
- **Symptoms:** Short prompts (< 20 tokens) occasionally return cached results from semantically distant prompts
- **Root cause:** Cosine similarity threshold (0.95) is insufficient for short embeddings with low variance
- **Affected versions:** llm-gateway v2.4.1
- **Workaround:** Cache is disabled for prompts with `estimatedTokens < 25` (hotfix applied 2026-05-01)
- **Fix tracking:** Jira AIEP-1842 — raise threshold to 0.97 for short prompts
- **Do not:** Reduce the global threshold — this degrades cache hit rate for normal prompts

### 🟡 Prompt Service: Concurrent version creation race condition
- **Symptoms:** Two simultaneous "create version" requests can both succeed when they should conflict
- **Root cause:** Version uniqueness check is not atomic with insert
- **Affected versions:** prompt-service ≤ v1.8.0
- **Workaround:** Version numbers are still unique (DB sequence), but two "draft" versions may exist simultaneously
- **Fix tracking:** Jira AIEP-1831 — add `SELECT ... FOR UPDATE` around version creation
- **Impact:** Low — affects only automated workflows that create versions concurrently

### 🟡 Agent Runtime: Tool executor timeout not propagated to client
- **Symptoms:** If a tool call exceeds 30s, the agent runtime receives a timeout but the client sees a generic 500
- **Root cause:** `TOOL_TIMEOUT` error code is not included in the HTTP error mapping
- **Affected versions:** agent-runtime v1.3.2
- **Workaround:** None for clients; monitor for `TOOL_TIMEOUT` in agent-runtime logs
- **Fix tracking:** Jira AIEP-1855 — add `TOOL_TIMEOUT` → 504 mapping

### 🟢 Vector Store: Weaviate query occasionally returns duplicate results
- **Symptoms:** `vectorStoreService.search()` may return the same document ID twice in results
- **Root cause:** MMR reranking does not deduplicate before returning
- **Affected versions:** vector-store-service v1.1.0
- **Workaround:** Callers should deduplicate by `documentId` before use
- **Fix tracking:** Jira AIEP-1802 — add deduplication step in `vectorSearchPipeline`

### 🟢 Auth Service: Refresh token not revoked on password change
- **Symptoms:** After password change, existing refresh tokens remain valid until natural expiry (7 days)
- **Root cause:** Password change handler does not call token revocation
- **Affected versions:** auth-service v3.2.1
- **Workaround:** Users can manually revoke sessions in account settings
- **Security impact:** Low — requires attacker to have already stolen the refresh token
- **Fix tracking:** Jira AIEP-1798 — revoke all refresh tokens on password change

---

## Known Pitfalls (Not Bugs — Design Limitations)

### Kafka Consumer Group Lag on Deployment
When deploying a new version of a Kafka consumer service, the consumer group briefly pauses, causing lag to accumulate. This is expected — not a bug. Lag typically clears within 60 seconds post-deployment.

**Do not** set an alert threshold below 500 messages for consumer groups during deployment windows.

### PgBouncer Session Mode Required for Transactions
PgBouncer is configured in `session` mode (not `transaction` mode) because services use `LISTEN/NOTIFY`. Switching to transaction mode would break this. Keep in mind when evaluating connection pool metrics.

### Weaviate Cold Query Performance
The first query after Weaviate pod restart is ~3x slower than steady-state due to HNSW index warm-up. Readiness probe is configured with a 30s delay to mitigate this, but avoid load testing immediately after Weaviate restarts.

---

## Recently Resolved

| Issue | Resolved | Version | Notes |
|---|---|---|---|
| LLM Gateway: Connection pool exhaustion under burst load | 2026-04-28 | v2.4.1 | Added request queue buffer |
| Prompt Service: N+1 on version list endpoint | 2026-04-15 | v1.8.0 | Added JOIN-based batch loading |
| Auth Service: JWT leakage in error logs | 2026-03-22 | v3.2.0 | Scrubbed `authorization` header from log fields |

---

## Related Files

- `.ai/memory/technical-debt.md` — non-bug deferred work
- `.ai/memory/active-work.md` — in-progress fixes
