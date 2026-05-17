# Agent Capability Matrix

Detailed capability mapping showing all 11 routing-system agents (Router + 10 specialists), their domains, risk ceilings, token tier fitness, and peer collaboration patterns.

```mermaid
graph LR
    subgraph Orchestration
        Router["🔀 Router<br/>Orchestration"]
    end
    
    subgraph Discovery
        ContextPlanner["📋 Context Planner<br/>Planning & Context<br/>Risk: HIGH<br/>Tokens: Low"]
        CodeReviewer["✓ Code Reviewer<br/>Quality & Review<br/>Risk: HIGH<br/>Tokens: Low"]
    end
    
    subgraph Implementation
        ImplGuard["⚙️ Implementation<br/>Guardian<br/>Safe Coding<br/>Risk: HIGH<br/>Tokens: Medium"]
    end
    
    subgraph Backend
        SeniorBackend["🔧 Senior Backend<br/>APIs & Services<br/>Risk: HIGH<br/>Tokens: Medium"]
    end
    
    subgraph Frontend
        SeniorFrontend["⚛️ Senior Frontend<br/>React/TS UI<br/>Risk: HIGH<br/>Tokens: Medium"]
    end
    
    subgraph Design
        SeniorUX["🎨 Senior UI/UX<br/>Interaction Design<br/>Risk: MEDIUM<br/>Tokens: Low"]
    end
    
    subgraph Operations
        SeniorSRE["🚀 Senior SRE<br/>Reliability & Ops<br/>Risk: HIGH<br/>Tokens: Low"]
    end
    
    subgraph AI
        SeniorAI["🤖 Senior AI/LLM<br/>LLM & RAG<br/>Risk: HIGH<br/>Tokens: High"]
    end
    
    subgraph Architecture
        SeniorArch["🏛️ Senior Architect<br/>System Design<br/>Risk: HIGH<br/>Tokens: Low"]
    end
    
    subgraph DevOps
        SeniorDevOps["🛠️ Senior DevOps<br/>CI/CD & Infra<br/>Risk: HIGH<br/>Tokens: Medium"]
    end
    
    Router -->|routes to| ContextPlanner
    Router -->|routes to| CodeReviewer
    Router -->|routes to| ImplGuard
    Router -->|routes to| SeniorBackend
    Router -->|routes to| SeniorFrontend
    Router -->|routes to| SeniorUX
    Router -->|routes to| SeniorSRE
    Router -->|routes to| SeniorAI
    Router -->|routes to| SeniorArch
    Router -->|routes to| SeniorDevOps
    
    ImplGuard -.->|peer invoke| SeniorBackend
    ImplGuard -.->|peer invoke| SeniorFrontend
    SeniorBackend -.->|peer invoke| CodeReviewer
    SeniorFrontend -.->|peer invoke| SeniorUX
    SeniorFrontend -.->|peer invoke| CodeReviewer
    SeniorAI -.->|peer invoke| SeniorBackend
    SeniorAI -.->|peer invoke| SeniorArch
    SeniorDevOps -.->|peer invoke| SeniorSRE
    
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
| **Router** | Orchestration | Deterministic routing | — | Any | N/A (coordinator) | Selects 1 specialist; provides fallback chain |
| **Context Planner** | planning, strategy, decomposition | Pre-execution analysis | HIGH | Low | Can be invoked by any primary specialist | Mandatory context loading sequence |
| **Code Reviewer** | review, security, testing, code-quality | Review-first execution | HIGH | Low | Invoked by Implementation Guardian, Frontend, Backend for quality gates | Pre-PR readiness, security checks |
| **Implementation Guardian** | implementation, security, refactor, code-quality | Refactoring & safe coding | HIGH | Medium | Can invoke Backend, Frontend, Code Reviewer | Architecture constraint checking; test coverage mandatory |
| **Senior Backend** | backend, api, data, auth, database, migration | Backend implementation | HIGH | Medium | Can invoke Code Reviewer, SRE; invokable by Implementation Guardian | API contracts, domain logic, data handling |
| **Senior Frontend** | frontend, ui, accessibility, component, state-management | Frontend implementation | HIGH | Medium | Can invoke UI/UX, Code Reviewer; invokable by Implementation Guardian | Component design, state, accessibility, performance |
| **Senior UI/UX** | ux, ui, frontend, accessibility, design-system | UX quality | MEDIUM | Low | Invokable by Frontend, Implementation Guardian | User journeys, accessibility UX, design systems |
| **Senior SRE** | sre, reliability, observability, performance, monitoring | Operational excellence | HIGH | Low | Invokable by Implementation Guardian for observability patterns | Incident readiness, SLI/SLO, release safety |
| **Senior AI/LLM** | ai, llm, ml, inference, embeddings, rag | LLM / AI engineering | HIGH | High | Can invoke Backend for API integration, Architect for model design | Prompt engineering, RAG pipelines, model evaluation, inference optimization |
| **Senior Architect** | architecture, design, api, strategy | System design & ADRs | HIGH | Low | Consulted by any specialist for design decisions | System boundaries, ADR authoring, API contract design, scalability |
| **Senior DevOps** | devops, infrastructure, deployment, cicd, containers | Infrastructure & CI/CD | HIGH | Medium | Can invoke SRE for observability; invokable by Backend/Frontend for deploy | CI/CD pipelines, containerisation, IaC, release management |

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
    F -->|AI / LLM / RAG| K["→ Senior AI/LLM"]
    F -->|System design / ADR| L["→ Senior Architect"]
    F -->|CI/CD / infra / deploy| M["→ Senior DevOps"]
    F -->|Multiple domains| N["→ Implementation Guardian<br/>+ peer invocation"]
    
    style C fill:#e8f5e9
    style D fill:#e8f5e9
    style E fill:#ffe0b2
    style G fill:#f3e5f5
    style H fill:#fce4ec
    style I fill:#e0f2f1
    style J fill:#e3f2fd
    style K fill:#e8eaf6
    style L fill:#fafafa
    style M fill:#f9fbe7
    style N fill:#fff3e0
```

## Peer Invocation Patterns

**Allowed (single-hop invocation only):**
- Implementation Guardian → Senior Backend (API contract clarification)
- Implementation Guardian → Senior Frontend (component integration)
- Senior Frontend → Senior UI/UX (accessibility/interaction)
- Senior Backend → Code Reviewer (quality gate)
- Senior Frontend → Code Reviewer (quality gate)
- Senior AI/LLM → Senior Backend (API integration for model endpoints)
- Senior AI/LLM → Senior Architect (model design and system boundary decisions)
- Senior DevOps → Senior SRE (observability and reliability validation)
- Any specialist → Context Planner (context reload)

**Not allowed:**
- Chains (A → B → C)
- Circular dependencies (A → B → A)
- Multiple peers (A → B and A → C simultaneously)
- SRE → Implementation changes (use Implementation Guardian for file edits)

## Token Budget Allocation by Risk Level

| Risk Level | Recommended Token Tier | Suitable Specialists |
|---|---|---|
| LOW | Any (optimize for speed) | Context Planner, Code Reviewer, UI/UX, Architect, SRE |
| LOW–MEDIUM | Low–Medium | Code Reviewer, UI/UX, (any low-risk domain) |
| MEDIUM | Medium | Backend, Frontend, Implementation Guardian, DevOps |
| MEDIUM–HIGH | Medium–High | Backend, Frontend, SRE, Implementation Guardian, DevOps, AI/LLM |
| HIGH–CRITICAL | High (explicit confirmation) | AI/LLM, Implementation Guardian + peer if needed |

---

**See:** [AGENT_ORCHESTRATION.md](AGENT_ORCHESTRATION.md) for routing rules and fallback chains.
