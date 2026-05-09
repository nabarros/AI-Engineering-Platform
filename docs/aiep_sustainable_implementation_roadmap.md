# AIEP Sustainable Implementation Roadmap

## Purpose and Source Alignment

This roadmap converts findings from the repository source analysis in [aiep_state_of_the_art_gap_analysis.md](../aiep_state_of_the_art_gap_analysis.md) into an execution plan that is sustainable, measurable, and cost-aware.

The source analysis identifies the strongest current advantage as deterministic, governance-first orchestration, and the largest delta as incomplete evolution from orchestration framework to adaptive AI runtime. This roadmap focuses that delta into five concrete objectives:

1. Complete agent orchestrator.
2. Enable automatic agent relationships.
3. Enforce per-agent skill subsets.
4. Implement memory for faster, oriented, and specific search.
5. Reduce premium-model token spend while preserving strategic usage where high-quality reasoning is needed.

## Scope and Assumptions

- Scope is platform and workflow evolution in this repository.
- Sequence favors minimal disruption to active feature work and existing governance controls.
- New capabilities must remain deterministic, testable, and auditable.
- Cost controls must not reduce quality on high-risk or high-complexity tasks.

## Objective Definitions

| Objective ID | Objective | Outcome Signal |
|---|---|---|
| O1 | Complete agent orchestrator | End-to-end orchestrator lifecycle supports plan, execute, verify, persist, and recover paths with explicit contracts. |
| O2 | Automatic agent relationships | Agent selection and collaboration are generated from capability metadata and runtime context, not hardcoded pairings. |
| O3 | Per-agent skill subsets | Each agent receives only the minimum skill set required by role, risk, and task domain. |
| O4 | Memory for faster, oriented, specific search | Multi-layer memory and retrieval provide lower-latency, higher-precision task context and reduced rework. |
| O5 | Premium-model token savings with strategic usage | Premium models are used only on high-value reasoning steps; lower-cost tiers cover routing, extraction, and validation where fit. |

## Prioritized Gap Clusters

Priority is based on source analysis severity and dependency structure.

| Priority | Gap Cluster | Source Gap Link | Why Priority Now | Primary Objectives |
|---|---|---|---|---|
| P0 | Orchestrator completeness and planning loop | Missing autonomous planning layer, long-horizon execution | Foundation for every downstream capability and quality gate | O1 |
| P1 | Automatic relationships and capability graph | Missing multi-agent coordination intelligence, weak agent-to-agent protocol | Removes brittle manual routing and unlocks scalable collaboration | O2 |
| P2 | Skill subset isolation and orchestration determinism | Governance drift risk, duplicated and broad skill loading | Reduces token waste, improves consistency, lowers prompt attack surface | O3, O5 |
| P3 | Cognitive memory and retrieval intelligence | Missing advanced memory architecture, knowledge and retrieval infrastructure, repository intelligence | Drives faster and more precise context assembly and continuity | O4, O5 |
| P4 | Token economics and model tiering policy | Missing economic intelligence layer, weak multi-model intelligence layer | Required to scale usage without quality collapse | O5 |

## Initiative Portfolio

| Initiative ID | Initiative Name | Summary |
|---|---|---|
| I1 | Orchestrator Kernel Completion | Implement orchestrator lifecycle states, recovery semantics, planner integration points, and deterministic verification boundaries. |
| I2 | Agent Relationship Automation | Build capability graph, relationship inference rules, delegation contracts, and runtime safety constraints for auto-linking agents. |
| I3 | Agent Skill Subset Compiler | Introduce policy-driven skill manifests and runtime subset selection per agent, task domain, and risk level. |
| I4 | Memory and Search Fabric | Deliver layered memory, indexed retrieval, and oriented query strategies for repository and execution memory. |
| I5 | Token Economics and Model Tiering | Enforce model-routing policy, token budgets, caching, and quality gates to preserve premium usage for strategic steps only. |

## Initiative to Objective Mapping

| Initiative | O1 | O2 | O3 | O4 | O5 |
|---|---|---|---|---|---|
| I1 Orchestrator Kernel Completion | X |  |  |  | X |
| I2 Agent Relationship Automation |  | X |  |  | X |
| I3 Agent Skill Subset Compiler |  | X | X |  | X |
| I4 Memory and Search Fabric |  |  |  | X | X |
| I5 Token Economics and Model Tiering |  |  | X | X | X |

## Phased Roadmap

### Phase 1 (0-3 months): Foundation Hardening

| Category | Plan |
|---|---|
| Deliverables | 1) Orchestrator state machine for plan, execute, verify, persist, recover. 2) Agent capability registry schema with explicit metadata. 3) Initial skill manifest format and subset resolver. 4) Memory index baseline for task and repository metadata. 5) Token budget policy draft and model-tier decision matrix. |
| Dependencies | Stable orchestrator interfaces, metadata schema agreement, baseline observability for token and latency tracking. |
| Risks | Scope expansion into full autonomous runtime too early; inconsistent metadata quality; weak ownership boundaries. |
| Controls | Change freeze on interface contracts after sprint 2; schema validation and lint checks; ownership tags required in manifests. |
| Success Metrics | 95 percent orchestrator flows use explicit lifecycle states; 80 percent agent invocations use capability metadata; 20 percent premium-token reduction without quality regression in pilot tasks. |

### Phase 2 (3-6 months): Automation and Isolation

| Category | Plan |
|---|---|
| Deliverables | 1) Relationship inference engine and delegation contract templates. 2) Automatic relationship generation for top specialist agents. 3) Per-agent skill subset enforcement with deny-by-default policy. 4) Memory retrieval strategies by task intent (bugfix, feature, review, docs). 5) Token-aware routing integrated with confidence and risk scoring. |
| Dependencies | Phase 1 metadata quality, stable skill manifests, reliable telemetry for routing quality. |
| Risks | False-positive relationship links, over-restrictive skill subsets, retrieval noise from low-quality memory entries. |
| Controls | Shadow mode for relationship automation; fallback to deterministic single-specialist path; retrieval relevance threshold tuning with sampled audits. |
| Success Metrics | 70 percent of non-trivial tasks use automatic agent relationships; 90 percent of agent runs pass skill subset policy checks; 30 percent median search time reduction for task context assembly. |

### Phase 3 (6-12 months): Cognitive Runtime Expansion

| Category | Plan |
|---|---|
| Deliverables | 1) Multi-layer memory implementation (working, episodic, semantic, procedural). 2) Repository-oriented search with graph-aware ranking features. 3) Planner re-entry and dynamic replanning hooks in orchestrator. 4) Cost-quality optimizer for model tier selection by step type. 5) Cross-agent memory handoff contracts with traceability. |
| Dependencies | Mature relationship automation, retrieval quality baseline, complete tracing for token, latency, and quality dimensions. |
| Risks | Memory growth and staleness, planner complexity drift, model policy regressions under new task types. |
| Controls | Memory aging and compaction jobs; monthly policy recalibration; benchmark suite with regression budgets on quality and cost. |
| Success Metrics | 40 percent reduction in repeated context reconstruction; 35 percent premium-token reduction versus baseline while preserving acceptance-quality thresholds; 25 percent improvement in multi-step task completion reliability. |

### Phase 4 (12 months+): Sustainable Optimization and Platformization

| Category | Plan |
|---|---|
| Deliverables | 1) Continuous policy learning loops for routing and model economics. 2) Expanded relationship automation to long-horizon missions. 3) Memory governance for retention, provenance, and compliance. 4) Advanced token ROI forecasting and budget governance by workload class. 5) Externalized capability interfaces for ecosystem growth without policy drift. |
| Dependencies | Stable phase 3 operations, mature governance automation, longitudinal benchmark data. |
| Risks | Over-automation without human oversight, policy drift across teams, hidden quality degradation masked by cost gains. |
| Controls | Human approval checkpoints for high-risk mission classes; quarterly architecture and policy audits; mandatory red-team quality review for optimizer changes. |
| Success Metrics | Sustained premium-model usage only on strategic steps above defined complexity threshold; predictable token spend variance within quarterly budget envelope; no critical regressions in verification pass rates. |

## Token and Cost Strategy

### Principles

- Keep premium models for strategic reasoning, ambiguity resolution, and high-risk verification.
- Push routing, extraction, formatting, and low-risk validation to lower-cost models.
- Use retrieval quality to reduce context size before model invocation.
- Prefer deterministic pre-checks and cached results over repeated premium inference.

### Control Model

| Layer | Control |
|---|---|
| Policy | Task-type and risk-based model selection policy with explicit override rules. |
| Budget | Per-request and per-workflow token budgets with hard and soft limits. |
| Optimization | Prompt compression, response caching, and skill subset minimization. |
| Quality Guard | Automatic fallback to premium model when confidence, risk, or verification gate fails. |
| Reporting | Weekly cost-quality dashboard: token by objective, model tier, and outcome class. |

### Strategic Premium Usage Rule

Use premium models when at least one condition is true:

- High risk task classification.
- Architectural or security-sensitive decision point.
- Verification gate reports ambiguity or low confidence.
- Multi-step planning where failure recovery cost exceeds premium token cost.

## Verification Gates

Verification gates are mandatory before phase promotion.

| Gate ID | Gate Name | Entry Criteria | Exit Criteria |
|---|---|---|---|
| G1 | Contract Integrity Gate | Orchestrator and capability schemas defined | Contract tests pass and no unresolved breaking changes. |
| G2 | Relationship Safety Gate | Auto-relationship engine enabled in shadow mode | False-link rate below agreed threshold and fallback behavior validated. |
| G3 | Skill Isolation Gate | Subset policy enforcement active for pilot agents | No unauthorized skill exposure in audit sample and zero critical policy bypasses. |
| G4 | Memory Precision Gate | Retrieval pipelines enabled for target task classes | Precision and latency targets met for oriented task search. |
| G5 | Cost-Quality Balance Gate | Token policy and model routing in active use | Target token savings achieved with stable quality and verification pass rates. |

## Dependencies Across Initiatives

| Dependency | Required By | Rationale |
|---|---|---|
| Capability metadata schema | I2, I3, I5 | Automation and policy decisions require uniform agent descriptors. |
| Orchestrator lifecycle contracts | I2, I4, I5 | Relationship logic, memory handoff, and cost policy need stable execution stages. |
| Observability instrumentation | I4, I5 | Retrieval quality and token economics need trustworthy telemetry. |
| Verification benchmark suite | I1, I2, I3, I4, I5 | Every objective needs quality guardrails and regression detection. |

## Risk Register and Controls

| Risk | Exposure | Control | Owner |
|---|---|---|---|
| Automated relationships create invalid delegation chains | High | Shadow mode rollout, policy deny lists, deterministic fallback path | Orchestration team |
| Skill subsets become too restrictive and harm completion | Medium | Progressive rollout, exception workflow, outcome monitoring | Agent governance team |
| Memory index staleness harms search orientation | High | TTL, re-index cadence, provenance scoring, stale result suppression | Memory platform team |
| Cost optimization degrades output quality | High | Mandatory quality gates, premium fallback triggers, benchmark regression tests | Platform quality team |
| Orchestrator expansion introduces complexity debt | Medium | Lifecycle contract freeze windows, ADR discipline, quarterly refactor budget | Architecture group |

## Success Scorecard

Track quarterly against these outcome metrics:

- O1: Orchestrator lifecycle completeness index and recovery success rate.
- O2: Automatic relationship adoption rate and false-link rate.
- O3: Skill subset compliance rate and policy bypass incidents.
- O4: Oriented retrieval precision, median context assembly latency, and reuse rate.
- O5: Premium-token ratio, total token per successful task, and quality retention index.

## Governance and Review Cadence

- Monthly: progress review against phase deliverables and gate health.
- Quarterly: architecture audit, token economics review, and risk register recalibration.
- Release boundary: no phase advancement without verification gate evidence.

## Definition of Sustainable Completion

The roadmap is considered sustainably implemented when:

- All five objectives show two consecutive quarters of stable metrics.
- Verification gates remain green without manual exception accumulation.
- Premium-model usage is strategic and explainable by policy and risk.
- Orchestrator, relationship automation, skill subsets, and memory search operate as one deterministic governance system.

## Execution TO DO List (All Priorities)

This is the most urgent execution backlog from the report and should be used as the default implementation queue.

### Priority 0 (Immediate)

- [x] Finalize orchestrator lifecycle state contract (O1); output: signed interface spec in docs plus typed contract file; done when plan, execute, verify, persist, and recover states are versioned and approved by owners.
- [x] Implement orchestrator transition guard checks (O1); output: state transition validator module and negative-path tests; done when invalid transitions fail deterministically in CI.
- [x] Add planner re-entry hook at verify and recover boundaries (O1); output: orchestrator hook implementation and trace samples; done when failed tasks can re-plan without manual intervention.
- [x] Publish capability metadata schema v1 for all active agents (O2); output: schema file and populated registry entries; done when all production agents pass schema validation.
- [x] Enable deterministic fallback path for relationship automation (O2); output: fallback policy config and integration tests; done when fallback triggers on unsafe links with zero runtime crashes.
- [x] Define per-agent minimum skill manifests for top 10 agents (O3); output: manifest files and policy mapping table; done when each target agent resolves only allowlisted skills.
- [x] Enforce deny-by-default skill loading in runtime resolver (O3); output: resolver policy update and authorization tests; done when unauthorized skills are blocked in test and staging runs.
- [x] Stand up memory index baseline for task and repository metadata (O4); output: indexed storage pipeline and seed index report; done when indexing job completes on the main repository scope.
- [x] Add oriented retrieval strategy for bugfix and feature task intents (O4); output: retrieval strategy module and benchmark script; done when precision and latency meet agreed pilot thresholds.
- [x] Instrument token, latency, and verification telemetry at step level (O5); output: observability events and dashboard panel; done when per-step metrics are queryable for all orchestrator runs.
- [x] Ship model-tier routing policy v1 with risk-based overrides (O5); output: routing policy config and policy tests; done when low-risk steps route to lower tier and high-risk steps route to premium tier.
- [x] Create gate evidence template and attach first G1-G3 evidence set (O1/O2/O3); output: gate evidence documents and linked CI artifacts; done when gate reviewers can approve using only recorded evidence.

### Priority 1 (Next Critical)

- [x] Roll out relationship inference engine in shadow mode for top specialist agents (O2); output: shadow deployment config and mismatch report; done when false-link rate is measured for two weeks.
- [x] Implement delegation contract templates with explicit handoff fields (O2); output: contract template files and schema tests; done when every delegated task includes required handoff metadata.
- [x] Expand skill subset compiler to role, domain, and risk inputs (O3); output: compiler logic update and fixture-based tests; done when subset outputs are deterministic across repeated runs.
- [x] Add exception workflow for temporary skill elevation with audit trail (O3); output: approval flow design and audit log entries; done when each exception has approver, reason, and expiry.
- [x] Introduce memory provenance scoring and stale-result suppression (O4); output: scoring module and retrieval filters; done when stale entries are excluded above threshold in sampled audits.
- [x] Implement memory TTL and re-index cadence jobs (O4); output: scheduled maintenance jobs and operations runbook; done when stale index segments are automatically refreshed on schedule.
- [x] Add repository graph-aware ranking signals to search (O4); output: ranking feature implementation and offline eval report; done when median context assembly time drops against baseline.
- [x] Enable response caching for repeat low-risk validation steps (O5); output: cache policy and cache hit telemetry; done when repeated validations show measurable token savings.
- [x] Build premium fallback trigger based on confidence and verification failures (O5); output: fallback rule engine and scenario tests; done when low-confidence outputs escalate automatically.
- [x] Publish weekly cost-quality scorecard by objective and model tier (O5); output: automated report job and dashboard snapshots; done when scorecard is generated without manual edits.
- [x] Add benchmark suite for multi-step completion reliability and recovery (O1/O4/O5); output: benchmark definitions and CI job; done when baseline is captured and tracked release over release.
- [x] Run gate readiness review for G4 and G5 with go/no-go criteria (O4/O5); output: review notes and decision record; done when exit criteria owners sign off with linked evidence.

### Priority 2

- [ ] Compile skill policy matrix by role, domain, and risk (O3/O5); output: policy matrix document and machine-readable config file; done when policy lints pass and matrix is approved by governance owners.
- [ ] Refactor runtime skill resolver to consume compiled subsets only (O3); output: resolver refactor PR and compatibility adapter notes; done when direct broad skill loading paths are removed from production flow.
- [ ] Harden skill manifest schema with explicit deny and expiry fields (O3); output: schema v2 file and migration checklist; done when all active manifests validate against schema v2 in CI.
- [ ] Implement deterministic subset resolution cache for repeated task signatures (O3/O5); output: cache module and cache-key specification; done when repeated runs return identical subset payloads with lower latency.
- [ ] Add subset policy violation alerting for staging and production runs (O3); output: alert rules and on-call runbook section; done when unauthorized exposure events page the owning team in test drills.
- [ ] Audit top 25 agent prompts for unnecessary skill references (O3/O5); output: prompt audit report and remediation PR list; done when every audited prompt maps only to allowlisted skills.
- [ ] Introduce pre-execution subset dry-run check in orchestrator pipeline (O3); output: preflight check step and failure message catalog; done when blocked runs provide actionable denial reasons before model invocation.
- [ ] Measure subset impact on token usage per task class (O5); output: token impact analysis report and dashboard view; done when per-class savings and variance are tracked weekly.
- [ ] Standardize exception expiry enforcement for elevated skill grants (O3); output: expiry enforcement job and exception closure log; done when expired grants are revoked automatically without manual cleanup.
- [ ] Approve and publish P2 gate evidence package for skill determinism (O3/O5); output: evidence bundle and signed review notes; done when reviewers approve using only linked artifacts and test outputs.

### Priority 3

- [ ] Design multi-layer memory model contract for working, episodic, semantic, and procedural stores (O4); output: memory contract spec and interface definitions; done when storage and retrieval components implement the same typed contract.
- [ ] Implement memory write-path with provenance, timestamp, and scope metadata (O4); output: write service module and validation tests; done when every memory write persists required metadata fields.
- [ ] Build intent-aware retrieval planner for bugfix, feature, review, and docs tasks (O4/O5); output: retrieval planner module and intent fixtures; done when planner selects strategy deterministically per intent class.
- [ ] Add repository graph indexer for symbol, dependency, and ownership links (O4); output: graph indexing pipeline and index health report; done when scheduled index runs complete with zero critical integrity errors.
- [ ] Implement retrieval ranking blend with graph, recency, and provenance signals (O4); output: ranking configuration and offline evaluation notebook export; done when precision improves against baseline benchmark set.
- [ ] Introduce memory compaction and archival workflow for stale low-value entries (O4/O5); output: compaction job and retention policy document; done when storage growth rate drops while retrieval precision remains stable.
- [ ] Add cross-agent memory handoff packet in delegation contract (O2/O4); output: handoff packet schema and integration tests; done when delegated tasks resume with required prior context attached.
- [ ] Create retrieval quality dashboard with latency, precision, and miss diagnostics (O4); output: dashboard panels and query definitions; done when weekly review can isolate top miss drivers without ad hoc analysis.
- [ ] Run controlled pilot on memory-assisted execution for multi-step tasks (O4/O5); output: pilot report and before/after performance dataset; done when pilot shows measurable reduction in repeated context reconstruction.
- [ ] Publish P3 memory readiness review with remediation actions (O4); output: readiness review record and prioritized action tracker; done when all P3 critical findings are closed or risk-accepted by owners.

### Priority 4

- [ ] Define model tiering policy by step type, risk, and confidence band (O5); output: tiering policy spec and routing matrix file; done when every orchestrator step maps to an explicit default tier.
- [ ] Implement token budget allocator for request, workflow, and objective levels (O5); output: budget allocator module and quota tests; done when over-budget flows trigger deterministic control actions.
- [ ] Add runtime token forecaster using historical step telemetry (O5); output: forecasting service and error-bound report; done when forecast accuracy meets agreed tolerance on validation set.
- [ ] Build cost-quality optimizer with guardrail thresholds and premium escalation rules (O5); output: optimizer component and simulation results; done when quality guardrails hold under cost-reduction scenarios.
- [ ] Integrate response cache with invalidation by policy version and context hash (O5); output: cache integration patch and invalidation test suite; done when stale cache reuse incidents remain below threshold.
- [ ] Add per-team spend attribution and anomaly detection alerts (O5); output: attribution report job and alert policy config; done when abnormal spend spikes are detected within one reporting cycle.
- [ ] Create quarterly token ROI review template tied to O1-O5 outcomes (O5); output: ROI template and first completed review packet; done when leadership can trace spend to objective impact.
- [ ] Implement automated downgrade path for low-risk, high-volume task classes (O5); output: downgrade rule set and rollback switch; done when targeted classes reduce premium usage without quality regression.
- [ ] Run red-team evaluation for cost policy abuse and routing bypass attempts (O3/O5); output: red-team findings report and mitigation backlog; done when all high-severity bypass vectors are closed.
- [ ] Finalize P4 gate sign-off for cost-quality sustainability controls (O5); output: sign-off memo and linked benchmark evidence; done when gate owners approve sustained operation criteria.

### 120-Day Execution Sequence (Cross-Priority)

- [x] Finalize orchestrator lifecycle state contract and transition guards.
- [x] Add planner re-entry hook and deterministic fallback path for unsafe relationships.
- [x] Publish capability metadata schema v1 and validate all active agents.
- [x] Define minimum skill manifests for top agents and enforce deny-by-default loading.
- [x] Instrument step-level token, latency, and verification telemetry.
- [x] Launch relationship inference in shadow mode and capture false-link metrics.
- [ ] Expand subset compiler inputs and enable pre-execution subset dry-run checks.
- [ ] Audit top prompts for unnecessary skill references and remediate allowlist drift.
- [x] Stand up memory index baseline and implement intent-aware retrieval planning.
- [x] Add provenance scoring, stale suppression, TTL, and re-index cadence jobs.
- [ ] Deploy repository graph-aware ranking and retrieval quality dashboard.
- [ ] Run benchmark suite for multi-step reliability, retrieval precision, and recovery.
- [x] Ship model-tier routing policy with confidence-based premium fallback triggers.
- [ ] Enable low-risk validation caching and request/workflow token budget controls.
- [ ] Run red-team validation for routing bypass and cost policy abuse scenarios.
- [ ] Execute G1-G5 gate reviews and publish final 120-day evidence pack with owner sign-off.

### Blockers to Remove First

- [ ] Unclear ownership for orchestrator contract approvals across architecture and implementation teams.
- [x] Incomplete or inconsistent capability metadata for existing agents.
- [x] Missing baseline telemetry for token, latency, and verification events.
- [ ] No agreed threshold values for retrieval precision, false-link rate, and quality retention.
- [ ] No fixed review cadence and approver list for verification gates G1-G5.
- [x] Skill manifest coverage gaps and expired exceptions without automated revocation.
- [x] Retrieval data quality issues from stale, unscoped, or low-provenance memory entries.
- [ ] Missing spend attribution and anomaly alerting to control cross-team token budget drift.

### Priority Ownership Model

- P0: Orchestrator Core Team owns lifecycle contracts, transition safety, and planner re-entry delivery.
- P1: Agent Coordination Team owns capability graph automation, delegation contracts, and shadow rollout.
- P2: Agent Governance Team owns skill subset compiler, policy enforcement, and exception controls.
- P3: Memory Platform Team owns memory model, retrieval infrastructure, and relevance quality operations.
- P4: AI Economics and Quality Team owns model tiering policy, token governance, and cost-quality optimization.
