---
ai_priority: tier-3
context_type: template
load_when: creating-adr, documenting-decision
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Template: Architecture Decision Record (ADR)

Copy this template when creating a new ADR. Save to `docs/DECISION_LOG.md` as a new entry, or as a standalone file `docs/adr/ADR-{next-number}-{short-title}.md`.

---

```markdown
## ADR-{NUMBER}: {Short Title}

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-{N}
**Deciders:** @engineer1, @engineer2
**Tags:** [architecture | security | database | api | infrastructure | testing]

### Context

What is the situation that requires a decision?
Describe the current state, the problem or opportunity, and any constraints.
Include:
- What is currently in place (if anything)
- Why the current approach is insufficient
- Any relevant constraints (performance, security, team size, existing dependencies)

Keep to 2-4 paragraphs.

### Decision

What was decided?

State the decision clearly in one sentence, then elaborate.

Example: "We will use Kysely as the query builder for all new TypeScript database access code, replacing raw `pg` queries."

### Rationale

Why was this decision made over alternatives?

| Option | Pros | Cons |
|---|---|---|
| **Option A (chosen)** | [pros] | [cons] |
| Option B | [pros] | [cons] |
| Option C (status quo) | [pros] | [cons] |

Key factors that drove the decision:
1. [Factor 1]
2. [Factor 2]

### Consequences

**Positive:**
- [Expected benefit 1]
- [Expected benefit 2]

**Negative / Trade-offs:**
- [Known downside 1]
- [Known downside 2]

**Risks:**
- [Risk 1 and mitigation]

### Implementation Notes

Any specific implementation guidance:
- Where this applies (e.g., "new service code only; existing code not required to migrate")
- Any migration path for existing code
- Links to relevant skill files or documentation

### Review Date

{DATE+6months} — revisit if [specific trigger condition]
```

---

## Guidelines

- **One decision per ADR.** If a decision has multiple independent parts, write separate ADRs.
- **Status is mandatory.** Update status if the decision is superseded.
- **Write in past tense** — "We decided to..." not "We should..."
- **Include the rejected options.** Future engineers need to understand why alternatives were not chosen.
- **Keep it short.** A good ADR is 300-600 words. Long ADRs are not read.
