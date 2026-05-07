---
ai_priority: high
context_type: governance
load_when: writing code, PR review, evaluating patterns
token_budget: low
---

# Code Style

## AI Agent Load Guidance

Load this file when generating code to match workspace style. Linters enforce most of these rules automatically — this file explains the *why* behind the rules.

---

## TypeScript / JavaScript

### Naming Conventions

| Symbol | Convention | Example |
|--------|-----------|---------|
| Classes | PascalCase | `LlmGatewayService` |
| Types | PascalCase | `InferenceRequest` |
| Interfaces | PascalCase | `IProviderClient` |
| Enums | PascalCase (values UPPER_SNAKE_CASE) | `ModelTier.PREMIUM` |
| Functions | camelCase | `selectProvider()` |
| Variables | camelCase | `activeRequests` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Files | kebab-case | `llm-gateway.service.ts` |
| Test files | same as source + `.test` | `llm-gateway.service.test.ts` |
| React components | PascalCase file | `PromptEditor.tsx` |

### Imports

Organize imports in this order (separated by blank lines):

```typescript
// 1. Node built-ins
import { readFile } from 'node:fs/promises';

// 2. External packages
import Fastify from 'fastify';
import { z } from 'zod';

// 3. Internal packages (workspace packages)
import { logger } from '@aiep/logger';

// 4. Relative imports (most distant to most local)
import { ProviderRegistry } from '../providers/registry';
import { InferenceRequest } from './types';
```

Use `node:` prefix for Node.js built-ins.

### Formatting Rules

Enforced by Prettier (`.prettierrc`):

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### Variable Declarations

- Use `const` by default
- Use `let` only when reassignment is necessary
- Never use `var`

### Functions

- Prefer named functions over anonymous functions for top-level declarations
- Arrow functions for callbacks and short expressions
- Avoid default parameter values that mutate shared objects

```typescript
// GOOD — named, explicit
function calculateTokenCost(tokens: number, model: Model): number {
  return tokens * model.costPerToken;
}

// GOOD — arrow for callbacks
const costs = requests.map((r) => calculateTokenCost(r.tokenCount, r.model));

// BAD — implicit mutation risk
function addTag(tags: string[] = []) { // shared reference risk
  tags.push('default');
  return tags;
}
```

### String Formatting

- Use template literals for multi-word string composition
- String concatenation only for single-value appending
- No multi-line string concatenation — use template literals

### Async / Await

- Always `await` async operations — no floating promises
- `void` operator only for intentionally unhandled fire-and-forget (log the reason in a comment)
- Avoid mixing `async/await` with `.then()/.catch()` in the same code path

---

## Python

### Formatting

Enforced by Black (`pyproject.toml`):

```toml
[tool.black]
line-length = 100
target-version = ["py312"]
```

### Linting

Enforced by Ruff:

```toml
[tool.ruff]
line-length = 100
select = ["E", "W", "F", "I", "N", "UP", "ASYNC", "S", "B", "ANN"]
```

### Naming Conventions

| Symbol | Convention | Example |
|--------|-----------|---------|
| Classes | PascalCase | `AgentRuntime` |
| Functions / methods | snake_case | `execute_workflow()` |
| Variables | snake_case | `active_agents` |
| Constants | UPPER_SNAKE_CASE | `MAX_WORKFLOW_STEPS` |
| Private members | `_` prefix | `_internal_cache` |
| Files / modules | snake_case | `agent_runtime.py` |

### Class Structure

```python
class AgentRuntime:
    """One-line summary. Multi-line description if needed."""

    # Class-level constants first
    MAX_STEPS: ClassVar[int] = 100

    # Type-annotated instance attributes
    def __init__(
        self,
        config: RuntimeConfig,
        tool_registry: ToolRegistry,
    ) -> None:
        self.config = config
        self._tool_registry = tool_registry  # private
        self._active_runs: dict[str, RunContext] = {}

    # Public methods
    async def execute(self, workflow: Workflow) -> WorkflowResult: ...

    # Private methods
    async def _validate_workflow(self, workflow: Workflow) -> None: ...
```

---

## React / TSX

### Component Structure

```tsx
// 1. Type definitions (props, etc.)
type PromptEditorProps = {
  promptId: string;
  onSave: (content: string) => void;
  readOnly?: boolean;
};

// 2. Component function (named, not arrow for top-level)
function PromptEditor({ promptId, onSave, readOnly = false }: PromptEditorProps) {
  // 3. Hooks first (in dependency order)
  const [content, setContent] = useState('');
  const { data, isLoading, error } = usePrompt(promptId);

  // 4. Derived state / memos
  const isDirty = content !== data?.content;

  // 5. Effects
  useEffect(() => {
    if (data) setContent(data.content);
  }, [data]);

  // 6. Event handlers
  function handleSave() {
    onSave(content);
  }

  // 7. Conditional returns (loading, error states)
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error.message} />;

  // 8. Main render
  return (
    <div className={styles.editor}>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      {isDirty && <SaveButton onClick={handleSave} disabled={readOnly} />}
    </div>
  );
}

// 9. Export at bottom
export { PromptEditor };
```

### Props

- Destructure props at the function signature level
- Use explicit `undefined` check over optional chaining when behavior differs
- Avoid prop drilling more than 2 levels — use context or state manager

---

## SQL

- All keywords in UPPERCASE: `SELECT`, `FROM`, `WHERE`, `JOIN`
- Table and column names in `snake_case`
- Aliases that are readable: `u` for `users`, `p` for `prompts`
- Parameterized queries always — no string interpolation

```sql
-- GOOD
SELECT u.id, u.email, p.name AS plan_name
FROM users u
JOIN plans p ON u.plan_id = p.id
WHERE u.id = $1
  AND u.deleted_at IS NULL;

-- BAD
SELECT * FROM users WHERE id = '${userId}'
```

---

## Markdown / Documentation

- One sentence per line (improves diffs)
- H1 only once per document (the document title)
- H2 for major sections, H3 for subsections, H4 sparingly
- Code blocks with language identifiers always
- Tables for structured comparisons
- Never use bare URLs inline — use `[label](url)` format

---

## Anti-Patterns Reference

| Pattern | Why Forbidden |
|---------|--------------|
| Nested ternaries | Unreadable, hard to debug |
| `any` without comment | Bypasses type safety |
| Magic numbers | Cannot be maintained |
| Deeply nested callbacks | Async/await exists |
| Single-letter loop variables (except `i`, `j` in trivial loops) | Unclear scope |
| Exporting mutable state | Hidden side effects |
| `Boolean(x)` over `!!x` | Prefer explicit `Boolean()` — it's clearer |
