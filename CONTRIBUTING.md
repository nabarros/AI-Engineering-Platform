# Contributing to AI Engineering Platform

---

## Before You Start

1. Read `AGENT_GUIDE.md` if you are an AI agent
2. Read `docs/ENGINEERING_STANDARDS.md` for code standards
3. Read `docs/CODE_STYLE.md` for formatting conventions
4. Understand the architecture in `docs/ARCHITECTURE.md`

---

## Development Workflow

### 1. Branch Naming

```
feature/<short-description>          # new features
fix/<issue-id>-<short-description>   # bug fixes
chore/<short-description>            # maintenance
refactor/<short-description>         # refactoring
docs/<short-description>             # documentation only
```

### 2. Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): add OAuth2 PKCE flow
fix(api): return 422 on malformed input instead of 500
chore(deps): upgrade fastify to 4.28
refactor(user-service): extract email validation to shared util
docs(api): update OpenAPI spec for /users endpoint
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`

### 3. Pre-Commit Checklist

Before pushing:

- [ ] `pnpm lint` passes (or `ruff check .` / `black --check .` for Python)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] New features have tests
- [ ] Bug fixes have regression tests
- [ ] No hardcoded secrets or environment-specific values
- [ ] Public API changes are reflected in OpenAPI spec
- [ ] Relevant `docs/` files updated if behavior changed

### 4. Pull Request Requirements

Every PR must have:
- Clear title following commit convention
- Description explaining *what* and *why* (not just *what*)
- Link to related issue (`Closes #123`)
- Test evidence (CI passing, or manual test steps for UI changes)

Use the PR template in `.ai/templates/pr-description.md`.

**PR size guidance:**
- Keep PRs focused on a single concern
- Large features should be broken into incremental PRs
- Prefer small, reviewable PRs over large batches

### 5. Code Review Expectations

**As an author:**
- Respond to all review comments
- Don't resolve comments — let the reviewer resolve them after your response
- If you disagree with a comment, explain why constructively

**As a reviewer:**
- Review within 1 business day for `priority:high` PRs
- Distinguish between blocking issues and suggestions
- Prefix suggestions with `nit:` or `optional:` to indicate non-blocking
- Use the PR review playbook in `.ai/playbooks/pr-review.md`

### 6. Merging

- Squash-merge into `main` for feature branches
- No direct pushes to `main` or `release/*`
- CI must be green before merge
- At least 1 approval required; 2 approvals for architecture changes

---

## Architecture Decisions

For significant architectural changes:
1. Create an ADR using `.ai/templates/adr.md`
2. Post the ADR for team review before implementation
3. Once approved, record in `docs/DECISION_LOG.md`
4. Update `.ai/memory/current-architecture.md` after implementation

---

## Local Development Setup

```bash
# Clone and install
git clone <repo-url>
pnpm install

# Start dependencies
docker compose up -d  # postgres, redis, weaviate, kafka

# Environment setup
cp .env.example .env
# Fill in local secrets — never commit .env

# Start services
pnpm dev              # TypeScript services
uv run uvicorn src/ml/main:app --reload  # Python services

# Run tests
pnpm test             # Unit tests
pnpm test:integration # Integration tests (requires Docker)
pnpm test:e2e         # End-to-end tests
```

---

## Questions and Escalation

- Architecture questions → `#architecture` Slack channel
- Security concerns → `#security` channel (not public issues)
- Urgent production issues → `#incidents` channel + PagerDuty
- General questions → GitHub Discussions
