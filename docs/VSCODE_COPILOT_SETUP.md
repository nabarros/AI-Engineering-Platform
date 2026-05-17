# VS Code + GitHub Copilot Setup Guide (AI Engineering Platform)

This guide configures Visual Studio Code so GitHub Copilot can use the full AI Engineering Platform customization stack in this repository:

- `.ai/` for governance, memory, and domain patterns
- `.github/agents/` for specialist agents
- `.github/skills/` for reusable workflows
- `.github/prompts/` for slash prompts
- `.github/instructions/` for bridge rules
- `.github/hooks/` for deterministic guardrails

---

## 1. Prerequisites

1. Install Visual Studio Code (latest stable).
2. Ensure your GitHub account has an active Copilot entitlement.
3. Install required local tooling for this repository:
   - Node.js 20+
   - pnpm 9+
   - Docker
4. Clone the repository and open it in VS Code.

---

## 2. Install Required VS Code Extensions

Install these extensions from the marketplace:

1. GitHub Copilot (`GitHub.copilot`)
2. GitHub Copilot Chat (`GitHub.copilot-chat`)

Optional but recommended:

1. ESLint
2. Prettier
3. Python
4. Ruff (or equivalent Python linting support)

---

## 3. Sign In and Validate Copilot Access

1. Open Command Palette.
2. Run `GitHub Copilot: Sign In`.
3. Complete browser authentication.
4. Open Copilot Chat and verify it responds.

If you do not see responses, re-run sign-in and confirm organization policy allows Copilot Chat.

---

## 4. Open the Correct Workspace Root

1. Use `File -> Open Folder...`.
2. Select `AI-Engineering-Platform` as the root folder.
3. Ensure `.ai/` and `.github/` are visible in Explorer.

The custom agents/skills/prompts in `.github/` are workspace-scoped; opening the wrong folder prevents discovery.

---

## 5. Trust the Workspace

1. If prompted, choose `Trust` for this repository.
2. Keep Restricted Mode disabled for this trusted project.

Without trust, scripts and some customization behaviors may be blocked.

---

## 6. Confirm Customization Assets Exist

Verify these paths are present:

1. `.github/copilot-instructions.md`
2. `.github/instructions/aiep-ai-bridge.instructions.md`
3. `.github/agents/`
4. `.github/skills/`
5. `.github/prompts/aiep-senior-staff-router.prompt.md`
6. `.github/hooks/aiep-guardrails.json`
7. `.github/hooks/scripts/pretool-guardrails.cjs`

---

## 7. How Copilot Uses This Repository Model

The expected runtime model is:

1. `.github` assets are discovered by Copilot in VS Code.
2. `.github/instructions/aiep-ai-bridge.instructions.md` links Copilot behavior to `.ai` governance/memory/skills.
3. Specialist work is routed through agents in `.github/agents/`.
4. Workflow skills in `.github/skills/` standardize execution.
5. Hooks in `.github/hooks/` enforce deterministic pre-tool guardrails.

---

## 8. Use the Deterministic Specialist Router

For most tasks, start with the router prompt:

1. Open Copilot Chat.
2. Type `/` and select `aiep-senior-staff-router`.
3. Enter your task goal and expected outcome.

This prompt is wired to the deterministic router agent (`AIEP Senior Staff Router Agent`), which delegates to exactly one specialist:

1. Frontend
2. Backend
3. UI/UX
4. SRE

---

## 9. Use Skills Directly When Needed

You can run skills as slash commands:

1. `/aiep-context-bootstrap` before non-trivial implementation.
2. `/aiep-safe-implementation` for controlled code changes.
3. `/aiep-pr-readiness` before opening a PR.
4. `/aiep-memory-sync` after state-changing tasks.

---

## 10. Memory Workflow (Important)

Repository memory files are in `.ai/memory/`.

Expected behavior:

1. Core memory is loaded during context bootstrap.
2. At task completion, evaluate whether memory updates are needed.
3. Any writes to `.ai/memory/**` require explicit human confirmation.

Use `/aiep-memory-sync` to enforce this process.

---

## 11. Hook Guardrails Behavior

The pre-tool hook guardrail checks operations before tool execution.

It is designed to:

1. Block write attempts to restricted paths (for example `.ai/instructions/`, `.github/workflows/`, `infra/`, governed security docs).
2. Require explicit confirmation for writes to `.ai/memory/**`.

If a command is blocked or requires approval, follow the message in Copilot Chat and continue only after explicit confirmation.

---

## 12. Recommended Daily Flow

1. Start with `/aiep-senior-staff-router`.
2. Let the selected specialist execute the task.
3. Run `/aiep-pr-readiness`.
4. Run `/aiep-memory-sync` if system state changed.

---

## 13. Validation Checklist

Use this quick check to confirm full functionality:

1. Copilot Chat responds.
2. Slash list shows custom prompt and skills.
3. Router prompt selects a specialist agent.
4. Guardrails trigger on restricted write attempts.
5. Memory sync asks confirmation before `.ai/memory` writes.

---

## 14. Troubleshooting

### Custom prompt/skills do not appear

1. Confirm folder is opened at `AI-Engineering-Platform` root.
2. Confirm files exist under `.github/prompts` and `.github/skills`.
3. Reload VS Code window.
4. Reopen Copilot Chat.

### Agent routing is not behaving as expected

1. Use the router prompt (not a plain chat request).
2. Provide explicit acceptance criteria.
3. If multi-domain, specify dominant domain.

### Hooks are not enforced

1. Confirm `.github/hooks/aiep-guardrails.json` exists.
2. Confirm Node.js is installed and available in terminal.
3. Reload window and retry.

### Memory updates are skipped

1. Run `/aiep-memory-sync` explicitly.
2. Provide confirmation when prompted for `.ai/memory` updates.

---

## 15. Reference Files

1. `.github/copilot-instructions.md`
2. `.github/instructions/aiep-ai-bridge.instructions.md`
3. `.github/agents/aiep-senior-staff-router.agent.md`
4. `.github/prompts/aiep-senior-staff-router.prompt.md`
5. `.github/skills/aiep-context-bootstrap/SKILL.md`
6. `.github/skills/aiep-safe-implementation/SKILL.md`
7. `.github/skills/aiep-pr-readiness/SKILL.md`
8. `.github/skills/aiep-memory-sync/SKILL.md`
9. `.github/hooks/aiep-guardrails.json`
10. `.github/hooks/scripts/pretool-guardrails.cjs`

---

## 12. Connect the Router Knowledge MCP Server

The Router Knowledge MCP server lets the router agent store and retrieve routing decisions locally, saving tokens on semantically similar tasks.

### Start the server

```bash
# From the AI-Engineering-Platform directory
bash scripts/deploy-local-docker.sh --redeploy
# Or MCP only
docker compose up -d mcp
# Server listens on http://localhost:8791
```

### Register in VS Code settings

Add to `.vscode/settings.json` or your user settings JSON:

```json
{
  "mcp": {
    "servers": {
      "aiep-router-knowledge": {
        "url": "http://localhost:8791",
        "type": "http"
      }
    }
  }
}
```

### Verify the connection

Open Copilot Chat and run any router prompt. The routing report will include a `route.knowledge_hit` or `route.knowledge_miss` trace event showing whether the local store was consulted.

### Requirements

- Docker stack must be running with Weaviate and MCP (`docker compose up -d weaviate mcp` minimum).
- `OPENAI_API_KEY` must be set in `.env` for Weaviate's `text2vec-openai` vectorizer to auto-embed prompts.
- If the server is unreachable, routing proceeds normally — the knowledge store is always non-blocking.

### Disable the knowledge store

Pass `enabled: false` via the `ROUTER_KNOWLEDGE_ENABLED=false` environment variable, or leave the MCP server stopped. Routing is unaffected either way.
