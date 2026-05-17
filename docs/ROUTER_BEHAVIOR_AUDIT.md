---
ai_priority: medium
context_type: engineering-analysis
load_when: router debugging, routing quality issues, scoring questions, capability selection
token_budget: medium
---

# Router Behavior Audit

Comprehensive analysis of `src/orchestration/router.js` — scoring model, identified edge cases, implemented fixes, and remaining recommendations.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Router Architecture](#router-architecture)
- [Implemented Fixes](#implemented-fixes)
- [Remaining Recommendations](#remaining-recommendations)
- [Test Coverage Plan](#test-coverage-plan)
- [Scoring Reference](#scoring-reference)
- [Related References](#related-references)

---

## Executive Summary

The routing implementation is deterministic, readable, and correctly decomposes scoring into five weighted components. Several behavioral gaps were identified and the high-priority ones have been addressed directly in code. Remaining items are lower risk and documented here for planned follow-up.

**Severity profile at time of audit (May 2026):**

| Severity | Total | Fixed | Remaining |
|---|---:|---:|---:|
| MEDIUM | 4 | 4 | 0 |
| LOW | 6 | 2 | 4 |
| **Total** | **10** | **6** | **4** |

---

## Router Architecture

### Core execution flow

```
routeTask(task, registry, budget, learningStats, scoringWeights)
  │
  ├─ validateRouteInputs()          — input safety guard (NEW)
  ├─ applyRiskBudgetOverrides()     — normalise budget to risk level, surface conflicts (UPDATED)
  ├─ classifyTask()                 — keyword-based domain detection
  ├─ findCandidates()               — filter registry by domain + risk ceiling
  ├─ scoreCapability() × N          — weighted 5-component score per candidate
  ├─ sort with tieBreakCompare()    — primary: totalScore, secondary: deterministic keys (NEW)
  └─ return selected + fallbackChain + metadata (UPDATED — scoreGap, nearTieWarning, budgetConflicts)
```

### Scoring model

Default weights from `DEFAULT_SCORING_WEIGHTS`:

| Component | Weight | Source |
|---|---:|---|
| domain | 0.35 | `getDomainScore()` |
| quality | 0.25 | `capability.qualityScore` |
| learning | 0.20 | `getLearningSuccessRate()` |
| cost | 0.12 | `scoreCostFitness()` |
| latency | 0.08 | `scoreLatencyFitness()` |

### Domain score values

| Condition | Score |
|---|---:|
| Exact domain match | 1.00 |
| Agent has `general` domain | 0.70 |
| No domain overlap | ~~0.20~~ → **0.05** (fixed) |

### Configurable constants (exported from `router.js`)

| Constant | Value | Purpose |
|---|---|---|
| `COST_OVERRUN_PENALTY` | 0.45 | Cost fitness penalty multiplier per tier over budget |
| `LATENCY_OVERRUN_PENALTY` | 0.40 | Latency fitness penalty multiplier per tier over budget |
| `NEAR_TIE_THRESHOLD` | 0.03 | Score gap below which routing is flagged as ambiguous |
| `DEFAULT_LEARNING_PRIOR` | 0.60 | Success rate assumed for capabilities with no history |
| `MAX_COMPOUND_AGENTS` | 4 | Maximum unique agents in a compound routing plan |

---

## Implemented Fixes

### Fix 1 — Deterministic tie-breaking
**Was:** Equal `totalScore` candidates sorted by registry insertion order (engine-dependent).  
**Now:** `tieBreakCompare()` applies deterministic secondary keys: domainScore → qualityScore → lower cost tier → lower latency tier → lexicographic id. Routing results are now stable regardless of registry ordering.

**Code:** `tieBreakCompare()` in `router.js`, applied inside `routeTask()` sort comparator.

---

### Fix 2 — Domain mismatch hard penalty
**Was:** No-match domain score = 0.20. A high-quality but domain-misaligned agent could outscore a domain-matched specialist.  
**Now:** No-match domain score = **0.05**. With a domain weight of 0.35, a mismatched agent can achieve at most `0.05×0.35 + 1×0.25 + 1×0.20 + 1×0.12 + 1×0.08 = 0.6675` total — well below a domain-matched agent's floor of `~0.865`.

**Code:** `getDomainScore()` in `router.js`.

---

### Fix 3 — Input validation with structured errors
**Was:** Invalid `task`, `registry`, or `budget` caused uncaught runtime exceptions.  
**Now:** `validateRouteInputs()` checks structural validity before routing. Returns a structured `{ error, selected: null, ... }` response instead of throwing. Validates:
- task is a non-null object with description or domain
- task.risk is one of `LOW | MEDIUM | HIGH | CRITICAL`
- registry is a non-empty array
- budget tiers are one of `LOW | MEDIUM | HIGH`

**Code:** `validateRouteInputs()` in `router.js`.

---

### Fix 4 — Risk-budget conflict reporting
**Was:** `applyRiskBudgetOverrides()` silently overrode incompatible budget tiers (e.g., LOW budget on HIGH risk) with no caller notification.  
**Now:** Overrides are still applied but `budgetConflicts: string[]` is included in the return value when any override occurred. Conflicts propagate through to the `routeTask()` response so callers can log, alert, or reject.

**Code:** `applyRiskBudgetOverrides()` and `routeTask()` return shape in `router.js`.

---

### Fix 5 — Near-tie ambiguity detection
**Was:** `needsClarification` only triggered when `routingConfidence < 0.7`, missing cases where two candidates scored very close to each other.  
**Now:** `needsClarification` also triggers when `scoreGap < NEAR_TIE_THRESHOLD (0.03)`. The response additionally includes:
- `scoreGap` — numeric distance between top and runner-up scores
- `nearTieWarning` — human-readable message when gap is below threshold

**Code:** `routeTask()` return value in `router.js`.

---

### Fix 6 — Conservative learning prior
**Was:** Default `successRate` for unknown capabilities = 0.75. Inflated ranking for unproven or newly-added specialists.  
**Now:** Default = **0.60** (`DEFAULT_LEARNING_PRIOR`). Proven specialists with measured history will organically earn higher scores; new ones start from a neutral baseline.

**Code:** `getLearningSuccessRate()` in `router.js`.

---

### Fix 7 — Compound agent cap
**Was:** `routeCompoundTask()` could produce unbounded `uniqueAgentsNeeded` for broad multi-domain prompts.  
**Now:** Domains are capped at `MAX_COMPOUND_AGENTS (4)`. Higher-confidence domains are kept; lower-confidence ones are dropped with an `agentCapWarning` in the response.

**Code:** `routeCompoundTask()` in `router.js`.

---

### Fix 8 — Named penalty constants
**Was:** Magic numbers `0.45` and `0.40` embedded inside scoring functions with no documented rationale.  
**Now:** Exported as `COST_OVERRUN_PENALTY` and `LATENCY_OVERRUN_PENALTY` with inline comments explaining the intentional asymmetry (billing impact vs UX impact).

**Code:** Top-level constants in `router.js`.

---

## Remaining Recommendations

These items have lower immediate risk and are deferred to planned follow-up.

### R1 — Keyword variant matching (LOW)

**Issue:** `detectDomains()` uses exact substring matching. Plurals, synonyms, and near-variants can miss classification.

**Example:** "pipelines" misses the "pipeline" keyword; "deployments" misses "deploy".

**Recommendation:** Introduce a normalisation step (stem/lemmatise) or expand keyword lists with common variants. Consider externalising the keyword map to JSON config so updates don't require code deploys.

**File:** `DOMAIN_KEYWORDS` constant in `router.js`

---

### R2 — Externalise domain keyword map (LOW)

**Issue:** Adding a new specialist domain requires a code change and redeploy.

**Recommendation:** Load `DOMAIN_KEYWORDS` from a versioned JSON/YAML config file with schema validation and hot-reload on change.

---

### R3 — Evidence-weighted learning prior (LOW)

**Issue:** The fixed `DEFAULT_LEARNING_PRIOR (0.60)` applies to all new capabilities equally. A better model would expand confidence as observations accumulate.

**Recommendation:** Implement Wilson score interval or Beta distribution prior: new capabilities start at 0.60 with wide confidence interval; each observed run tightens the estimate toward the true success rate.

---

### R4 — Strict mode for budget-risk violations (LOW)

**Issue:** Budget conflicts are now reported but silently corrected. Some teams may prefer hard rejection in production environments.

**Recommendation:** Add an optional `strict: boolean` flag to `routeTask()`. When `strict: true`, return an error instead of auto-correcting the budget when a conflict is detected.

---

## Test Coverage Plan

### Priority 1 — cover fixed behaviours (should be added now)

| Test | Target file |
|---|---|
| `routeTask` returns structured error (not throw) for null task | `tests/orchestration/router.test.js` |
| `routeTask` returns structured error for invalid risk value | `tests/orchestration/router.test.js` |
| `routeTask` returns structured error for empty registry | `tests/orchestration/router.test.js` |
| `routeTask` returns structured error for invalid budget tier | `tests/orchestration/router.test.js` |
| Equal `totalScore` resolves by deterministic secondary keys (not registry order) | `tests/orchestration/router.test.js` |
| Registry order permutation: same task produces same winner | `tests/orchestration/router.test.js` |
| Domain-mismatched candidate cannot outscore domain-matched candidate | `tests/orchestration/router.test.js` |
| `needsClarification: true` when `scoreGap < NEAR_TIE_THRESHOLD` | `tests/orchestration/router.test.js` |
| `budgetConflicts` present in response when LOW budget + HIGH risk | `tests/orchestration/router.test.js` |
| `agentCapWarning` present when > `MAX_COMPOUND_AGENTS` domains detected | `tests/orchestration/compound-routing.test.js` |
| `DEFAULT_LEARNING_PRIOR (0.60)` used for unknown capability | `tests/orchestration/router.test.js` |

### Priority 2 — regression and calibration

| Test | Target file |
|---|---|
| `COST_OVERRUN_PENALTY` and `LATENCY_OVERRUN_PENALTY` produce expected scores | `tests/orchestration/router.test.js` |
| All 5 domain specialists route correctly end-to-end | `tests/orchestration/router.test.js` |
| Response contract fields are backward-compatible (no missing keys) | `tests/orchestration/router.test.js` |

---

## Scoring Reference

### Score floor comparison (domain weight = 0.35)

| Condition | Domain score | Max possible total |
|---|---:|---:|
| Exact domain match | 1.00 | 1.000 |
| General domain | 0.70 | 0.965 |
| Mismatch (fixed) | 0.05 | 0.668 |
| Mismatch (pre-fix) | 0.20 | 0.738 |

The fixed mismatch floor (0.05) ensures that even a perfect-quality mismatched agent (`0.668`) cannot beat a mediocre domain-matched agent (floor `~0.865`).

### Cost / latency fitness examples

Budget tier = MEDIUM (2), penalty = `1 - delta × OVERRUN_PENALTY`:

| Capability tier | Cost score | Latency score |
|---|---:|---:|
| LOW (1) — under budget | 1.00 | 1.00 |
| MEDIUM (2) — at budget | 1.00 | 1.00 |
| HIGH (3) — 1 tier over | 0.55 | 0.60 |

---

## Related References

- [src/orchestration/router.js](../src/orchestration/router.js) — Primary implementation
- [src/orchestration/capability-registry.js](../src/orchestration/capability-registry.js) — Candidate filtering
- [src/orchestration/default-capability-registry.js](../src/orchestration/default-capability-registry.js) — Agent definitions
- [docs/AGENT_ORCHESTRATION.md](AGENT_ORCHESTRATION.md) — High-level orchestration design
- [docs/SPECIALIST_FALLBACK_CHAIN.md](SPECIALIST_FALLBACK_CHAIN.md) — Fallback chain policy
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — Full system architecture
- [tests/orchestration/](../tests/orchestration/) — Existing test suite
