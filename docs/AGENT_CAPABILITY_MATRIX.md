# Agent Capability Matrix

Detailed capability mapping showing all 8 routing-system agents (Router + 7 specialists), their domains, risk ceilings, token tier fitness, and peer collaboration patterns.

```mermaid
graph LR
    subgraph Orchestration
        Router["🔀 Router<br/>Orchestration"]
    end
    
    subgraph Discovery
        ContextPlanner["📋 Context Planner<br/>Planning & Context<br/>Risk: LOW<br/>Tokens: Any"]
        CodeReviewer["✓ Code Reviewer<br/>Quality & Review<br/>Risk: LOW-MEDIUM<br/>Tokens: Low-Med"]
    end
    
    subgraph Implementation
        ImplGuard["⚙️ Implementation<br/>Guardian<br/>Safe Coding<br/>Risk: MEDIUM-HIGH<br/>Tokens: Any"]
    end
    
    subgraph Backend
        SeniorBackend["🔧 Senior Backend<br/>APIs & Services<br/>Risk: MEDIUM-HIGH<br/>Tokens: Medium-Prem"]
    end
    
    subgraph Frontend
        SeniorFrontend["⚛️ Senior Frontend<br/>React/TS UI<br/>Risk: MEDIUM-HIGH<br/>Tokens: Medium-Prem"]
    end
    
    subgraph Design
        SeniorUX["🎨 Senior UI/UX<br/>Interaction Design<br/>Risk: MEDIUM<br/>Tokens: Low-Med"]
    end
    
    subgraph Operations
        SeniorSRE["🚀 Senior SRE<br/>Reliability & Ops<br/>Risk: MEDIUM-HIGH<br/>Tokens: Medium-Prem"]
    end
    
    Router -->|routes to| ContextPlanner
    Router -->|routes to| CodeReviewer
    Router -->|routes to| ImplGuard
    Router -->|routes to| SeniorBackend
    Router -->|routes to| SeniorFrontend
    Router -->|routes to| SeniorUX
    Router -->|routes to| SeniorSRE
    
    ImplGuard -.->|peer invoke| SeniorBackend
    ImplGuard -.->|peer invoke| SeniorFrontend
    SeniorBackend -.->|peer invoke| CodeReviewer
    SeniorFrontend -.->|peer invoke| SeniorUX
    SeniorFrontend -.->|peer invoke| CodeReviewer
    
    style Router fill:#fff3e0
    style ContextPlanner fill:#e8f5e9
    style CodeReviewer fill:#e8f5e9
    style ImplGuard fill:#e3f2fd
    style SeniorBackend fill:#fce4ec
    style SeniorFrontend fill:#f3e5f5
    style SeniorUX fill:#e0f2f1
    style SeniorSRE fill:#ffe0b2
```

## Full Capability Table

| Agent | Domain | Primary Role | Risk Ceiling | Token Tier Fit | Peer Collaboration | Notes |
|---|---|---|---|---|---|---|
| **Router** | Orchestration | Deterministic routing | LOW–HIGH | Any | N/A (coordinator) | Selects 1 specialist; provides fallback chain |
| **Context Planner** | Planning & Discovery | Pre-execution analysis | LOW | Any | Can be invoked by any primary specialist | Mandatory context loading sequence |
| **Code Reviewer** | Quality & Validation | Review-first execution | LOW–MEDIUM | Low–Medium | Invoked by Implementation Guardian, Frontend, Backend for quality gates | Pre-PR readiness, security checks |
| **Implementation Guardian** | Safe Implementation | Refactoring & coding | MEDIUM–HIGH | Any | Can invoke Backend, Frontend, Code Reviewer | Architecture constraint checking; test coverage mandatory |
| **Senior Backend** | APIs & Services | Backend implementation | MEDIUM–HIGH | Medium–Premium | Can invoke Code Reviewer, SRE; invokable by Implementation Guardian | API contracts, domain logic, data handling |
| **Senior Frontend** | React/TS UI | Frontend implementation | MEDIUM–HIGH | Medium–Premium | Can invoke UI/UX, Code Reviewer; invokable by Implementation Guardian | Component design, state, accessibility, performance |
| **Senior UI/UX** | Interaction Design | UX quality | MEDIUM | Low–Medium | Invokable by Frontend, Implementation Guardian | User journeys, accessibility UX, design systems |
| **Senior SRE** | Reliability & Ops | Operational excellence | MEDIUM–HIGH | Medium–Premium | Invokable by Implementation Guardian for observability patterns | Incident readiness, SLI/SLO, release safety; read-only for audits |

## Routing Decision Tree

```mermaid
flowchart TD
    A["Task Received"] --> B{"What is the task?"}
    
    B -->|Plan before coding| C["→ Context Planner"]
    B -->|Review/audit code| D["→ Code Reviewer"]
    B -->|Operational read/check| E["→ Senior SRE"]
    B -->|Otherwise| F{"What domain?"}
    
    F -->|React/UI code| G["→ Senior Frontend"]
    F -->|Backend/API| H["→ Senior Backend"]
    F -->|UX/design| I["→ Senior UI/UX"]
    F -->|Refactor/safe impl| J["→ Implementation Guardian"]
    F -->|Multiple domains| K["→ Implementation Guardian<br/>+ peer invocation"]
    
    style C fill:#e8f5e9
    style D fill:#e8f5e9
    style E fill:#ffe0b2
    style G fill:#f3e5f5
    style H fill:#fce4ec
    style I fill:#e0f2f1
    style J fill:#e3f2fd
    style K fill:#fff3e0
```

## Peer Invocation Patterns

**Allowed (single-hop invocation only):**
- Implementation Guardian → Senior Backend (API contract clarification)
- Implementation Guardian → Senior Frontend (component integration)
- Senior Frontend → Senior UI/UX (accessibility/interaction)
- Senior Backend → Code Reviewer (quality gate)
- Senior Frontend → Code Reviewer (quality gate)
- Any specialist → Context Planner (context reload)

**Not allowed:**
- Chains (A → B → C)
- Circular dependencies (A → B → A)
- Multiple peers (A → B and A → C simultaneously)
- SRE → Implementation changes (use Implementation Guardian for file edits)

## Token Budget Allocation by Risk Level

| Risk Level | Recommended Token Tier | Suitable Specialists |
|---|---|---|
| LOW | Any (optimize for speed) | Context Planner, Code Reviewer, UI/UX |
| LOW–MEDIUM | Low–Medium | Code Reviewer, UI/UX, (any low-risk domain) |
| MEDIUM | Medium | Backend, Frontend, Implementation Guardian |
| MEDIUM–HIGH | Medium–Premium | Backend, Frontend, SRE, Implementation Guardian |
| HIGH–CRITICAL | Premium (explicit confirmation) | Implementation Guardian + peer if needed |

---

**See:** [AGENT_ORCHESTRATION.md](AGENT_ORCHESTRATION.md) for routing rules and fallback chains.
