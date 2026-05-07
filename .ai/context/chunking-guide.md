---
ai_priority: tier-3
context_type: rag-implementation
load_when: implementing-rag, context-retrieval, vector-search-setup
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Chunking Guide

Implementation guide for RAG content chunking and retrieval optimization.

---

## Chunking Strategy by Content Type

| Content Type | Chunk Size (tokens) | Overlap (tokens) | Strategy | Boundary |
|---|---|---|---|---|
| API documentation | 512 | 50 | Fixed-size | None |
| Code files | 300 | 30 | Semantic | Function/class boundary |
| Markdown docs | 400 | 40 | Semantic | Heading/paragraph boundary |
| ADRs / decisions | 600 | 60 | Document-level | Full section |
| Log lines | 100 | 0 | Fixed-size | None |
| Schema definitions | 200 | 20 | Semantic | Table/type boundary |

---

## Chunking Implementation

```typescript
// src/services/vector-store-service/chunking/chunker.ts
import { encode, decode } from 'gpt-tokenizer';

type ChunkOptions = {
  maxTokens: number;
  overlap: number;
  boundary?: 'none' | 'sentence' | 'paragraph' | 'function';
};

export function chunkDocument(content: string, options: ChunkOptions): string[] {
  const { maxTokens, overlap, boundary = 'none' } = options;
  const tokens = encode(content);

  if (tokens.length <= maxTokens) {
    return [content]; // small enough to use as-is
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < tokens.length) {
    let end = Math.min(start + maxTokens, tokens.length);

    // If boundary-aware, find nearest natural break point
    if (boundary !== 'none' && end < tokens.length) {
      end = findBoundary(content, tokens, start, end, boundary);
    }

    chunks.push(decode(tokens.slice(start, end)));
    start = end - overlap; // overlap with next chunk
  }

  return chunks;
}

function findBoundary(
  content: string,
  tokens: number[],
  start: number,
  maxEnd: number,
  boundary: 'sentence' | 'paragraph' | 'function',
): number {
  const chunkText = decode(tokens.slice(start, maxEnd));

  if (boundary === 'paragraph') {
    const lastParagraph = chunkText.lastIndexOf('\n\n');
    if (lastParagraph > chunkText.length * 0.5) {
      // Only use if it's at least halfway through the chunk
      const trimmed = chunkText.slice(0, lastParagraph);
      return start + encode(trimmed).length;
    }
  }

  if (boundary === 'sentence') {
    const sentenceEnd = Math.max(
      chunkText.lastIndexOf('. '),
      chunkText.lastIndexOf('.\n'),
    );
    if (sentenceEnd > chunkText.length * 0.5) {
      const trimmed = chunkText.slice(0, sentenceEnd + 1);
      return start + encode(trimmed).length;
    }
  }

  return maxEnd; // fall back to hard boundary
}
```

---

## Metadata Schema

Every chunk stored in Weaviate must include these metadata fields:

```typescript
type ChunkMetadata = {
  documentId: string;          // UUID — links back to source document
  chunkIndex: number;          // 0-based position in original document
  totalChunks: number;         // total chunks for this document
  contentType: ChunkContentType; // 'api-doc' | 'code' | 'markdown' | 'adr' | 'schema'
  sourceFile: string;          // original file path (e.g., 'docs/API_CONVENTIONS.md')
  heading: string | null;      // nearest heading above this chunk (for markdown)
  organizationId: string;      // for multi-tenant isolation
  language: string | null;     // for code chunks: 'typescript' | 'python' | 'sql'
  lastIndexedAt: Date;         // when this chunk was last updated in the index
};
```

---

## Retrieval Pipeline

```typescript
// src/services/vector-store-service/retrieval/retrieval-pipeline.ts
export async function retrieveContext(
  query: string,
  options: RetrievalOptions,
): Promise<RetrievedChunk[]> {
  // Step 1: Embed the query
  const queryEmbedding = await embeddingService.embed(query);

  // Step 2: Query Weaviate (over-fetch for reranking)
  const candidates = await weaviateClient.search({
    embedding: queryEmbedding,
    k: options.topK * 4,
    filters: {
      organizationId: options.organizationId,
      contentType: options.contentTypeFilter,
    },
  });

  // Step 3: MMR Reranking for diversity
  const reranked = mmrRerank(candidates, queryEmbedding, {
    topK: options.topK,
    lambda: 0.6, // 0 = max diversity, 1 = max relevance
  });

  // Step 4: Deduplicate by documentId + chunkIndex
  const deduped = deduplicateChunks(reranked);

  // Step 5: Format with metadata for context window
  return deduped.map(formatChunkForContext);
}
```

---

## MMR Reranking

Maximal Marginal Relevance balances relevance to query with diversity among results:

```typescript
function mmrRerank(
  candidates: ScoredChunk[],
  queryEmbedding: Float32Array,
  options: { topK: number; lambda: number },
): ScoredChunk[] {
  const selected: ScoredChunk[] = [];
  const remaining = [...candidates];

  while (selected.length < options.topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const relevance = cosineSimilarity(remaining[i].embedding, queryEmbedding);

      // Penalize by similarity to already-selected chunks
      const maxRedundancy = selected.length > 0
        ? Math.max(...selected.map(s => cosineSimilarity(remaining[i].embedding, s.embedding)))
        : 0;

      const mmrScore = options.lambda * relevance - (1 - options.lambda) * maxRedundancy;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}
```

---

## Index Quality Metrics

Monitor these to assess retrieval quality:

| Metric | Target | How to Measure |
|---|---|---|
| Retrieval relevance (human eval) | > 80% relevant | Sample 50 queries; human relevance judgment |
| Context precision | > 70% | % of retrieved chunks actually used by LLM |
| Context recall | > 85% | % of gold answer facts found in retrieved context |
| Mean chunk token count | 300-450 | Log on ingest |
| Index freshness lag | < 5 min | `lastIndexedAt` vs document `updated_at` |

---

## Related Files

- `docs/RETRIEVAL_STRATEGY.md` — retrieval strategy principles
- `.ai/context/context-map.md` — context loading map
- `.ai/architecture/data-flow.md` — vector store data flow diagram
