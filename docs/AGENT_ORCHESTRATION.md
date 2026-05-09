---
title: Agent Orchestration Model
description: Visual and textual guide to AIEP specialist routing, delegation, and fallback chains
updated: 2026-05-09
load_when: understanding agent roles, routing decisions, collaboration patterns
---

# Agent Orchestration Model

> Comprehensive guide to the AIEP specialist agent router, deterministic scoring, peer collaboration, and fallback chains.

---

## Quick Reference: Agent Roster

All 8 routing-system agents in AIEP (Router + 7 specialists), with their primary domain, risk ceiling, and typical use case.

| # | Agent | Domain | Risk Ceiling | Token Tier | When to Use |
|---|---|---|---|---|---|
| 1 | **Router** | Orchestration | LOW–HIGH | Any | Entry point; deterministic specialist selection |
| 2 | **Context Planner** | Planning & Discovery | LOW | Any | Pre-execution analysis, risk scoping, context loading |
| 3 | **Code Reviewer** | Quality & Validation | LOW–MEDIUM | Low–Med | Review-first, bugs, regressions, test coverage |
| 4 | **Implementation Guardian** | Safe Implementation | MEDIUM–HIGH | Any | Coding, refactoring, architecture constraint checking |
| 5 | **Senior Backend** | APIs & Services | MEDIUM–HIGH | Medium–Prem | Endpoint design, domain logic, data handling |
| 6 | **Senior Frontend** | React/TS UI | MEDIUM–HIGH | Medium–Prem | Component design, state, rendering, accessibility |
| 7 | **Senior UI/UX** | Interaction Design | MEDIUM | Low–Med | User journeys, interaction quality, design systems |
| 8 | **Senior SRE** | Reliability & Ops | MEDIUM–HIGH | Medium–Prem | Observability, incident readiness, SLI/SLO, release safety |

---

## Visual: Routing Flow

Request enters the router, which scores all eligible candidates and selects the primary specialist. The specialist executes (may invoke one peer if needed), passes verification gate, and returns consolidated result. If verification fails, fallback chain activates.

**See also (Mermaid source):** [AGENT_ORCHESTRATION_FLOW.md](AGENT_ORCHESTRATION_FLOW.md) for the detailed routing flowchart and decision rules.

---

## Visual: Capability Matrix

All 8 agents, their domains, risk ceilings, token tier fit, and collaboration patterns at a glance.

**See also (Mermaid source):** [AGENT_CAPABILITY_MATRIX.md](AGENT_CAPABILITY_MATRIX.md) for the capability table and routing decision tree.

---

## Visual: Fallback & Collaboration

Specialist execution flow with peer invocation (single-hop) and fallback chain activation on verification failure.

**See also (Mermaid source):** [SPECIALIST_FALLBACK_CHAIN.md](SPECIALIST_FALLBACK_CHAIN.md) for fallback patterns by specialist type.

Canonical diagrams are stored as Mermaid source in these files; SVG exports are optional artifacts.

---

## Detailed Routing Rules

### 18 Deterministic Routing Rules

Extracted from [.github/agents/aiep-senior-staff-router.agent.md](.github/agents/aiep-senior-staff-router.agent.md):

1. **Context Planner** selected when request is planning-first, risk-scoping, or context-loading strategy before coding
2. **Code Reviewer** selected when request is review-first (bugs, regressions, risks, missing tests)
3. **Frontend** selected for React/TypeScript UI architecture, state, rendering, and accessibility implementation
4. **Backend** selected for API contracts, domain logic, data handling, and service behavior
5. **UI/UX** selected for user journeys, interaction quality, information hierarchy, and accessibility UX
6. **SRE** selected for reliability, incident response, observability, SLI/SLO, release safety, operational checks
7. **Implementation Guardian** selected when task is operational/SRE in nature but requires file edits (not pure SRE)
8. **SRE routing kept** for read/execute audits, diagnostics, and readiness checks with no file edits
9. **Exactly one primary specialist** selected per run
10. **Confidence check:** If confidence < 70%, ask one concise clarifying question before routing
11. **Deterministic scoring inputs** in order: domain-fit → quality → historical success → token budget fit → latency budget fit
12. **Fallback specialist** provided whenever more than one candidate is eligible
13. **Single-hop peer invocation:** Primary specialist may invoke exactly ONE peer when cross-domain dependency blocks completion
14. **No chains:** Peer invocation is single-hop only (no chains, no circular handoffs)
15. **Primary owns output:** Primary responsible for final integration and one consolidated response
16. **Multiple peer check:** If multiple peer specialties needed, stop and ask for human confirmation before expanding scope
17. **Context Planner valid peer:** For any primary specialist when planning/context needed
18. **Code Reviewer valid peer:** For any primary specialist when quality gate needed

### Routing Decision: Which Agent for Your Task?

| Task Type | Select | Rationale |
|---|---|---|
| "Help me plan this refactor before coding" | Context Planner | Pre-execution analysis, risk scoping |
| "Review this code for bugs and security" | Code Reviewer | Review-first, quality gate |
| "Build a React component for [feature]" | Senior Frontend | React/TS UI implementation |
| "Design an API endpoint for [domain]" | Senior Backend | API contract, domain logic |
| "Improve the UX flow for [journey]" | Senior UI/UX | Interaction design, user experience |
| "Refactor this service safely" | Implementation Guardian | Safe coding, architecture checking |
| "Is our deployment ready?" | Senior SRE | Operational readiness, observability |
| "I'm not sure which specialist" | Router | Deterministic selection by domain+risk+budget |

---

## Specialist Reference Directory

| Agent | File | Quick Description |
|---|---|---|
| **Router** | [.github/agents/aiep-senior-staff-router.agent.md](.github/agents/aiep-senior-staff-router.agent.md) | Deterministic routing controller; selects one primary specialist using multi-factor scoring and fallback chain |
| **Context Planner** | [.github/agents/aiep-context-planner.agent.md](.github/agents/aiep-context-planner.agent.md) | Pre-execution planning; risk assessment, mandatory context loading, multi-step execution plan generation |
| **Code Reviewer** | [.github/agents/aiep-code-reviewer.agent.md](.github/agents/aiep-code-reviewer.agent.md) | Quality-first review; security audit, test coverage, contract validation, findings-first output |
| **Implementation Guardian** | [.github/agents/aiep-implementation-guardian.agent.md](.github/agents/aiep-implementation-guardian.agent.md) | Safe coding and refactoring; architecture constraint checking, explicit error handling, mandatory tests |
| **Senior Backend** | [.github/agents/aiep-senior-staff-backend.agent.md](.github/agents/aiep-senior-staff-backend.agent.md) | API design and services; API contracts, domain business logic, data handling, database patterns, tests |
| **Senior Frontend** | [.github/agents/aiep-senior-staff-frontend.agent.md](.github/agents/aiep-senior-staff-frontend.agent.md) | React/TS UI implementation; component architecture, state management, accessibility, performance, tests |
| **Senior UI/UX** | [.github/agents/aiep-senior-staff-ui-ux.agent.md](.github/agents/aiep-senior-staff-ui-ux.agent.md) | Interaction design; user journeys, accessibility UX quality, design systems, information hierarchy |
| **Senior SRE** | [.github/agents/aiep-senior-staff-sre.agent.md](.github/agents/aiep-senior-staff-sre.agent.md) | Reliability and operations; observability checks, incident readiness, SLI/SLO validation, release safety |

---

## Collaboration Patterns

### Single-Hop Peer Invocation

Primary specialists may invoke exactly ONE peer specialist when a cross-domain blocker prevents completion.

**Valid peer invocation pairs:**
- Implementation Guardian → Senior Backend (API contract clarification)
- Implementation Guardian → Senior Frontend (component integration)
- Senior Frontend → Senior UI/UX (accessibility/interaction design)
- Senior Backend → Code Reviewer (quality gate)
- Senior Frontend → Code Reviewer (quality gate)
- Any specialist → Context Planner (context reload)
- Any specialist → Code Reviewer (security/quality validation)

**Not allowed:**
- Chains (A → B → C)
- Circular dependencies (A → B → A)
- Multiple simultaneous peers
- SRE → file edits (use Implementation Guardian)

### Fallback Chain Activation

Automatically activated when primary specialist's verification gate fails. Router pre-computes fallback candidates at routing time.

**When fallback activates:**
1. Verification gate fails (security, contract, test coverage)
2. Primary specialist cannot complete task
3. Confidence drops below acceptable threshold

**Fallback candidates pre-selected by:**
- Domain similarity
- Historical success rate
- Risk ceiling fit
- Token budget fit

---

## FAQ: Common Questions

### Q: When is Context Planner selected vs. Router invoked?

**Context Planner selected when:** Task is explicitly about planning, risk scoping, or pre-execution context loading before implementation.

**Router invoked when:** You provide a general task description without strong planning signals. Router then selects appropriate specialist (may be Context Planner if planning detected, or another specialist for implementation).

**Best practice:** Use Router for most requests unless you know you need planning first.

### Q: Can agents call each other (peer invocation)?

**Yes, with constraints:**
- **Single-hop only:** Primary may invoke exactly ONE peer
- **Cross-domain blocker required:** Peer invocation happens only when primary needs specialized knowledge outside their domain
- **No chains:** Peer cannot invoke another peer
- **Primary owns integration:** Primary responsible for final consolidated output

### Q: What happens if the primary specialist fails?

1. **Verification gate runs** after primary completes
2. **Gate fails:** Fallback chain activates
3. **Fallback specialist selected:** Pre-computed 2nd or 3rd choice from router
4. **Fallback executes full task:** With fresh context, attempting same task with different specialist
5. **Result returned:** Consolidated output with fallback trace

### Q: Which specialist handles my use case?

**Start here:**
1. What's the task domain? (Frontend UI, Backend API, UX design, etc.)
2. What's the risk level? (LOW, MEDIUM, HIGH)
3. What's the token budget? (Low, Medium, Premium)

Then match to specialist risk ceiling and token tier. Or use Router for automatic selection.

### Q: Can I request a specific specialist directly?

**Yes, but not recommended:**
- Router's deterministic scoring often selects better-fit specialist than requested
- Direct specialist request skips scoring optimization
- Fallback chain not available (no routing)

**When direct request is OK:** You have deep domain knowledge and know exactly which specialist you need.

### Q: How does token budget affect routing?

**Low budget (< 1K tokens):** Router limits to Context Planner, Code Reviewer, Senior UI/UX

**Medium budget (1K–5K tokens):** Router includes Backend, Frontend, Implementation Guardian

**High budget (5K+ tokens):** All specialists eligible; Router scores all 8 candidates

**Premium budget (explicit approval):** Same as high, but with CRITICAL-risk work allowed

### Q: What's the difference between Implementation Guardian and domain specialists?

| Aspect | Implementation Guardian | Domain Specialist (Backend/Frontend) |
|---|---|---|
| **When to use** | Cross-cutting refactoring, safe coding focus | Domain-specific implementation (APIs, UI, etc.) |
| **Risk handling** | Explicit error handling, constraint checking | Domain-specific patterns and contracts |
| **Can invoke peers?** | Yes (Backend, Frontend, Code Reviewer) | Limited (mostly Code Reviewer) |
| **Best for** | "Make this safe and testable" | "Build this feature correctly" |

---

## ASCII Reference (Terminal Viewing)

For viewing in CI/CD environments, terminal windows, or offline documentation.

```
================================================================================
                    AIEP AGENT ORCHESTRATION REFERENCE
================================================================================

REQUEST ROUTING FLOW:
─────────────────────
         ┌─ Context Planner    (Planning & Discovery)
         │
Request ─┼─ Code Reviewer      (Quality & Validation)
         │
         ├─ Implementation Guardian (Safe Implementation)
         │
         ├─ Senior Backend     (APIs & Services)
         │
Router   ├─ Senior Frontend    (React/TS UI)
(Scoring)├─
         ├─ Senior UI/UX       (Interaction Design)
         │
         └─ Senior SRE         (Reliability & Ops)

DETERMINISTIC SCORING (in order):
─────────────────────────────────
1. Domain fit         (Is this specialist suited for this domain?)
2. Quality fit        (Does this task require quality validation?)
3. Historical success (Has this specialist succeeded on similar tasks?)
4. Token budget fit   (Is this specialist within token budget tier?)
5. Latency budget fit (Can this specialist meet latency requirements?)

SPECIALIST RISK CEILINGS:
────────────────────────
Context Planner ............ LOW      (planning only)
Code Reviewer .............. LOW-MED  (review & quality gates)
Senior UI/UX ............... MEDIUM   (design & interaction)
Implementation Guardian .... MED-HIGH (coding & refactoring)
Senior Backend ............. MED-HIGH (APIs & services)
Senior Frontend ............ MED-HIGH (React/TS UI)
Senior SRE ................. MED-HIGH (reliability & ops)
Router ..................... LOW-HIGH (orchestration only)

PEER INVOCATION (Single-Hop Only):
──────────────────────────────────
Impl Guardian ──┐
                ├─→ Senior Backend     (API contract clarification)
                ├─→ Senior Frontend    (component integration)
                └─→ Code Reviewer      (quality gate)

Senior Frontend ───┐
                   ├─→ Senior UI/UX    (UX/interaction guidance)
                   └─→ Code Reviewer   (quality gate)

Senior Backend ────→ Code Reviewer     (quality/security gate)

FALLBACK CHAIN:
───────────────
Primary Specialist ──┐
                     ├─ Verification Gate
                     │
                     └─ If fails: Fallback #1 ──┐
                                                ├─ Verification Gate
                                                │
                                                └─ If fails: Fallback #2

COLLABORATION RULES:
────────────────────
✓ Single primary specialist per request
✓ Primary may invoke AT MOST 1 peer specialist
✓ Peer invocation is single-hop only (no chains)
✓ Primary owns final consolidated output
✓ Fallback chain pre-computed at routing time
✗ No circular dependencies
✗ No multiple simultaneous peers
✗ Peer cannot invoke another peer

QUICK REFERENCE:
────────────────
Planning before code? ........ → Context Planner
Review/quality gate? ......... → Code Reviewer
React/TS UI work? ............ → Senior Frontend
Backend/API work? ............ → Senior Backend
UX/interaction work? ......... → Senior UI/UX
Refactoring/safe coding? ..... → Implementation Guardian
Reliability/ops work? ........ → Senior SRE
Not sure? .................... → Router (automatic selection)

================================================================================
```

---

## See Also

- [AGENT_ORCHESTRATION_FLOW.md](AGENT_ORCHESTRATION_FLOW.md) — Detailed routing flowchart
- [AGENT_CAPABILITY_MATRIX.md](AGENT_CAPABILITY_MATRIX.md) — Capability table and decision tree
- [SPECIALIST_FALLBACK_CHAIN.md](SPECIALIST_FALLBACK_CHAIN.md) — Fallback patterns by specialist
- [.github/agents/README.md](.github/agents/README.md) — Agent roster and collaboration guide
- [AGENT_GUIDE.md](../AGENT_GUIDE.md) — Prompt examples and use cases
- [.github/agents/aiep-senior-staff-router.agent.md](.github/agents/aiep-senior-staff-router.agent.md) — Router implementation
- [.github/instructions/aiep-skill-orchestration.instructions.md](.github/instructions/aiep-skill-orchestration.instructions.md) — Skill orchestration rules

---

**Last updated:** 2026-05-09  
**Status:** Comprehensive orchestration documentation ready for onboarding and operational reference
