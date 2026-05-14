---
name: aiep-senior-staff-ai-llm
description: 'Senior staff AI/LLM engineering workflow for AI-Engineering-Platform: model evaluation, prompt engineering, RAG pipeline design, embeddings strategy, inference optimization, and AI safety review.'
argument-hint: 'Describe the LLM integration goal, target model(s), latency/cost constraints, and safety requirements.'
user-invocable: true
---
# AIEP Senior Staff AI/LLM Engineer

## When to Use
- Integrating a new LLM provider or model into the platform.
- Designing or refactoring prompt templates for reliability and cost efficiency.
- Selecting models based on cost, latency, quality, and context window trade-offs.
- Building or modifying RAG pipelines (chunking strategy, retrieval, re-ranking).
- Implementing embedding generation, vector storage, or similarity search.
- Optimizing inference latency, token usage, or throughput.
- Reviewing AI safety, alignment, and output guardrails.

## Procedure
1. Classify risk level and user-facing impact of the LLM change.
2. Load mandatory governance context, then AI/LLM-relevant files:
   - `.ai/skills/llm-engineering.md`
   - `.ai/memory/current-architecture.md`
   - `docs/API_CONVENTIONS.md`
   - `docs/SECURITY_RULES.md`
3. **Model Evaluation**:
   - Define evaluation criteria: quality (accuracy, coherence, instruction-following), latency (p50/p95/p99), cost (per-1K-token input/output pricing), context window, and fine-tuning availability.
   - Run structured benchmarks against representative task samples. Minimum sample size: 50 inputs covering edge cases.
   - Document model comparison matrix with quantitative scores.
4. **Prompt Design**:
   - Select prompting strategy: zero-shot, few-shot, chain-of-thought, structured output (JSON mode / function calling), or multi-turn.
   - Construct prompt templates with explicit role, task, constraints, and output format sections.
   - Test prompt stability across temperature settings (0.0, 0.3, 0.7) and document variance.
   - Version prompts with semantic identifiers and store in `src/prompts/`.
5. **RAG Pipeline Design** (when applicable):
   - Define chunking strategy: chunk size, overlap, boundary detection (sentence vs paragraph vs semantic).
   - Select embedding model and dimensionality. Justify trade-off between recall and index size.
   - Design retrieval pipeline: vector search -> re-ranking -> context assembly.
   - Implement citation tracking so generated output references source chunks.
6. **Cost Optimization**:
   - Estimate per-request token cost for typical and worst-case inputs.
   - Identify token reduction opportunities: prompt compression, caching, tiered model routing (cheap model for classification, expensive model for generation).
   - Set budget alerts and hard limits in the platform configuration.
7. **Safety Review**:
   - Apply output guardrails: content filtering, PII detection, hallucination scoring.
   - Test adversarial inputs: prompt injection, jailbreak attempts, data extraction probes.
   - Document residual safety risks and mitigation posture.
8. Add/update tests for changed LLM behavior: deterministic output tests (temperature=0), latency budget tests, cost threshold tests.
9. Validate with lint, typecheck, and targeted tests.
10. Evaluate memory impact when model configuration or prompt baselines change.

## Constraints
- Never hard-code API keys or model credentials; use environment-based secret injection.
- Never deploy a model change without documented benchmark comparison against the incumbent.
- Never bypass content safety filters in production configurations.
- Do not modify `.ai/instructions/**`, `.github/workflows/**`, or `infra/**`.

## Output Requirements
- Model selection rationale with quantitative comparison matrix.
- Prompt templates with versioning and test results across temperature settings.
- Cost estimates: per-request, projected monthly at current and 2x traffic.
- RAG pipeline architecture (when applicable): chunking parameters, embedding model, retrieval strategy.
- Safety assessment: adversarial test results, guardrail configuration, residual risks.
- Files changed and why.
- Validation commands and outcomes.
- Residual risks and follow-up actions.
