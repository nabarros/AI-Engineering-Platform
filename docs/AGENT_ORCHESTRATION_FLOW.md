# Agent Orchestration Routing Flow

Visual representation of how AIEP routes incoming requests to specialist agents.

```mermaid
flowchart TD
    A["Request Received<br/>(domain, risk, budget)"] --> B["Router Agent<br/>Deterministic Scoring"]
    
    B --> C{"Budget Tier<br/>Check"}
    C -->|LOW| D["Eligible Candidates<br/>Context Planner<br/>Code Reviewer<br/>Implementation Guardian"]
    C -->|LOW-MEDIUM| E["Eligible Candidates<br/>+ UI/UX<br/>+ Frontend<br/>+ Backend"]
    C -->|MEDIUM-HIGH| F["All Specialists<br/>Eligible"]
    
    D --> G["Score Candidates<br/>Domain Fit<br/>Quality<br/>Historical Success<br/>Token Budget Fit<br/>Latency Budget Fit"]
    E --> G
    F --> G
    
    G --> H["Select Primary<br/>Specialist<br/>Highest Score"]
    
    H --> I{"Specialist<br/>Type"}
    I -->|Planning| J["Context Planner<br/>Execute Task"]
    I -->|Review| K["Code Reviewer<br/>Execute Task"]
    I -->|Implementation| L["Implementation Guardian<br/>Execute Task"]
    I -->|Backend| M["Senior Backend<br/>Execute Task"]
    I -->|Frontend| N["Senior Frontend<br/>Execute Task"]
    I -->|UI/UX| O["Senior UI/UX<br/>Execute Task"]
    I -->|SRE| P["Senior SRE<br/>Execute Task"]
    
    J --> Q{"Peer Invocation<br/>Needed?"}
    K --> Q
    L --> Q
    M --> Q
    N --> Q
    O --> Q
    P --> Q
    
    Q -->|Yes, Single Peer| R["Invoke One Peer<br/>Specialist<br/>Single-Hop Only"]
    Q -->|No| S["Continue to<br/>Verification"]
    
    R --> S
    
    S --> T["Verification Gate<br/>Security Check<br/>Contract Validation<br/>Test Coverage"]
    
    T --> U{"Verification<br/>Passed?"}
    U -->|Yes| V["Return Result<br/>Primary Output<br/>Peer Output<br/>Consolidated"]
    U -->|No| W["Activate Fallback<br/>Chain<br/>Try Next Candidate"]
    
    W --> X{"Fallback<br/>Available?"}
    X -->|Yes| Y["Route to<br/>Fallback Specialist"]
    Y --> G
    X -->|No| Z["Return Error<br/>No Fallback<br/>Available"]
    
    V --> AA["Response Sent<br/>Trace Recorded<br/>Memory Updated"]
    Z --> AA
    
    style A fill:#e3f2fd
    style B fill:#fff3e0
    style H fill:#f3e5f5
    style V fill:#e8f5e9
    style Z fill:#ffebee
```

## Flow Legend

| Step | Description |
|---|---|
| **Request Received** | Domain, risk level, token budget tier, latency budget |
| **Router Scoring** | Deterministic multi-factor scoring across eligible candidates |
| **Budget Tier Check** | Filter candidates by token and latency budget fit |
| **Score & Select** | Deterministic scoring: domain-fit → quality → history → budget → latency |
| **Execute Primary** | Selected specialist executes (may invoke one peer if needed) |
| **Peer Invocation** | If cross-domain blocker: invoke exactly one peer specialist (single-hop) |
| **Verification Gate** | Security, contract, test coverage validation before response |
| **Fallback Chain** | If verification fails, activate pre-computed fallback specialist |
| **Return Result** | Consolidated output from primary (+ peer if invoked) |

## Routing Rules Summary

1. **Context Planner selected when:** Planning-first, risk-scoping, or context-loading strategy needed before coding
2. **Code Reviewer selected when:** Review-first (bugs, regressions, risks, missing tests)
3. **Frontend selected when:** React/TypeScript UI, state, rendering, accessibility
4. **Backend selected when:** API contracts, domain logic, data handling, services
5. **UI/UX selected when:** User journeys, interaction quality, information hierarchy
6. **SRE selected when:** Reliability, incident response, observability, SLI/SLO, release safety
7. **Implementation Guardian selected when:** Safe coding, refactoring, or operational SRE work requiring file edits
8. **Exactly one primary specialist** selected per request
9. **Peer invocation single-hop only:** Primary may invoke ONE peer if cross-domain blocker (no chains)
10. **Fallback chain provided** when more than one candidate is eligible
11. **Confidence check:** If < 70%, ask one clarifying question before routing
12. **Verification gate mandatory** before returning response

## Specialist Risk Ceilings

| Specialist | Risk Ceiling | Token Tiers |
|---|---|---|
| Context Planner | LOW | Any |
| Code Reviewer | LOW–MEDIUM | Low–Medium |
| Implementation Guardian | MEDIUM–HIGH | Any |
| Senior Backend | MEDIUM–HIGH | Medium–Premium |
| Senior Frontend | MEDIUM–HIGH | Medium–Premium |
| Senior UI/UX | MEDIUM | Low–Medium |
| Senior SRE | MEDIUM–HIGH | Medium–Premium |
| Router | LOW–HIGH (meta) | Any |

---

**See:** [AGENT_ORCHESTRATION.md](AGENT_ORCHESTRATION.md) for detailed capability matrix and collaboration rules.
