# AIEP Specialist Agents

Catalog of all specialist agents in the AIEP router orchestration system. Deterministic routing to exactly one primary specialist per request.

---

## Agent Roster

Complete roster of all 8 specialist agents with domain focus, risk ceiling, and typical invocation pattern.

| # | Agent | Role | Domain | Risk Ceiling | Token Tier |
|---|---|---|---|---|---|
| 1 | **[Router](aiep-senior-staff-router.agent.md)** | Orchestration & routing | Meta (all domains) | LOW–HIGH | Any |
| 2 | **[Context Planner](aiep-context-planner.agent.md)** | Planning & context loading | Planning/discovery | LOW | Any |
| 3 | **[Code Reviewer](aiep-code-reviewer.agent.md)** | Code review & quality gates | QA/review | LOW–MEDIUM | Low–Med |
| 4 | **[Implementation Guardian](aiep-implementation-guardian.agent.md)** | Safe coding & refactoring | Implementation | MEDIUM–HIGH | Any |
| 5 | **[Senior Backend Engineer](aiep-senior-staff-backend.agent.md)** | API design & services | Backend | MEDIUM–HIGH | Medium–Prem |
| 6 | **[Senior Frontend Engineer](aiep-senior-staff-frontend.agent.md)** | React/TS UI & state | Frontend | MEDIUM–HIGH | Medium–Prem |
| 7 | **[Senior UI/UX Engineer](aiep-senior-staff-ui-ux.agent.md)** | Interaction & design | UX/Design | MEDIUM | Low–Med |
| 8 | **[Senior SRE Engineer](aiep-senior-staff-sre.agent.md)** | Reliability & observability | Ops/SRE | MEDIUM–HIGH | Medium–Prem |

---

## How Routing Works

1. **Router receives request** with domain, risk level, and budget tier
2. **Router scores all 8 candidates** using deterministic multi-factor rubric
3. **Router selects primary specialist** with highest score
4. **Specialist executes** the task (may invoke one peer if cross-domain blocker)
5. **Verification gate** validates security, contracts, and test coverage
6. **Fallback chain** activates if verification fails
7. **Result returned** with consolidated output and routing trace

**Visual:** See [docs/AGENT_ORCHESTRATION.md](../../docs/AGENT_ORCHESTRATION.md) for orchestration diagrams and detailed routing logic.

---

## Which Agent Should I Use?

### Use Router (via Copilot Chat)
**When:** You have a general task and want deterministic specialist selection

**How:**
```text
Use AIEP Senior Staff Router to [task description].
Requirements: [acceptance criteria]
```

**Router will:**
- Classify domain, risk, and budget
- Score all 8 candidates
- Select best-fit specialist
- Provide fallback chain if needed

**Best for:** Most requests; automatic optimization by budget and risk

---

### Use Context Planner Directly
**When:** You need pre-execution analysis before implementation

**Use cases:**
- Risk assessment for complex refactor
- Mandatory context loading for multi-step work
- Planning before coding
- Architecture decision guidance

**Best for:** High-risk work, complex tasks, uncertainty reduction

---

### Use Code Reviewer Directly
**When:** You have code to review or need quality validation

**Use cases:**
- Security audit of implementation
- Test coverage analysis
- Regression risk assessment
- Pre-PR findings validation

**Best for:** Review-first workflows, quality gates, security checks

---

### Use Implementation Guardian Directly
**When:** You need safe, test-backed implementation work

**Use cases:**
- Refactoring with architecture constraint checking
- Feature implementation with explicit error handling
- Cross-cutting concerns (affects multiple services)
- When safety and test coverage are top priority

**Can invoke:** Senior Backend, Senior Frontend, Code Reviewer (single peer)

**Best for:** Medium-high risk work, refactoring, cross-domain features

---

### Use Senior Staff Directly
**When:** You need domain-specific expertise

**Senior Backend:**
- API contract design
- Backend service implementation
- Database patterns and queries
- Domain business logic

**Senior Frontend:**
- React/TypeScript component architecture
- State management (Zustand/useState)
- Rendering optimization and performance
- Accessibility (ARIA, semantics)

**Senior UI/UX:**
- User journey design
- Interaction quality and animation
- Information hierarchy
- Design system patterns

**Senior SRE:**
- Observability and monitoring patterns
- Incident response readiness
- SLI/SLO definition and validation
- Release safety and rollout strategy
- Reliability analysis (no file edits)

---

## Agent Collaboration Rules

### Single-Specialist Execution Rule
**Exactly one primary specialist per request.** No parallel primaries, no overlapping work.

### Peer Invocation (Allowed)
**Primary specialist may invoke AT MOST one peer** when a cross-domain dependency blocks completion.

**Valid peer invocations:**
| Primary | Can Invoke | When |
|---|---|---|
| Implementation Guardian | Senior Backend | API contract clarification needed |
| Implementation Guardian | Senior Frontend | Component integration needed |
| Senior Frontend | Senior UI/UX | Accessibility or interaction guidance needed |
| Senior Backend | Code Reviewer | Quality or security gate needed |
| Senior Frontend | Code Reviewer | Quality or security gate needed |
| Any specialist | Context Planner | Context reload or risk assessment needed |
| Any specialist | Code Reviewer | Security or test coverage validation needed |

**Examples:**
- Frontend building component for new API → invoke Backend for API spec
- Backend designing endpoint → invoke Code Reviewer for security gate
- UI/UX defining interaction → invoked by Frontend, not vice versa (no bidirectional)

### Fallback Chain
**Automatically activated** if primary specialist's verification gate fails.

Pre-computed at routing time based on:
- Domain similarity
- Historical success rate
- Risk ceiling fit
- Token budget tier

---

## Specialist Decision Guide

| Question | Answer | Select |
|---|---|---|
| "Do I need to plan before coding?" | Yes | Context Planner |
| "Do I need to review code?" | Yes | Code Reviewer |
| "Is this React/TS UI work?" | Yes | Senior Frontend |
| "Is this backend/API work?" | Yes | Senior Backend |
| "Is this UX/interaction design?" | Yes | Senior UI/UX |
| "Is this reliability/ops?" | Yes | Senior SRE |
| "Am I refactoring or cross-cutting?" | Yes | Implementation Guardian |
| "I'm not sure which specialist" | — | Router (auto-select) |

---

## Customization & Monitoring

### Agent Definitions
- Each agent file: `./{agent-name}.agent.md`
- Naming convention: `aiep-{role}.agent.md`
- YAML frontmatter defines name, description, tools, and callable agents
- Routing rules in Router agent: [aiep-senior-staff-router.agent.md](aiep-senior-staff-router.agent.md)

### Skill Orchestration
- Shared orchestration rules: `../../.github/instructions/aiep-skill-orchestration.instructions.md`
- Mandatory sequence for non-trivial tasks (context bootstrap → role skill → implementation → verification → memory sync)

### Monitoring & Metrics
- **Active work tracking:** `.ai/memory/active-work.md` (specialist usage, routing scores, fallback frequency)
- **Known issues:** `.ai/memory/known-issues.md` (routing failures, edge cases)
- **Technical debt:** `.ai/memory/technical-debt.md` (orchestration improvements)

### Guardrails
- Runtime enforcement: `.github/hooks/aiep-guardrails.json` (restricted paths, memory-write confirmation)
- Pre-PR readiness: `.github/skills/aiep-pr-readiness/SKILL.md`

---

## Common Workflows

### Workflow 1: Build a Feature (Standard Path)

```
1. User: "Use Router to implement [feature]"
2. Router: Selects best specialist based on domain/risk/budget
3. Specialist: Executes with mandatory tests
4. Verification: Security/contract/test gates pass
5. Result: Merged output ready for PR
```

### Workflow 2: Refactor with Safety (Implementation Guardian Path)

```
1. User: "Use Implementation Guardian to refactor [code]"
2. Impl Guardian: Analyzes architecture constraints
3. Impl Guardian: May invoke Senior Backend/Frontend for domain guidance
4. Verification: All tests pass, no regressions
5. Result: Safe refactoring with full test coverage
```

### Workflow 3: Cross-Domain Feature (Peer Invocation)

```
1. User: "Use Router to build [feature] (frontend+backend)"
2. Router: Selects Implementation Guardian (cross-domain awareness)
3. Impl Guardian: Starts frontend work
4. Issue: "Need API contract first"
5. Impl Guardian: Invokes Senior Backend peer
6. Senior Backend: Returns API spec
7. Impl Guardian: Integrates spec, builds component+tests
8. Verification: All gates pass
9. Result: Consolidated implementation
```

### Workflow 4: Pre-PR Review (Quality Gate)

```
1. User: "Use Code Reviewer to audit [code]"
2. Code Reviewer: Security, test coverage, contract analysis
3. Code Reviewer: Returns findings-first report
4. User: Addresses findings
5. Code Reviewer: Re-validates (if re-invoked)
6. Result: PR-ready code
```

---

## See Also

- [Agent Orchestration Model](../../docs/AGENT_ORCHESTRATION.md) — Visual routing and fallback logic
- [Agent Orchestration Flow](../../docs/AGENT_ORCHESTRATION_FLOW.md) — Detailed routing flowchart
- [Agent Capability Matrix](../../docs/AGENT_CAPABILITY_MATRIX.md) — Specialist capabilities and token tiers
- [Specialist Fallback Chain](../../docs/SPECIALIST_FALLBACK_CHAIN.md) — Fallback patterns by specialist
- [Agent Guide](../../AGENT_GUIDE.md) — Prompt examples and use cases
- [Skill Orchestration](../instructions/aiep-skill-orchestration.instructions.md) — Mandatory skill sequence
- [Router Implementation](aiep-senior-staff-router.agent.md) — Routing rules and scoring

---

**Status:** Comprehensive agent orchestration catalog (8 specialists, deterministic routing, peer collaboration, fallback chains)

**Last updated:** 2026-05-09
