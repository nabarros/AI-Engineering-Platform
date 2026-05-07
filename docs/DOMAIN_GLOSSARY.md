---
ai_priority: medium
context_type: reference
load_when: unfamiliar with domain terminology, writing documentation, reviewing PRs for correct terminology
token_budget: low
---

# Domain Glossary

## AI Agent Load Guidance

Load this file when you encounter unfamiliar terms from the AI or platform domain, or when you need to ensure consistent terminology in generated code, comments, and documentation.

---

## Platform Concepts

**AI Engineering Platform (AIEP)**
The internal platform for building, operating, and observing AI-powered features. Consists of the LLM Gateway, Prompt Service, Agent Runtime, Vector Store, Model Registry, and AI Observability components.

**LLM Gateway**
The service that routes inference requests to one or more LLM providers (OpenAI, Anthropic, etc.) with automatic failover, rate limiting, and cost tracking.

**Prompt Service**
The service managing the lifecycle of prompt templates: creation, versioning, evaluation, staging/production promotion, and A/B testing.

**Agent Runtime**
The execution environment for multi-step AI agent workflows. It runs workflow DAGs, handles tool calls, manages context windows, and provides execution tracing.

**Vector Store**
The managed service for document embeddings and semantic search. Handles ingestion, chunking, embedding generation, and hybrid retrieval.

**Model Registry**
The catalog of all AI models (provider-hosted and internal) with their metadata, capability declarations, evaluation results, and version history.

**AI Observability**
The service providing real-time analytics on AI usage: latency, cost, accuracy, token consumption, and drift detection.

**Audit Service**
Immutable, append-only log of all AI actions for compliance: who ran what prompt/model/agent, when, with what inputs and outputs.

---

## AI / LLM Concepts

**LLM (Large Language Model)**
A neural network trained on large text corpora capable of generating, transforming, and classifying text. In this platform: GPT-4o, Claude 3.5 Sonnet, and others.

**Inference**
The process of running an LLM on an input to produce an output. Also called "completion" or "generation."

**Prompt**
The input text (or structured messages) sent to an LLM. Includes system instructions, context, and user input.

**Prompt Template**
A versioned, parameterized prompt stored in the Prompt Service. Contains variables (like `{user_query}`) that are filled at runtime.

**System Prompt**
The first message in a conversation that sets the model's role, constraints, and behavior. Controlled by the platform; not user-editable.

**Token**
The basic unit of text processed by LLMs. Approximately 4 characters or 0.75 words in English. Models have context window limits measured in tokens.

**Context Window**
The maximum number of tokens an LLM can process in a single request (including input and output). For GPT-4o: 128k tokens; for Claude 3.5 Sonnet: 200k tokens.

**Temperature**
A parameter controlling output randomness. 0.0 = deterministic; 1.0 = maximum randomness. Use 0.0 for classification and code generation; higher values for creative tasks.

**Embedding**
A dense numerical vector representation of text. Similar texts have similar embeddings (measured by cosine similarity). Used for semantic search and clustering.

**RAG (Retrieval-Augmented Generation)**
A pattern where relevant documents are retrieved from a knowledge base and injected into the prompt before generation. Grounds the model's output in specific facts.

**Few-Shot Prompting**
Including examples in the prompt to demonstrate the desired output format or behavior. More reliable than zero-shot for complex output formats.

**Chain-of-Thought (CoT)**
Prompting the model to "think step by step" before answering. Improves accuracy on multi-step reasoning tasks.

**Function Calling / Tool Use**
The ability for LLMs to invoke predefined functions (tools) to take actions or retrieve information. Used extensively in the Agent Runtime.

**Agent**
An LLM paired with tools and a reasoning loop that can take multi-step actions toward a goal without step-by-step human instruction.

**Workflow / DAG**
A directed acyclic graph defining the sequence and branching logic of an agent's steps. Defined in JSON and executed by the Agent Runtime.

**Hallucination**
When an LLM generates plausible-sounding but false or fabricated information. Mitigated by grounding (RAG), constrained output formats, and evaluation.

**Grounding**
Anchoring LLM responses to specific, verified sources (retrieved documents, structured data). Reduces hallucination.

**Fine-Tuning**
Training a base model further on domain-specific data to improve performance on specific tasks. Not managed by AIEP — handled by the ML Platform team.

**Context Compression**
Reducing conversation history tokens by summarizing older turns. Used to manage long-running agent sessions within the context window limit.

**Prompt Injection**
An attack where adversarial content in user input or retrieved documents attempts to override the system prompt or change the model's behavior.

**Model Tier**
A classification of model cost/capability: `standard` (GPT-4o-mini, Haiku), `premium` (GPT-4o, Claude 3.5 Sonnet), `custom` (internal fine-tuned models).

---

## Platform Engineering Terms

**Provider**
An external LLM API provider: OpenAI, Anthropic. Abstracted by the LLM Gateway.

**Provider Fallback**
Automatic rerouting to a secondary provider when the primary returns errors or rate limits.

**Eval Set (Evaluation Dataset)**
A curated set of inputs and expected outputs used to measure prompt template quality before deployment.

**A/B Test**
Running two versions of a prompt (or model) simultaneously with traffic splitting to compare quality or performance metrics.

**Semantic Versioning**
`major.minor.patch` versioning: major = breaking change, minor = new feature, patch = backwards-compatible fix.

**Circuit Breaker**
A pattern that stops sending requests to a failing dependency for a cool-down period to prevent cascade failures.

**Canary Deployment**
Routing a small percentage of traffic to a new version before full rollout, to validate in production with limited blast radius.

**SLO (Service Level Objective)**
A target for service reliability: e.g., "99.9% of LLM requests succeed within 2 seconds."

**SLI (Service Level Indicator)**
The measured value: e.g., "actual success rate over the last 30 days."

**Error Budget**
The allowed failure percentage before an SLO is breached: `error_budget = 1 - SLO_target` (e.g., 0.1% for a 99.9% SLO).

**ADR (Architecture Decision Record)**
A short document capturing an architectural decision: context, options considered, decision made, and rationale.
