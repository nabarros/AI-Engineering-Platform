# AI Engineering Platform

> Enterprise-grade platform for building, orchestrating, and operating AI-powered services at scale.

---

## AI Agent: Load Context in This Order

If you are an AI coding agent, load context in this exact sequence before taking any action:

```
1. .ai/instructions/instruction-hierarchy.md    ← governance rules (ALWAYS first)
2. .ai/instructions/global-rules.md             ← non-negotiable rules
3. .ai/instructions/ai-agent-operating-rules.md ← execution protocol
4. .ai/memory/current-architecture.md           ← current system state
5. .ai/memory/active-work.md                    ← what's in-flight
6. .ai/memory/known-issues.md                   ← known pitfalls
7. [task-relevant skill from .ai/skills/]       ← load only what's needed
```

Do NOT load the entire repository context. Load only what is relevant to your current task.

---

## What This Repository Is

The AI Engineering Platform (AIEP) is a production-grade system for:

- Orchestrating AI workflows across multiple LLM providers
- Managing prompt versioning, evaluation, and deployment
- Providing AI observability: latency, cost, accuracy, drift detection
- Enabling multi-agent pipelines with coordination primitives
- Serving as the internal AI platform for engineering teams

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local development environment
docker compose up -d
pnpm dev

# Run test suite
pnpm test

# Check types
pnpm typecheck

# Lint
pnpm lint
```

**Prerequisites:** Node.js ≥ 20, Docker, pnpm ≥ 9

---

## Repository Structure

```
.ai/                AI agent operational system
  instructions/     Governance rules and hierarchy
  skills/           Reusable AI coding capabilities
  memory/           Living project state
  architecture/     System design documents
  playbooks/        Operational runbooks
  prompts/          Reusable prompt templates
  templates/        Document templates (ADR, PR, etc.)
  context/          Context engineering guides
  product/          Product context and domain model
  testing/          Test patterns and standards
  security/         Security rules and checklists
  deployment/       Deployment and rollback guides
  glossary/         Domain and AI terminology

docs/               Human-readable technical documentation
src/                Application source code
tests/              Test suites
infra/              Infrastructure as code (Terraform, Helm)
scripts/            Build and operational scripts
.github/            GitHub Actions CI/CD + Copilot configuration
```

---

## Documentation Index

### Entry Points for AI Agents

| File | Purpose | Load When |
|------|---------|-----------|
| [AGENT_GUIDE.md](./AGENT_GUIDE.md) | Complete AI agent onboarding | Every agent session |
| [COPILOT_INSTRUCTIONS.md](./COPILOT_INSTRUCTIONS.md) | GitHub Copilot-specific guidance | Copilot sessions |
| [CLAUDE.md](./CLAUDE.md) | Claude Code-specific guidance | Claude sessions |

### Architecture

| File | Purpose |
|------|---------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture overview |
| [docs/SYSTEM_OVERVIEW.md](./docs/SYSTEM_OVERVIEW.md) | End-to-end system map |
| [.ai/architecture/system-design.md](./.ai/architecture/system-design.md) | Detailed system design |
| [.ai/architecture/component-map.md](./.ai/architecture/component-map.md) | Service and component registry |

### Engineering Standards

| File | Purpose |
|------|---------|
| [docs/ENGINEERING_STANDARDS.md](./docs/ENGINEERING_STANDARDS.md) | Core engineering standards |
| [docs/CODE_STYLE.md](./docs/CODE_STYLE.md) | Code style guide |
| [docs/API_CONVENTIONS.md](./docs/API_CONVENTIONS.md) | REST and GraphQL conventions |
| [docs/DATABASE_CONVENTIONS.md](./docs/DATABASE_CONVENTIONS.md) | Database patterns and standards |
| [docs/ERROR_HANDLING.md](./docs/ERROR_HANDLING.md) | Error handling patterns |

### Quality and Operations

| File | Purpose |
|------|---------|
| [docs/TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md) | Testing philosophy and requirements |
| [docs/SECURITY_RULES.md](./docs/SECURITY_RULES.md) | Security rules and OWASP compliance |
| [docs/PERFORMANCE_GUIDELINES.md](./docs/PERFORMANCE_GUIDELINES.md) | Performance budgets and patterns |
| [docs/OBSERVABILITY.md](./docs/OBSERVABILITY.md) | Logging, metrics, tracing standards |
| [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) | Deployment procedures |

### AI-Specific Documentation

| File | Purpose |
|------|---------|
| [docs/AI_AGENT_RULES.md](./docs/AI_AGENT_RULES.md) | Agent governance (human-readable summary) |
| [docs/PROMPT_ENGINEERING_GUIDE.md](./docs/PROMPT_ENGINEERING_GUIDE.md) | Prompt design standards |
| [docs/CONTEXT_LOADING_STRATEGY.md](./docs/CONTEXT_LOADING_STRATEGY.md) | When and how to load context |
| [docs/RETRIEVAL_STRATEGY.md](./docs/RETRIEVAL_STRATEGY.md) | Semantic and keyword retrieval patterns |

### Product and Domain

| File | Purpose |
|------|---------|
| [docs/PRODUCT_CONTEXT.md](./docs/PRODUCT_CONTEXT.md) | Product goals and user personas |
| [docs/DOMAIN_GLOSSARY.md](./docs/DOMAIN_GLOSSARY.md) | Domain terminology |
| [docs/DECISION_LOG.md](./docs/DECISION_LOG.md) | Architectural decision history |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow, PR process, and code review guidelines.
