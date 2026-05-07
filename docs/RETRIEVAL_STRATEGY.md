---
ai_priority: high
context_type: ai-engineering
load_when: setting up AI-assisted workflows, optimizing AI agent performance, debugging retrieval quality
token_budget: low
---

# Retrieval Strategy

## AI Agent Load Guidance

Load this file when building or debugging the retrieval layer for AI features, or when optimizing how AI agents find relevant context in the codebase.

---

## Retrieval Design Principles

1. **Semantic retrieval supplements exact search** — use both; don't replace one with the other
2. **Chunk at meaning boundaries** — function, class, or section level; not arbitrary character counts
3. **Metadata is as important as content** — file path, last modified, owner, and type guide relevance scoring
4. **Freshness matters** — stale context causes hallucinations; index freshness must be maintained
5. **Context locality** — code near the task site is more relevant than distant code

---

## 1. AI Agent Context Retrieval

### For Code Editing Tasks

When an AI agent needs to find relevant code:

**Priority order:**

1. **Exact match** — Search for the specific function, class, or variable name
2. **File path match** — Search for files in the relevant module directory
3. **Symbol search** — Find callers/implementors of an interface or base class
4. **Semantic search** — Natural language description of the concept
5. **Full-text grep** — Pattern matching for specific idioms

```
// Search strategy for "modify the LLM routing logic"
1. Exact: grep -r "routeRequest\|RouteRequest\|route_request" src/
2. File:  find src/ -name "*routing*" -o -name "*gateway*"
3. Symbol: find usages of IProviderSelector interface
4. Semantic: "provider selection, fallback, LLM routing"
5. Full-text: grep -r "provider.*fallback\|selectProvider" src/
```

### Chunking Strategy for Vector Index

When indexing the codebase for semantic search:

| Content Type | Chunk Strategy | Overlap |
|---|---|---|
| TypeScript functions | Whole function body + JSDoc | 1 line above/below |
| TypeScript classes | Class signature + each method separately | Class header in each chunk |
| Python functions | Whole function + docstring | 1 line above/below |
| Markdown sections | H2 or H3 section | Previous heading |
| OpenAPI spec | Per-endpoint definition | Shared components repeated |
| SQL migrations | Per-migration file | None |

**Target chunk size:** 300-500 tokens. Larger chunks preserve more context; smaller chunks enable more precise retrieval.

### Metadata Schema

Every indexed chunk must have metadata:

```json
{
  "filePath": "src/services/llm-gateway/routing.service.ts",
  "chunkType": "function",
  "symbolName": "routeRequest",
  "language": "typescript",
  "lastModified": "2024-01-15T10:30:00Z",
  "owner": "ai-infrastructure",
  "tags": ["llm", "routing", "provider-selection"],
  "lineRange": [45, 87]
}
```

---

## 2. RAG Pipeline (Production Features)

For AI features that use retrieval-augmented generation (e.g., the knowledge base Q&A):

### Retrieval Configuration

```typescript
const retrievalConfig = {
  topK: 5,                        // number of chunks to retrieve
  scoreThreshold: 0.72,           // minimum cosine similarity
  rerankEnabled: true,            // use cross-encoder reranking
  hybridSearchAlpha: 0.7,         // 0 = BM25 only, 1 = vector only, 0.7 = balanced
  maxContextTokens: 3000,         // total token budget for retrieved chunks
  deduplicateByFile: true,        // limit chunks per source file
  maxChunksPerFile: 2,
};
```

### Retrieval Pipeline

```
1. User query
       ↓
2. Query expansion (optional) — generate search variants
       ↓
3. Hybrid retrieval — BM25 keyword + vector similarity
       ↓
4. Initial candidates (top K * 3)
       ↓
5. Reranking with cross-encoder model
       ↓
6. Score filtering (>= threshold)
       ↓
7. Deduplication by source
       ↓
8. Context assembly — inject into prompt with citations
       ↓
9. LLM generation
       ↓
10. Citation extraction — link generated claims to source chunks
```

### Query Expansion

For short or ambiguous queries, expand before retrieval:

```typescript
async function expandQuery(query: string): Promise<string[]> {
  // Generate 3 reformulations of the query
  const response = await llm.complete({
    system: 'Generate 3 search queries that would find information relevant to the user question.',
    user: query,
    responseFormat: { type: 'json', schema: { queries: z.array(z.string()).length(3) } },
  });
  return [query, ...response.queries];
}
```

---

## 3. Codebase Indexing

### What to Index

| Include | Exclude |
|---------|---------|
| `src/**/*.ts`, `src/**/*.py` | `node_modules/`, `.venv/` |
| `docs/**/*.md` | `dist/`, `build/` |
| `tests/**/*.ts` (for pattern discovery) | `*.lock` files |
| `.ai/skills/**/*.md` | `.ai/memory/**` (too dynamic) |
| `migrations/**/*.sql` | `*.min.js`, bundled assets |

### Index Freshness

- Triggered on every merge to `main`
- Incremental update: re-index only changed files
- Full re-index: weekly, or on major refactors
- Staleness alert: if index is > 24 hours behind `main`

### Repository Graph Awareness

Beyond text retrieval, maintain a dependency graph for:
- Function call graphs (who calls what)
- Import/export maps (what depends on what)
- Schema relationships (tables → services)

Use this graph to identify blast radius before refactors:

```
"What code will be affected if I change the signature of routeRequest?"
→ Graph query: find all callers of routeRequest
→ Returns: llm-gateway.handler.ts, integration.test.ts, gateway.spec.ts
```

---

## 4. Skill File Retrieval

Skills (`.ai/skills/`) are retrieved deterministically by task classification, not semantically:

```typescript
const SKILL_MAP: Record<TaskDomain, string[]> = {
  frontend: ['.ai/skills/react-patterns.md'],
  api: ['.ai/skills/api-design.md', 'docs/API_CONVENTIONS.md'],
  database: ['.ai/skills/database-patterns.md', 'docs/DATABASE_CONVENTIONS.md'],
  testing: ['.ai/skills/testing-jest.md', 'docs/TESTING_STRATEGY.md'],
  auth: ['.ai/skills/auth-patterns.md', 'docs/SECURITY_RULES.md'],
  refactoring: ['.ai/skills/refactoring-rules.md'],
  migration: ['.ai/skills/migration-strategy.md'],
  performance: ['.ai/skills/performance-optimization.md'],
  debugging: ['.ai/skills/debugging-node.md'],
};
```

This deterministic mapping is intentional: skill retrieval should be predictable and repeatable, not probabilistic.

---

## 5. Quality Metrics for Retrieval

Track these metrics via the AI Observability service:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Retrieval relevance | > 80% user-judged relevant | Thumbs up/down feedback |
| Answer grounding | > 90% citations verifiable | Automated citation check |
| Retrieval latency P95 | < 200ms | System metric |
| Context utilization | 60-80% of budget used | Token tracking |
| Empty retrieval rate | < 5% | Null result tracking |

---

## Related Files

- Context loading strategy → `docs/CONTEXT_LOADING_STRATEGY.md`
- Vector Store service → `docs/ARCHITECTURE.md` (vector-store section)
- Prompt engineering → `docs/PROMPT_ENGINEERING_GUIDE.md`
- Chunking implementation → `.ai/context/chunking-guide.md`
