---
ai_priority: tier-3
context_type: glossary
load_when: ai-ml-concepts, model-integration, embedding-work, rag-implementation
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# AI/ML Terminology

Concepts used in AIEP with platform-specific usage notes.

---

## Core LLM Concepts

**Token** — The unit of text an LLM processes. Roughly 1 token ≈ 0.75 words in English. AIEP tracks `input_tokens` and `output_tokens` per request in `UsageRecord`.

**Context Window** — Maximum number of tokens an LLM can process in a single request (input + output combined). GPT-4o: 128,000 tokens. Used by llm-gateway to validate requests before forwarding.

**Temperature** — Sampling randomness parameter (0.0–2.0). `0.0` = deterministic, `2.0` = most random. AIEP default: `0.2` for structured outputs, `0.7` for creative tasks.

**System Prompt** — Instructions to the model that appear before user messages. In AIEP, system prompts come from `PromptVersion.content`; they are controlled and versioned. User input is always in the `user` role, never in `system`.

**Completion** — The LLM's response to a prompt. In AIEP: `InferenceResponse.content`.

**Function Calling / Tool Use** — LLM capability to request external function execution. AIEP agents use this via agent-runtime's tool dispatch mechanism.

**Hallucination** — LLM generating plausible but incorrect information. Mitigated in AIEP via RAG (grounding in retrieved documents) and structured output schemas.

**Streaming** — Returning LLM tokens incrementally as generated, rather than waiting for full completion. Enabled by `llm-gateway.streaming` feature flag. Reduces time-to-first-token.

---

## Embeddings and Vector Search

**Embedding** — A numeric vector representation of text that captures semantic meaning. AIEP uses OpenAI `text-embedding-3-small` (1536 dimensions) for all document and query embeddings.

**Vector Database** — A database optimized for storing and querying embeddings by similarity. AIEP uses Weaviate 1.24.

**Cosine Similarity** — Distance metric used for embedding comparisons. Values range from -1 (opposite) to 1 (identical). Weaviate default. AIEP semantic cache threshold: `0.95`.

**HNSW** — Hierarchical Navigable Small World. The vector index algorithm used by Weaviate in AIEP. Optimized for approximate nearest neighbor search. Config: `efConstruction=128`, `maxConnections=64`.

**ANN (Approximate Nearest Neighbor)** — Search algorithm that finds similar vectors without scanning all vectors. Used for RAG retrieval and semantic caching.

---

## Retrieval-Augmented Generation (RAG)

**RAG** — A technique that retrieves relevant documents from a vector store and includes them in the prompt as context, grounding LLM responses in factual content.

**Chunking** — Splitting documents into segments (chunks) for indexing. AIEP default: 512 tokens with 50-token overlap. See `.ai/context/chunking-guide.md`.

**Document Chunk** — A segment of a document stored as a vector embedding in Weaviate. The unit of retrieval.

**MMR (Maximal Marginal Relevance)** — A reranking strategy that balances relevance and diversity in retrieved results. Used in AIEP's RAG pipeline to avoid returning duplicate chunks.

**Hybrid Search** — Combining dense (vector) and sparse (keyword/BM25) retrieval for better recall. Weaviate supports this natively; planned for AIEP in Sprint 28.

**Grounding** — Including retrieved factual context in the LLM prompt to reduce hallucination. The primary purpose of RAG in AIEP.

---

## Agent Concepts

**Agent** — An AI system that uses an LLM to plan and execute multi-step tasks by calling tools. In AIEP, agents are defined as workflows and executed by agent-runtime.

**DAG (Directed Acyclic Graph)** — A graph structure with no cycles used to represent agent workflow steps and their dependencies.

**Tool** — A function an agent can invoke to interact with external systems. In AIEP: declared in `WorkflowDefinition.allowed_tools[]`.

**ReAct Pattern** — Reasoning + Acting loop: (Thought → Action → Observation) × N → Final Answer. The reasoning pattern used by AIEP agent workflows.

**Context Injection** — Providing relevant retrieved documents to the LLM as part of the prompt. In AIEP, done by vector-store-service before forwarding to llm-gateway.

---

## AIEP-Specific Usage

| Term | AIEP Meaning |
|---|---|
| "model tier" | `standard` / `premium` / `custom` routing class |
| "provider" | OpenAI or Anthropic (external LLM API) |
| "gateway request" | A single call through llm-gateway with prompt resolution |
| "eval run" | Automated scoring of a PromptVersion against an EvalSet |
| "semantic hit" | A cache hit in the llm-gateway semantic cache (cosine similarity ≥ 0.95) |

---

## Related Files

- `.ai/glossary/domain-glossary.md` — platform domain terminology
- `docs/DOMAIN_GLOSSARY.md` — full glossary
- `.ai/context/chunking-guide.md` — chunking implementation
- `.ai/architecture/data-flow.md` — RAG retrieval flow diagram
