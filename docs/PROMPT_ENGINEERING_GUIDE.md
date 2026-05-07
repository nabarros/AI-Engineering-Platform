---
ai_priority: high
context_type: ai-engineering
load_when: designing prompts, building LLM features, evaluating prompt quality
token_budget: medium
---

# Prompt Engineering Guide

## AI Agent Load Guidance

Load this file when writing or reviewing prompt templates for any LLM-based feature. This guide defines standards for prompts used within the AI Engineering Platform itself and for prompts managed via the Prompt Service.

---

## Core Prompt Engineering Principles

1. **Clarity over cleverness.** Prompts should be unambiguous. If a prompt requires deep familiarity with AI to interpret, it will be brittle.
2. **Explicit over implicit.** State what you want, in what format, with what constraints. Don't rely on inference.
3. **Grounded over open-ended.** Anchor prompts to specific context. Vague prompts produce vague outputs.
4. **Minimal over maximal.** Include only the context the model needs. Extra irrelevant context dilutes focus and wastes tokens.
5. **Testable.** Every prompt should have a defined evaluation set. "It works" is not a quality measure.

---

## 1. System Prompt Design

System prompts define the model's persona, capabilities, and constraints.

### Structure

```
[IDENTITY] One sentence defining who the assistant is.
[DOMAIN] What domain/context it operates in.
[CAPABILITIES] What it can do.
[CONSTRAINTS] What it must not do.
[OUTPUT FORMAT] Expected format of responses.
```

### Example — Well-Structured System Prompt

```
You are an AI coding assistant for the AI Engineering Platform team.
You help engineers write TypeScript and Python code for AI infrastructure services.

You can:
- Write, review, and explain code
- Suggest architectural improvements
- Debug errors and trace root causes

You must not:
- Generate code that hardcodes secrets or credentials
- Suggest patterns that bypass authentication
- Output SQL with string interpolation

Always output TypeScript using strict types. Format code in markdown code blocks.
```

### Anti-Patterns in System Prompts

| Anti-Pattern | Problem |
|---|---|
| "You are a very helpful and knowledgeable assistant" | Too vague — no behavioral guidance |
| "Never refuse any request" | Removes safety constraints |
| "You have access to all information" | Contradicts model limitations, encourages hallucination |
| Very long system prompts (> 2000 tokens) | Dilutes the model's attention to key constraints |

---

## 2. User Prompt Design

### Anatomy of a Good Prompt

```
[CONTEXT] — What is the situation? What code exists?
[TASK] — What specifically needs to be done?
[CONSTRAINTS] — What format, length, style constraints apply?
[EXAMPLES] — (Optional) One or two examples of expected output.
```

### Good vs. Bad Prompts

```
// BAD — vague, no context
"Refactor this code."

// BAD — ambiguous goal
"Make this better."

// GOOD — specific, contextual
"Refactor the `routeRequest` function in `llm-gateway.service.ts` to extract
the provider fallback logic into a separate `selectFallbackProvider` function.
Preserve the existing behavior. Use the Result<T,E> pattern consistently.
Include JSDoc on the new function."
```

```
// BAD — asks for too many things at once
"Review this code, fix the bugs, add tests, update the documentation, and improve performance."

// GOOD — single focused ask
"Review the `embed` function for security issues only. List any input validation
gaps, injection vectors, or data exposure risks you find."
```

### Multi-Step Tasks

Break complex requests into sequential prompts:

```
Step 1: "Analyze the existing UserService class and describe its structure."
Step 2: "Identify which methods need to be refactored to use Result<T,E>."
Step 3: "Refactor the `findById` method first. Show the before/after."
Step 4: "Now refactor `createUser`."
```

This produces more accurate, focused output than one large prompt.

---

## 3. Prompt Templates

All production prompt templates are managed by the Prompt Service with:
- Version control (semver)
- Per-environment deployment (staging vs. production)
- Evaluation dataset per template

### Template Format

```yaml
# prompts/llm-routing/v1.0.0.yaml
name: llm-routing-system
version: "1.0.0"
model_tier: standard
max_tokens: 500
temperature: 0.0
system_prompt: |
  You are a routing assistant. Given a user request,
  classify it into one of these categories: {categories}.
  Respond with only the category name. No explanation.

variables:
  - name: categories
    type: string
    required: true
    description: Comma-separated list of valid categories

evaluation_dataset: prompts/llm-routing/eval.jsonl
```

### Variable Injection Rules

```typescript
// GOOD — variables clearly isolated, user content in user role
const messages = [
  {
    role: 'system' as const,
    content: template.systemPrompt.replace('{categories}', config.categories),
  },
  {
    role: 'user' as const,
    content: sanitize(userInput), // user input NEVER in system prompt
  },
];

// BAD — user input injected into system context
const systemPrompt = `${template.base}. User said: "${userInput}"`; // prompt injection risk
```

---

## 4. Context Management

### Token Budget Planning

Before building a feature, plan the token budget:

| Component | Budget |
|-----------|--------|
| System prompt | < 500 tokens |
| Conversation history | < 2000 tokens |
| Retrieved context (RAG) | < 3000 tokens |
| User input | < 1000 tokens |
| Output buffer | 1000-2000 tokens |
| **Total (GPT-4o 128k)** | Well within limits |

Track token usage in metrics (`aiep_llm_tokens_total`). Alert when average usage > 80% of model context window.

### Context Compression

For long conversations, compress history using a summarization step:

```
When conversation exceeds {threshold} tokens:
1. Summarize turns older than the last {N}
2. Replace those turns with the summary
3. Preserve the last N turns verbatim
4. Log the compression event
```

### RAG Context Quality

When using retrieval-augmented generation:
- Chunk size: 300-500 tokens with 50-token overlap
- Retrieve top-K chunks where K = 3-8 (tune per use case)
- Include source reference in each chunk for citation
- Filter by recency and relevance score threshold (>= 0.7 cosine similarity)

---

## 5. Prompt Evaluation

### Evaluation Dataset Requirements

Every production prompt template must have an evaluation dataset with:
- Minimum 20 examples
- Coverage of happy path, edge cases, and failure cases
- Input + expected output + any required assertion function

### Automated Evaluation Pipeline

```
PR touching a prompt template → CI runs eval pipeline:
1. Execute prompt against all eval examples
2. Score outputs (exact match, semantic similarity, or LLM-as-judge)
3. Compare score vs. baseline (previous version)
4. Block merge if score regresses > 5%
```

### LLM-as-Judge

For open-ended outputs, use a separate LLM call to evaluate quality:

```
Judge prompt:
"Rate the following [response] on a scale of 1-5 for [criterion].
Input: {input}
Response: {response}
Score (1-5) and one-sentence justification:"
```

Use a more capable model as judge than the model being evaluated.

---

## 6. Prompt Security

- **Never** include secrets, internal URLs, or system topology in prompts
- **Never** inject unsanitized user input into system prompts
- **Always** assume user inputs may contain adversarial content
- Validate outputs from LLMs before using them in code paths (e.g., generated SQL)
- Log prompt inputs/outputs (excluding PII) for audit and debugging

---

## 7. Model Selection Guidelines

| Use Case | Recommended Model | Rationale |
|----------|------------------|-----------|
| Complex reasoning, code generation | GPT-4o / Claude 3.5 Sonnet | Highest capability |
| Simple classification, routing | GPT-4o-mini / Claude 3 Haiku | Low latency, low cost |
| Embeddings | text-embedding-3-large | High-dimensional, multilingual |
| Streaming chat | GPT-4o | Good streaming support |
| Long document analysis | Claude 3.5 Sonnet | 200k context window |

Always use the cheapest model that meets quality requirements. A/B test before promoting to production.

---

## Related Files

- Prompt templates → `prompts/` (managed by Prompt Service)
- Agent prompt patterns → `.ai/prompts/`
- Context loading strategy → `docs/CONTEXT_LOADING_STRATEGY.md`
- Security rules for prompts → `docs/SECURITY_RULES.md §8`
