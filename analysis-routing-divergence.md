# Routing Divergence Analysis: Frontend Engineer vs UI/UX Engineer

## Executive Summary
The orchestrator's `processRequest()` selects `AIEP Senior Staff UI/UX Engineer` while direct `routeTask()` selects `AIEP Senior Staff Frontend Engineer` for a LOW-risk frontend task. The divergence stems from **budget tier downgrade** applied by the orchestrator's policy engine.

## Detailed Findings

### Direct routeTask() Call
**Input:**
- Task: `{ domain: 'frontend', risk: 'LOW', description: '...' }`
- Budget: `{ tokenBudgetTier: 'STANDARD', latencyBudgetTier: 'NORMAL' }`

**Output:**
```
Frontend Engineer:   0.9325  ← SELECTED
UI/UX Engineer:     0.925
Architect:          0.835
```

### Orchestrator processRequest() Call  
**Input:**
- Task: `{ domain: 'frontend', risk: 'LOW', description: '...' }`
- Budget: `{ tokenBudgetTier: 'STANDARD', latencyBudgetTier: 'NORMAL' }`

**Internal Transformation (Before Routing):**
```
budgetDecision.effectiveTier: 'LOW'  (downgraded from STANDARD)
modelTierDecision.tier: 'LOW'        (from p4-tiering-policy-v1)
```

**Output:**
```
UI/UX Engineer:     0.925   ← SELECTED (different!)
Frontend Engineer:  0.8785  (score dropped from 0.9325 to 0.8785)
Architect:          0.835
```

## Root Cause: Cost Fitness Scoring

The router applies **cost-based penalty** based on budget tier:

```javascript
function scoreCostFitness(tokenBudgetTier, capabilityTier) {
  const budget = COST_WEIGHTS[tokenBudgetTier];      // 1=LOW, 2=MEDIUM, 3=HIGH
  const cost = COST_WEIGHTS[capabilityTier];
  if (cost <= budget) return 1.0;
  const delta = cost - budget;
  return clamp(1 - delta * 0.45, 0, 1);  // Apply 0.45 penalty per tier
}
```

**Scenario A: STANDARD → MEDIUM (weight=2)**
- Frontend Engineer (high-cost, tier=HIGH=3): `1 - (3-2)*0.45 = 0.55 penalty`
- UI/UX Engineer (lower-cost, tier=MEDIUM=2): `no penalty (1.0)`
- Result: Frontend advantage (0.9325 > 0.925) ✓

**Scenario B: LOW (weight=1)** (after orchestrator downgrade)
- Frontend Engineer (tier=HIGH=3): `1 - (3-1)*0.45 = 0.10 penalty` → drops to 0.8785
- UI/UX Engineer (tier=MEDIUM=2): `1 - (2-1)*0.45 = 0.55 penalty`
- Result: UI/UX advantage (0.925 > 0.8785) ✗

## Why the Budget Downgrade?

The orchestrator applies:
1. **Token budget allocator**: `budgetDecision.effectiveTier = 'LOW'`
   - Reason: `WITHIN_LIMITS` at `effectiveTier: 'LOW'`
   - Allocates 650 tokens for routing step
   
2. **Model tiering policy** (`p4-tiering-policy-v1`):
   - `tier: 'LOW'` 
   - Reasons: `["step_default:routing", "risk_guardrail:low"]`

This tier downgrade is **not applied** in the direct `routeTask()` call, which receives unmodified budget tier.

## The Problem

The orchestrator's policy-based tier downgrade changes the effective scoring, which:
- ✓ Ensures cost compliance at token budget limits
- ✗ **But changes which agent is selected**, violating routing determinism
- ✗ Frontend Engineer becomes a **fallback** after verification fails, rather than primary selection

## Evidence

**Verification failure:**
```
Orchestrator verification.pass: false
Orchestrator fallbackSelection: {
  specialistId: 'AIEP Senior Staff Frontend Engineer',
  reason: 'verification_failed'
}
```

The orchestrator:
1. Routes to UI/UX Engineer (due to LOW tier penalty)
2. Verification fails on that selection
3. Falls back to Frontend Engineer (from fallback chain)
4. Returns Frontend Engineer as `fallbackSelection` but UI/UX Engineer as `selectedAgent`

This is confusing UX and operational inconsistency.

## Recommendations

1. **Alignment:** Budget tier downgrades should be visible/documented in routing decision
2. **Determinism:** Consider whether policy-driven tier changes should be applied *after* routing or *before*
3. **Verification:** Investigate why Frontend Engineer fails verification while UI/UX Engineer also fails
4. **Configuration:** Re-evaluate `p4-tiering-policy-v1` tier assignment for LOW-risk frontend routing


---

## Secondary Finding: Verification Design Issue

The `processRequest()` method has an optional `executionEvidence` parameter:

```typescript
async processRequest({ 
  requestId, task, budget, confirmation = false, 
  executionEvidence,  // ← Optional parameter, undefined if not provided
  runtimeEnvironment = "development" 
})
```

When called **without execution evidence** (typical for routing-only scenarios), the verifier fails:

```javascript
if (!verification) {
  verification = verifyExecution(executionEvidence);  // executionEvidence is undefined
  // ...
}
```

**Result:**
```javascript
verifyExecution(undefined) → {
  pass: false,
  findings: [{
    severity: "HIGH",
    code: "NO_EVIDENCE",
    message: "No execution evidence was provided for verification."
  }]
}
```

### Impact

1. **Routing-only calls fail verification** even though they should succeed
2. **Selected agent (UI/UX Engineer) fails verification** → triggers fallback
3. **Returns UI/UX Engineer as `selectedAgent`** but **Frontend Engineer as `fallbackSelection`** (confusing UX)
4. **Returns `ok: false`** even though routing succeeded and fallback was applied

### Why This Matters

The orchestrator response indicates failure (`ok: false`) when it actually succeeded in selecting an agent (via fallback). This breaks caller expectations and makes it unclear whether the request was truly successful.

---

## Combined Root Causes Summary

| Issue | Impact | Severity |
|-------|--------|----------|
| **Budget tier downgrade** (STANDARD → LOW) | Changes routing scores; flips agent selection | **HIGH** |
| **Missing execution evidence** | Causes verification to fail even for routing-only calls | **HIGH** |
| **Confusing response structure** | `ok: false` + `fallbackSelection` is ambiguous | **MEDIUM** |

---

## Next Steps

1. **Decide verification semantics:** Should routing-only (no execution) verification pass or fail?
   - Option A: Skip verification if no evidence provided
   - Option B: Only verify when evidence is explicitly provided
   - Option C: Create separate "routing verification" vs. "execution verification"

2. **Document budget tier changes:** Make tier downgrades visible in routing output

3. **Align response semantics:** Clarify when `ok=true` vs. `ok=false` + successful `fallbackSelection`

