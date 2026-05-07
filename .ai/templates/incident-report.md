---
ai_priority: tier-3
context_type: template
load_when: incident-occurred, writing-post-mortem
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Template: Incident Report / Post-Mortem

Complete within 48 hours of incident resolution. Share in #incidents channel and link to Jira.

---

```markdown
# Incident Report: {Service} — {Date}

**Incident ID:** INC-{YYYY}-{NNN}
**Severity:** SEV-1 | SEV-2 | SEV-3
**Status:** Open | Resolved
**Incident Commander:** @engineer
**Duration:** HH:MM UTC to HH:MM UTC ({N} minutes)

---

## Summary

[2-3 sentence summary: what broke, what the user impact was, and how it was resolved.]

---

## Impact

- **Affected service(s):** {list}
- **Error rate peak:** {X}%
- **p95 latency peak:** {Xms}
- **Estimated affected users/requests:** ~{N}
- **Data loss:** None | {describe if any}
- **SLO impact:** {SLO name} was {X}% during incident (target: {Y}%)

---

## Timeline

All times UTC.

| Time | Event |
|---|---|
| HH:MM | Alert fired: {alert name} |
| HH:MM | On-call acknowledged |
| HH:MM | {Investigation step} |
| HH:MM | {Mitigation action taken} |
| HH:MM | Error rate returned to baseline |
| HH:MM | Incident resolved |

---

## Root Cause

[Technical explanation of what failed and why. Be specific — not "the service was slow" but "the N+1 query in PromptRepository.findByUser introduced by PR #1234 caused DB connection pool exhaustion under load."]

**Contributing factors:**
- [Factor 1]
- [Factor 2]

---

## Detection

- How was the incident detected? (Alert | Customer report | Monitoring | Manual)
- How long after the issue started was it detected?
- Was the alert threshold appropriate? Should it be lower?

---

## Resolution

What was done to resolve the incident?

1. [Step 1]
2. [Step 2]
3. [Step 3]

---

## What Went Well

- [Monitoring caught the issue quickly]
- [Rollback procedure was fast and effective]
- [Team communication was clear]

---

## What Could Be Improved

- [Area 1 — what would have helped]
- [Area 2]

---

## Action Items

| # | Action | Owner | Priority | Due Date |
|---|---|---|---|---|
| 1 | [Specific action, not "improve monitoring"] | @engineer | P0/P1/P2 | YYYY-MM-DD |
| 2 | | | | |

**P0 — Must complete before next deploy of affected service**
**P1 — Complete within 1 sprint**
**P2 — Complete within 1 quarter**

---

## Lessons Learned

[1-3 key lessons. These should inform future architecture, monitoring, or process decisions.]
```

---

## Guidelines

- **No blame.** Focus on systems, processes, and decisions — not individual engineers.
- **Be specific on root cause.** Vague root causes lead to vague action items that are never resolved.
- **Action items must be actionable.** "Add alerting for X metric threshold Y" is actionable. "Improve reliability" is not.
- **Complete within 48 hours.** Memory fades; write it while it's fresh.
