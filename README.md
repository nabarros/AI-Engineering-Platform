# AI Engineering Platform

> Agent orchestration platform for building, routing, validating, and operating AI-powered engineering workflows with deterministic behavior.

[![Node 20+](https://img.shields.io/badge/Node-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-81%20cases-16a34a?style=for-the-badge)](./tests/orchestration)
[![Orchestration](https://img.shields.io/badge/Agent-Orchestration-2563eb?style=for-the-badge)](./src/orchestration)
[![Security Guardrails](https://img.shields.io/badge/Security-Guardrails-f97316?style=for-the-badge)](./docs/SECURITY_RULES.md)
[![P0–P4 Implemented](https://img.shields.io/badge/Roadmap-P0–P4%20Implemented-7c3aed?style=for-the-badge)](./docs/reports/aiep_sustainable_implementation_roadmap.md)

## Quick Navigation

- [Start Here: VS Code + GitHub Copilot Setup](#start-here-vs-code--github-copilot-setup)
- [Quick Start](#quick-start)
- [API Demo in 30 Seconds](#api-demo-in-30-seconds)
- [Agent Specialist Orchestration](#agent-specialist-orchestration)
- [Documentation](#documentation)
- [Contributing](#contributing)

## Start Here: VS Code + GitHub Copilot Setup

Follow the full setup guide first:

- [VS Code + GitHub Copilot Setup Guide](./docs/VSCODE_COPILOT_SETUP.md)

### Use the Router Agent in VS Code

After setup, use GitHub Copilot Chat with the router entrypoint to route, validate, and execute tasks safely.

### Step-by-Step: First Task in VS Code

1. Open the AI-Engineering-Platform workspace in VS Code.
2. Open GitHub Copilot Chat in the editor.
3. Submit a router prompt to the AIEP Senior Staff Router.
4. In the same prompt, include domain, risk level, and acceptance criteria.
5. For high-risk tasks, include explicit approval before execution.
6. Review the response for specialist selection, fallback chain, and verification summary.
7. Send a follow-up prompt to refine scope, address findings, or request updates.
8. Use [AGENT_GUIDE.md](./AGENT_GUIDE.md) and [docs/AGENT_ORCHESTRATION.md](./docs/AGENT_ORCHESTRATION.md) for routing and lifecycle details.

### Step-by-Step: Using Memory Effectively

1. Start by asking the router to load relevant context and memory for your task.
2. State task and scope explicitly so retrieval stays intent-aware.
3. Ask the agent to consult [.ai/memory/current-architecture.md](./.ai/memory/current-architecture.md) before design changes.
4. Ask it to check [.ai/memory/active-work.md](./.ai/memory/active-work.md) before touching in-flight areas.
5. Ask it to check [.ai/memory/known-issues.md](./.ai/memory/known-issues.md) before debugging or fixes.
6. Ask for a short memory-based assumptions summary before implementation.
7. Ask for memory-sync recommendations at the end, without writing memory files unless explicitly confirmed.

### Step-by-Step: Add Skills to Agents

1. Identify the application topic and choose the primary specialist agent for execution.
2. Choose the right domain skill from [.ai/skills/](./.ai/skills/): api-design, react-patterns, database-patterns, auth-patterns, refactoring-rules, testing-jest, debugging-node, migration-strategy, performance-optimization.
3. Add or update reusable orchestration skills in [.github/skills/](./.github/skills/) when shared execution behavior is required.
4. Update specialist agent files in [.github/agents/](./.github/agents/) to reflect orchestration and domain-loading expectations.
5. If routing criteria changed, update Domain Skill Mapping and routing rules in [.github/agents/aiep-senior-staff-router.agent.md](./.github/agents/aiep-senior-staff-router.agent.md).
6. Prevent duplication drift by centralizing full sequencing in [.github/instructions/aiep-skill-orchestration.instructions.md](./.github/instructions/aiep-skill-orchestration.instructions.md).
7. Test with a router prompt and verify selected specialist, fallback chain, and verification output.
8. For state-changing outcomes, request memory-sync recommendations; do not write .ai/memory/** without explicit human confirmation.

### Application Topics: Agent + Skill Map

| Topic | Primary Agent | Domain Skills (.ai/skills) | Orchestration Skills (.github/skills) |
|---|---|---|---|
| Planning and scoping | AIEP Context Planner | refactoring-rules, migration-strategy | aiep-context-bootstrap, aiep-safe-implementation |
| Backend API development | AIEP Senior Staff Backend | api-design, testing-jest | aiep-context-bootstrap, aiep-senior-staff-backend, aiep-safe-implementation |
| Backend data and persistence | AIEP Senior Staff Backend | database-patterns, testing-jest, performance-optimization | aiep-context-bootstrap, aiep-senior-staff-backend, aiep-safe-implementation |
| Frontend UI and state | AIEP Senior Staff Frontend | react-patterns, testing-jest, performance-optimization | aiep-context-bootstrap, aiep-senior-staff-frontend, aiep-safe-implementation |
| UX and accessibility | AIEP Senior Staff UI/UX | react-patterns, testing-jest | aiep-context-bootstrap, aiep-senior-staff-ui-ux, aiep-safe-implementation |
| Reliability and operations | AIEP Senior Staff SRE | debugging-node, performance-optimization | aiep-context-bootstrap, aiep-senior-staff-sre, aiep-pr-readiness |
| Security and auth-sensitive changes | AIEP Senior Staff Backend | auth-patterns, api-design, testing-jest | aiep-context-bootstrap, aiep-senior-staff-backend, aiep-pr-readiness |
| Refactoring and modernization | AIEP Implementation Guardian | refactoring-rules, migration-strategy, testing-jest | aiep-context-bootstrap, aiep-safe-implementation, aiep-pr-readiness |
| Testing and quality gates | AIEP Code Reviewer | testing-jest | aiep-context-bootstrap, aiep-pr-readiness |
| Debugging and incident fixes | AIEP Implementation Guardian | debugging-node, testing-jest | aiep-context-bootstrap, aiep-safe-implementation, aiep-pr-readiness |
| Migration work | AIEP Senior Staff Backend | migration-strategy, database-patterns, api-design | aiep-context-bootstrap, aiep-senior-staff-backend, aiep-safe-implementation |
| Performance and cost optimization | AIEP Senior Staff SRE | performance-optimization, debugging-node | aiep-context-bootstrap, aiep-senior-staff-sre, aiep-pr-readiness |
| Memory-aware implementation | AIEP Senior Staff Router | refactoring-rules, debugging-node | aiep-context-bootstrap, aiep-safe-implementation, aiep-memory-sync |

### Memory- and Skill-Aware Prompt Example

```text
Use AIEP Senior Staff Router for a backend API task to tighten request validation and error handling.
Before implementation, load relevant context and memory from .ai/memory/current-architecture.md, .ai/memory/active-work.md, and .ai/memory/known-issues.md.
Apply .ai/skills/api-design.md and .ai/skills/testing-jest.md, then follow orchestration via .github/instructions/aiep-skill-orchestration.instructions.md.
Return selected specialist, fallback chain, verification summary, and memory-sync recommendations only.
```

If you prefer API usage, jump to the Quick Start and API Demo sections below.

Copy-paste prompt examples:

\`\`\`text
Use AIEP Senior Staff Router to implement a backend endpoint for prompt version comparison.
Requirements:
- Add tests for success and failure paths
- Apply security and API conventions
- Run verification before final response
High-risk changes are approved.
\`\`\`

\`\`\`text
Use AIEP Senior Staff Router to build a frontend settings panel for model routing.
Requirements:
- Accessibility checks
- Loading/error states
- Unit tests
- Findings-first validation summary
\`\`\`

What happens automatically:

- Router classifies intent and risk.
- Router selects one primary specialist with deterministic scoring.
- Router attaches fallback chain metadata.
- Guardrails and policy checks run before execution.
- Token budget and model tier are resolved before specialist execution.
- Memory retrieval plan is built from layered context before execution.
- Verification gate runs before final response.
- Memory and tuning signals are updated for future routing quality.

---

## Repository Description and Purpose

AI Engineering Platform (AIEP) is an agent orchestration tool and engineering control plane.

Its purpose is to provide one governed system where AI agents can:

- Route work to the best specialist using deterministic scoring and fallback
- Execute tasks with policy gates, verification, and test-first quality checks
- Share memory across sessions and tenants with explicit safety boundaries using a layered memory contract
- Retrieve context deterministically through an intent-aware retrieval planner and graph-indexed state
- Optimize cost and latency through budget-aware routing, model tiering, adaptive tuning, and a response cache
- Forecast and attribute token spend per team with anomaly detection and quarterly ROI reviews
- Produce auditable traces for every orchestration decision

In short, AIEP turns autonomous AI execution into a production engineering discipline: fast, measurable, secure, and reproducible.

Core P0–P4 capabilities are implemented; selected features remain in controlled rollout. See [Roadmap](./docs/reports/aiep_sustainable_implementation_roadmap.md) and [Reports](./docs/reports/) for full audit trail.

---

## Why Teams Use AIEP

- Faster delivery without sacrificing governance
- Deterministic routing instead of ad-hoc agent selection
- Built-in quality gate before response completion
- Native cost and latency control through budget-aware orchestration and model tiering
- Intent-aware memory retrieval with graph-indexed shared state
- Token spend attribution and anomaly detection per team
- Explainable traces for every decision path

---

## What AIEP Does

One runtime gives your team a governed orchestration layer where agents do not just answer, they coordinate.

\`\`\`text
Engineer -> Router -> Token Budget + Model Tier -> Specialist Agent -> Verification Gate -> Memory + Learning -> Metrics
                    |                                                                            ^
                    +------------------------------------------- Fallback Chain ----------------+
\`\`\`

---

## Architecture: Full Orchestration Stack

\`\`\`mermaid
flowchart TD
  user([Engineer / API Client]) --> api[Orchestration API]
  api --> guard{Auth + Tenant Scope\nRate Limit + Idempotency}
  guard --> router[Deterministic Router\nDomain · Risk · Quality · Cost · Latency Scoring]

  router --> budget[Token Budget Allocator\nALLOW / TRUNCATE / DOWNGRADE / BLOCK]
  budget --> tiering[Model Tiering Policy\nStep Type + Risk + Confidence Band]
  tiering --> cache{Response Cache\nPolicy-Version + Context Hash}

  subgraph Specialists[Specialist Pool]
    planner[Context Planner]
    reviewer[Code Reviewer]
    impl[Implementation Guardian]
    fe[Senior Frontend]
    be[Senior Backend]
    ux[Senior UI/UX]
    sre[Senior SRE]
  end

  cache -->|miss| Specialists
  cache -->|hit| verify

  router --> Specialists

  subgraph GraphExec[Concurrent Graph Engine]
    a[Task Node A]
    b[Task Node B]
    c[Task Node C]
    a --> b --> c
  end

  Specialists --> GraphExec

  subgraph MemoryStack[Memory & Retrieval Stack - P3]
    intent[Intent-Aware Retrieval Planner\nbugfix · feature · review · docs · general]
    layers[Layered Memory Contract\nSession · Task · Project · Domain · Global]
    graph[Graph-Indexed State\nrepository · component · skill · tenant]
    compact[Compaction + Archive]
    intent --> layers --> graph --> compact
  end

  GraphExec --> MemoryStack

  subgraph CostStack[Token Economics Stack - P4]
    forecaster[Token Forecaster\nHistorical Telemetry + Error Bounds]
    optimizer[Cost-Quality Optimizer\nGuardrail-Based Escalation + Downgrade]
    attribution[Spend Attribution\nPer-Team + Anomaly Detection]
    downgrade[Downgrade Policy\nLow-Risk + High-Volume + Rollback Switch]
    redteam[Red-Team Evaluation\nDeterministic Cost-Policy Scenarios]
  end

  GraphExec --> CostStack

  GraphExec --> verify{Verification Gate\nSecurity · Tests · Contracts · Error Handling}
  verify --> trace[Trace + Metrics]
  verify --> tuner[Adaptive Weight Tuner\nRolling Success + Cost + Latency Feedback]
  verify --> state[Shared Indexed State]

  state --> router
  tuner --> router
  trace --> api
\`\`\`

### Execution Model

- Router-first specialist selection with deterministic domain + risk + quality + cost + latency scoring
- Token budget resolved before specialist execution; blocks requests that would exceed tier limits
- Model tier resolved per step type, risk level, and confidence band; premium tier gated by policy
- Response cache checked by policy version and context hash before specialist invocation
- Intent-aware retrieval planner builds layered memory read plan before execution
- Fallback chain when primary specialist fails or is suboptimal
- Concurrent graph execution with dependency edges, timeout, and retry
- Verification gate (security, tests, contracts, error handling) before response completion
- Continuous learning loop updates routing weights from success, cost, and latency signals

---

## 60-Second Live Flow Preview

\`\`\`mermaid
sequenceDiagram
  participant U as User/Client
  participant API as Orchestration API
  participant R as Router
  participant B as Token Budget + Model Tier
  participant C as Response Cache
  participant S as Specialist
  participant V as Verification Gate
  participant M as Shared State + Tuner

  U->>API: POST /orchestrate
  API->>API: Auth + tenant + rate-limit + idempotency
  API->>R: Route by domain/risk/budget
  R->>B: Resolve token budget + model tier
  B->>C: Check response cache
  C-->>S: Cache miss — invoke specialist
  S->>V: Return execution evidence
  V->>M: Persist memory + update rolling metrics
  V-->>API: pass/fail + findings
  API-->>U: deterministic response + trace
\`\`\`

### Real API Walkthrough

\`\`\`bash
# 1) Start shared state + orchestration API
npm run start:shared-state-service
ORCHESTRATION_SHARED_STATE_URL=http://127.0.0.1:8790 npm run start:orchestration-api

# 2) Send one orchestration request
curl -s -X POST http://127.0.0.1:8787/orchestrate \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: demo-tenant" \
  -d '{
    "requestId": "go-to-market-001",
    "task": {"domain": "backend", "risk": "MEDIUM", "description": "Design and validate API behavior"},
    "budget": {"tokenBudgetTier": "LOW", "latencyBudgetTier": "MEDIUM"},
    "confirmation": true,
    "executionEvidence": {
      "testsPassed": true,
      "securityChecksPassed": true,
      "contractChecksPassed": true,
      "errorHandlingValidated": true,
      "qualityScore": 0.92,
      "tokenUsage": 1700,
      "latencyMs": 120
    }
  }' | jq
\`\`\`

---

## Agent Specialist Orchestration

The router selects one primary specialist per request using deterministic scoring across domain, risk, quality, cost, and latency.

**8 routing-system agents (Router + 7 specialists):**
- **Router** — Entry point and deterministic specialist selection
- **Context Planner** — Pre-execution planning, risk scoping, context loading
- **Code Reviewer** — Review-first, security audit, quality validation
- **Implementation Guardian** — Safe coding, refactoring, architecture constraints
- **Senior Backend** — API design, domain logic, database patterns
- **Senior Frontend** — React/TS UI, state management, accessibility
- **Senior UI/UX** — User journeys, interaction design, design systems
- **Senior SRE** — Observability, incident readiness, SLI/SLO, release safety

**How it works:**
1. Request routed by deterministic scoring (domain → quality → history → cost → latency)
2. Primary specialist executes (may invoke exactly one peer if cross-domain blocker)
3. Verification gate validates security, contracts, and test coverage
4. Fallback chain activates if verification fails
5. Consolidated result returned with routing trace

**Key facts:**
- **Deterministic routing** — No random specialist selection; explainable scores
- **Single primary** — One specialist per request; no overlapping work
- **Single-hop peer collaboration** — Primary may invoke one peer specialist if needed (e.g., Frontend → UX for accessibility guidance)
- **Fallback chain** — Pre-computed 2nd and 3rd choice specialists if primary fails
- **Budget-aware** — Token tier and latency budget determine eligible specialists
- **Verification mandatory** — All responses pass security, contract, and test gates

**See detailed routing logic and capability matrix:**
- [Agent Orchestration Diagram](docs/AGENT_ORCHESTRATION.md)
- [Agent Directory](.github/agents/README.md)
- [AGENT_GUIDE.md](AGENT_GUIDE.md) for prompt examples

---

## Without vs With AIEP

| Capability | Without AIEP | With AIEP |
|---|---|---|
| Agent Selection | Manual, inconsistent specialist choice | Deterministic routing with fallback chain |
| Guardrails | Ad-hoc checks | Built-in auth, tenant scope, rate-limit, idempotency |
| Quality Gate | Best-effort validation | Mandatory verification gate before final response |
| Coordination | Single linear flow | Concurrent dependency-aware graph orchestration |
| Memory | Ephemeral per-run context | Layered multi-tenant memory with intent-aware retrieval and graph indexing |
| Cost Control | Reactive token usage | Budget-aware routing + model tiering + adaptive weight tuning + spend attribution |
| Token Forecasting | None | Historical telemetry forecaster with validation error bounds |
| Spend Visibility | None | Per-team attribution with anomaly detection and quarterly ROI review |
| Response Caching | None | Policy-version and context-hash invalidating cache |
| Explainability | Hard to debug decisions | Traceable decision path and metrics per request |
| Red-Team Coverage | None | Deterministic cost-policy red-team scenario set |

---

## Troubleshooting (Top 5)

| Symptom | Likely Cause | Fix |
|---|---|---|
| \`401 Unauthorized\` on \`/orchestrate\` | Missing or invalid API credentials | Send valid \`x-api-key\` or \`Authorization: Bearer ...\` according to server auth configuration |
| \`403 TENANT_FORBIDDEN\` | Credential not allowed for tenant | Use an allowed \`x-tenant-id\` for that key or update key tenant scope |
| \`429 RATE_LIMITED\` | Per-principal or per-tenant rate limit exceeded | Retry after \`Retry-After\`, lower request burst, or adjust server rate-limit config |
| \`422 POLICY_BLOCKED\` | Risk/policy violation (for example high-risk without confirmation) | Set \`confirmation: true\` for approved high-risk operations and re-check task constraints |
| \`TOKEN_BUDGET_EXCEEDED\` | Request token usage would exceed tier limit | Lower \`tokenBudgetTier\` budget, reduce request scope, or use a \`LOW\` tier task split |
| Shared state not updating across instances | \`ORCHESTRATION_SHARED_STATE_URL\` missing or unreachable | Start shared state service and set \`ORCHESTRATION_SHARED_STATE_URL=http://127.0.0.1:8790\` in API process |

For deeper diagnostics, use:

- \`GET /health\`
- \`GET /weights\`
- \`GET /metrics\`

## Current Rollout Caveats

- \`agent_tool_use\` is in controlled rollout at 25%.
- \`semantic_cache\` is in controlled rollout at 50%.
- \`prompt_eval_auto\` is disabled in production (under development).

Source-of-truth status references:
- [current-architecture.md](./.ai/memory/current-architecture.md)
- [active-work.md](./.ai/memory/active-work.md)

---

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Run tests (suite includes 81 cases)
npm test

# Run orchestration benchmark (large corpus)
npm run benchmark:orchestration

# Run cross-priority benchmark (strict gate)
npm run benchmark:cross-priority

# Run runtime demo
npm run demo:router-runtime
\`\`\`

### Distributed Setup (Recommended)

\`\`\`bash
# Terminal 1: shared state service
npm run start:shared-state-service

# Terminal 2: orchestration API
ORCHESTRATION_SHARED_STATE_URL=http://127.0.0.1:8790 npm run start:orchestration-api
\`\`\`

### Report Generation

\`\`\`bash
# P3 Memory reports
npm run report:p3-memory-pilot

# P4 Token economics reports (all)
npm run report:p4-all

# Cross-priority benchmark
npm run report:cross-priority-benchmark
\`\`\`

---

## API Demo in 30 Seconds

### 1) Health check

\`\`\`bash
curl -s http://127.0.0.1:8787/health | jq
\`\`\`

### 2) Single-request orchestration

\`\`\`bash
curl -s -X POST http://127.0.0.1:8787/orchestrate \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: demo-tenant" \
  -d '{
    "requestId": "demo-001",
    "task": {
      "domain": "backend",
      "risk": "MEDIUM",
      "description": "Design and validate API changes"
    },
    "budget": {
      "tokenBudgetTier": "LOW",
      "latencyBudgetTier": "MEDIUM"
    },
    "confirmation": true,
    "executionEvidence": {
      "testsPassed": true,
      "securityChecksPassed": true,
      "contractChecksPassed": true,
      "errorHandlingValidated": true,
      "qualityScore": 0.92,
      "tokenUsage": 1800,
      "latencyMs": 130
    }
  }' | jq
\`\`\`

### 3) Concurrent graph orchestration

\`\`\`bash
curl -s -X POST http://127.0.0.1:8787/orchestrate-graph \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: demo-tenant" \
  -d '{
    "requestId": "graph-001",
    "maxConcurrency": 2,
    "nodes": [
      {
        "id": "n1",
        "agentId": "routing",
        "task": {"domain": "backend", "risk": "MEDIUM", "description": "Plan backend implementation"},
        "budget": {"tokenBudgetTier": "LOW", "latencyBudgetTier": "LOW"},
        "confirmation": true,
        "executionEvidence": {"testsPassed": true, "securityChecksPassed": true, "contractChecksPassed": true, "errorHandlingValidated": true, "qualityScore": 0.9}
      },
      {
        "id": "n2",
        "agentId": "routing",
        "task": {"domain": "review", "risk": "LOW", "description": "Review implementation plan"},
        "budget": {"tokenBudgetTier": "LOW", "latencyBudgetTier": "LOW"},
        "confirmation": true,
        "executionEvidence": {"testsPassed": true, "securityChecksPassed": true, "contractChecksPassed": true, "errorHandlingValidated": true, "qualityScore": 0.88}
      }
    ],
    "edges": [{"from": "n1", "to": "n2"}]
  }' | jq
\`\`\`

---

## What You Get

| Capability | Description |
|---|---|
| Deterministic Routing | Domain + risk + quality + cost + latency scoring |
| Fallback Chain | Automatic secondary specialist routing |
| Policy Guardrails | Auth, tenant isolation, rate limits, idempotency |
| Concurrent Graph Engine | Multi-node orchestration with dependencies, retries, timeouts |
| Layered Memory | Four-layer tenant-aware memory contract (session → global) |
| Intent-Aware Retrieval | Task-intent retrieval planner with graph-indexed state and precision gates |
| Memory Compaction | Archive and compact old memory layers with provenance metadata |
| Delegation Handoff | Typed memory handoff packets for cross-agent continuity |
| Model Tiering | Per-step model selection by risk + confidence band |
| Token Budget | Enforce tier token limits with ALLOW/TRUNCATE/DOWNGRADE/BLOCK actions |
| Token Forecaster | Historical telemetry forecaster with validation error bounds |
| Cost-Quality Optimizer | Guardrail-based optimizer with escalation and downgrade logic |
| Response Cache | Policy-version and context-hash invalidating cache |
| Spend Attribution | Per-team spend attribution with anomaly detection |
| Downgrade Policy | Automated low-risk/high-volume downgrade with rollback switch |
| Red-Team Evaluation | Deterministic cost-policy red-team scenario set |
| Adaptive Tuning | Rolling success/cost/latency feedback into routing weights |
| Verification Gate | Security, tests, contracts, and error-handling checks |
| Traceability | Decision path and execution checkpoints per request |
| Benchmarking | 243-scenario corpus + strict cross-priority benchmark suite |

---

## Core Endpoints

| Endpoint | Purpose |
|---|---|
| GET /health | Runtime health |
| GET /weights | Active routing weights + rolling metrics |
| GET /metrics | Quality dashboard + state index summary |
| POST /orchestrate | Single-request orchestration |
| POST /orchestrate-graph | Concurrent multi-node orchestration |

---

## Repository Layout

\`\`\`text
.ai/                         Governance, memory, domain skills
.github/                     Agents, prompts, skills, hooks
docs/                        Engineering and architecture reference docs
docs/reports/                Analysis reports, phase evidence, token economics reports
src/orchestration/           Routing, policy, memory, verifier, tuning, graph engine
  router.js                  Deterministic specialist router
  orchestrator.js            Core orchestration with P4 integrations
  memory-contract.js         Four-layer memory contract (P3)
  memory-store.js            Layered memory store with graph indexing (P3)
  retrieval-planner.js       Intent-aware retrieval planner (P3)
  retrieval-quality.js       Retrieval quality reporting with precision gates (P3)
  repository-graph.js        Graph-indexed state for components and skills (P3)
  memory-pilot-report.js     Memory-assisted pilot report with acceptance gates (P3)
  delegation-contracts.js    Delegation + memory handoff packet validation (P3)
  model-tiering-policy.js    Per-step model tier by risk + confidence band (P4)
  token-budget-allocator.js  Token budget enforcement by tier (P4)
  token-forecaster.js        Historical telemetry forecaster (P4)
  cost-quality-optimizer.js  Guardrail-based cost-quality optimizer (P4)
  response-cache.js          Policy-version + context-hash cache (P4)
  spend-attribution.js       Per-team spend attribution + anomaly detection (P4)
  downgrade-policy.js        Automated downgrade with rollback switch (P4)
  red-team-evaluation.js     Deterministic red-team cost-policy scenarios (P4)
  cross-priority-benchmark-report.js  Composed cross-priority benchmark (P3+P4)
src/api/                     Orchestration API and shared state service
scripts/                     Runtime utilities, report generators, launch scripts
tests/orchestration/         Orchestration test suite (81 defined test cases)
\`\`\`

---

## Documentation

### Core Reference

- [Architecture](./docs/ARCHITECTURE.md)
- [System Overview](./docs/SYSTEM_OVERVIEW.md)
- [API Conventions](./docs/API_CONVENTIONS.md)
- [Security Rules](./docs/SECURITY_RULES.md)
- [Testing Strategy](./docs/TESTING_STRATEGY.md)
- [Observability](./docs/OBSERVABILITY.md)
- [Engineering Standards](./docs/ENGINEERING_STANDARDS.md)
- [Error Handling](./docs/ERROR_HANDLING.md)
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)
- [Context Loading Strategy](./docs/CONTEXT_LOADING_STRATEGY.md)
- [Retrieval Strategy](./docs/RETRIEVAL_STRATEGY.md)

### Agent Governance and Skills

- [Agent Guide](./AGENT_GUIDE.md)
- [Copilot Instructions](./COPILOT_INSTRUCTIONS.md)
- [AIEP AI Bridge](./.github/instructions/aiep-ai-bridge.instructions.md)
- [Skill Orchestration Rules](./.github/instructions/aiep-skill-orchestration.instructions.md)
- [Senior Staff Router Agent](./.github/agents/aiep-senior-staff-router.agent.md)
- [Orchestration Runtime Skill](./.github/skills/aiep-agent-orchestration-runtime/SKILL.md)

### Memory and Decision Continuity

- [Current Architecture Memory](./.ai/memory/current-architecture.md)
- [Active Work Memory](./.ai/memory/active-work.md)
- [Known Issues Memory](./.ai/memory/known-issues.md)
- [Decision Log](./docs/DECISION_LOG.md)

### Reports and Analysis (\`docs/reports/\`)

**Maturity and Strategy**
- [AI Vibe Coding Maturity Report](./docs/reports/AI_VIBECODING_MATURITY_REPORT.md)
- [State-of-the-Art Gap Analysis](./docs/reports/aiep_state_of_the_art_gap_analysis.md)
- [Sustainable Implementation Roadmap](./docs/reports/aiep_sustainable_implementation_roadmap.md)

**Phase Gate Evidence**
- [Phase 0 — G1–G3 Evidence](./docs/reports/phase0-g1-g3-evidence.md)
- [Phase 0 — Gate Evidence Template](./docs/reports/phase0-gate-evidence-template.md)
- [Phase 1 — G4–G5 Readiness](./docs/reports/phase1-g4-g5-readiness.md)
- [Phase 1 — Memory Maintenance Runbook](./docs/reports/phase1-memory-maintenance-runbook.md)
- [Phase 1 — Relationship Shadow Report](./docs/reports/phase1-relationship-shadow-report.md)
- [Phase 2 — Skill Determinism Evidence](./docs/reports/phase2-p2-skill-determinism-evidence.md)
- [Phase 2 — Skill Determinism Runbook](./docs/reports/phase2-skill-determinism-runbook.md)
- [Phase 4 — G1–G5 Evidence Pack](./docs/reports/phase4-g1-g5-evidence-pack.md)

**Memory and Retrieval (P3)**
- [P3 Memory Readiness Review](./docs/reports/p3-memory-readiness-review.md)
- [P3 Memory-Assisted Pilot Report](./docs/reports/p3-memory-assisted-pilot-report.md)

**Token Economics (P4)**
- [P4 Model Tiering Policy](./docs/reports/p4-model-tiering-policy.md)
- [P4 Token Forecast Validation](./docs/reports/p4-token-forecast-validation.md)
- [P4 Spend Attribution Report](./docs/reports/p4-spend-attribution-report.md)
- [P4 Quarterly Token ROI Review — 2026 Q2](./docs/reports/p4-quarterly-token-roi-review-2026q2.md)
- [P4 Quarterly Token ROI Template](./docs/reports/p4-quarterly-token-roi-template.md)
- [P4 Red-Team Cost Policy Report](./docs/reports/p4-red-team-cost-policy-report.md)
- [P4 Gate Signoff Memo](./docs/reports/p4-gate-signoff-memo.md)

**Governance and Skill Analysis**
- [G1–G5 Governance Closure](./docs/reports/g1-g5-governance-closure.md)
- [Skill Policy Matrix](./docs/reports/skill-policy-matrix.md)
- [Skill Manifest Schema v2 Migration Checklist](./docs/reports/skill-manifest-schema-v2-migration-checklist.md)
- [Skill Resolver Compatibility Notes](./docs/reports/skill-resolver-compatibility-notes.md)
- [Prompt Skill Audit — Top 25](./docs/reports/prompt-skill-audit-top25.md)

**Benchmark**
- [Cross-Priority Benchmark Report](./docs/reports/cross-priority-benchmark-report.md) — strict gate (intentional fail on verificationFailureRate 0.375 > 0.35)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for workflow and PR process.
