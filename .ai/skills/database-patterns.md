---
tags: [database, postgresql, repository, query, typescript, python]
applies_to: [src/services/**]
priority: high
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Skill: Database Patterns

## Purpose

Patterns for safe, performant database access. Load when writing database queries, repositories, or migrations.

## Applicability

Load when: writing repository classes, database queries, or data access logic. Pair with `docs/DATABASE_CONVENTIONS.md` for naming and schema conventions.

---

## 1. Repository Class Pattern

All database access goes through a repository class. Services never query directly.

```typescript
// src/services/prompt-service/repositories/prompt.repository.ts
import type { DatabaseClient } from '@aiep/database';
import type { Result } from '@aiep/core';

type PromptRow = {
  id: string;
  name: string;
  content: string;
  model_tier: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export class PromptRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string): Promise<Result<Prompt, 'NOT_FOUND' | 'DB_ERROR'>> {
    try {
      const rows = await this.db.query<PromptRow>(
        `SELECT id, name, content, model_tier, status, created_at, updated_at
         FROM prompts
         WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );

      if (rows.length === 0) return { ok: false, error: 'NOT_FOUND' };
      return { ok: true, value: this.mapToPrompt(rows[0]) };
    } catch (err) {
      this.db.logger.error({ id, err }, 'PromptRepository.findById failed');
      return { ok: false, error: 'DB_ERROR', cause: err };
    }
  }

  async findByModelTier(
    modelTier: ModelTier,
    pagination: PaginationInput,
  ): Promise<Result<PaginatedResult<Prompt>, 'DB_ERROR'>> {
    try {
      const offset = (pagination.page - 1) * pagination.pageSize;

      const [rows, countRow] = await Promise.all([
        this.db.query<PromptRow>(
          `SELECT id, name, model_tier, status, created_at
           FROM prompts
           WHERE model_tier = $1 AND deleted_at IS NULL
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [modelTier, pagination.pageSize, offset],
        ),
        this.db.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM prompts WHERE model_tier = $1 AND deleted_at IS NULL`,
          [modelTier],
        ),
      ]);

      return {
        ok: true,
        value: {
          items: rows.map(this.mapToPrompt),
          total: parseInt(countRow[0].count, 10),
          page: pagination.page,
          pageSize: pagination.pageSize,
        },
      };
    } catch (err) {
      this.db.logger.error({ modelTier, err }, 'PromptRepository.findByModelTier failed');
      return { ok: false, error: 'DB_ERROR', cause: err };
    }
  }

  async save(input: CreatePromptInput): Promise<Result<Prompt, 'DUPLICATE' | 'DB_ERROR'>> {
    try {
      const rows = await this.db.query<PromptRow>(
        `INSERT INTO prompts (id, name, content, model_tier, status)
         VALUES (gen_random_uuid(), $1, $2, $3, 'draft')
         RETURNING *`,
        [input.name, input.content, input.modelTier],
      );
      return { ok: true, value: this.mapToPrompt(rows[0]) };
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return { ok: false, error: 'DUPLICATE' };
      }
      this.db.logger.error({ input, err }, 'PromptRepository.save failed');
      return { ok: false, error: 'DB_ERROR', cause: err };
    }
  }

  async softDelete(id: string): Promise<Result<void, 'NOT_FOUND' | 'DB_ERROR'>> {
    try {
      const result = await this.db.query(
        `UPDATE prompts SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (result.rowCount === 0) return { ok: false, error: 'NOT_FOUND' };
      return { ok: true, value: undefined };
    } catch (err) {
      this.db.logger.error({ id, err }, 'PromptRepository.softDelete failed');
      return { ok: false, error: 'DB_ERROR', cause: err };
    }
  }

  private mapToPrompt(row: PromptRow): Prompt {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      modelTier: row.model_tier as ModelTier,
      status: row.status as PromptStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Utility: detect PostgreSQL unique constraint violation
function isDuplicateKeyError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === '23505' // PostgreSQL unique violation
  );
}
```

---

## 2. Transaction Pattern

For operations that must be atomic:

```typescript
async function deployPromptVersion(
  promptId: string,
  versionId: string,
): Promise<Result<void, 'NOT_FOUND' | 'DB_ERROR'>> {
  return this.db.transaction(async (trx) => {
    // Step 1: Verify version exists and belongs to prompt
    const versionRows = await trx.query(
      `SELECT id FROM prompt_versions WHERE id = $1 AND prompt_id = $2`,
      [versionId, promptId],
    );
    if (versionRows.length === 0) return { ok: false, error: 'NOT_FOUND' };

    // Step 2: Archive current active version
    await trx.query(
      `UPDATE prompt_versions SET status = 'archived', updated_at = now()
       WHERE prompt_id = $1 AND status = 'active'`,
      [promptId],
    );

    // Step 3: Activate new version
    await trx.query(
      `UPDATE prompt_versions SET status = 'active', updated_at = now() WHERE id = $1`,
      [versionId],
    );

    return { ok: true, value: undefined };
  });
}
```

Rules:
- Keep transactions short — no external HTTP calls inside a transaction
- Use `SERIALIZABLE` isolation level only when genuinely needed (high contention scenario)
- Implement retry on deadlock (Postgres error code `40P01`)

---

## 3. Batch Loading (N+1 Prevention)

When loading related data for multiple parent records:

```typescript
async function findPromptsWithVersions(
  promptIds: string[],
): Promise<Result<Map<string, PromptWithVersions>, 'DB_ERROR'>> {
  if (promptIds.length === 0) {
    return { ok: true, value: new Map() };
  }

  try {
    const rows = await this.db.query<PromptWithVersionRow>(
      `SELECT
         p.id as prompt_id, p.name, p.status,
         v.id as version_id, v.content, v.version_number, v.is_active
       FROM prompts p
       LEFT JOIN prompt_versions v ON v.prompt_id = p.id AND v.deleted_at IS NULL
       WHERE p.id = ANY($1) AND p.deleted_at IS NULL
       ORDER BY p.id, v.version_number DESC`,
      [promptIds], // PostgreSQL ANY() for array parameter
    );

    // Group results in memory — single query, no N+1
    const promptMap = new Map<string, PromptWithVersions>();
    for (const row of rows) {
      if (!promptMap.has(row.prompt_id)) {
        promptMap.set(row.prompt_id, { id: row.prompt_id, name: row.name, versions: [] });
      }
      if (row.version_id) {
        promptMap.get(row.prompt_id)!.versions.push(mapToVersion(row));
      }
    }

    return { ok: true, value: promptMap };
  } catch (err) {
    return { ok: false, error: 'DB_ERROR', cause: err };
  }
}
```

---

## 4. Query Builder Usage

For complex dynamic queries, use a query builder rather than string concatenation:

```typescript
import { Kysely } from 'kysely';

async function searchPrompts(filters: PromptSearchFilters) {
  let query = db
    .selectFrom('prompts')
    .select(['id', 'name', 'status', 'created_at'])
    .where('deleted_at', 'is', null)
    .orderBy('created_at', filters.order ?? 'desc')
    .limit(filters.pageSize ?? 20)
    .offset(((filters.page ?? 1) - 1) * (filters.pageSize ?? 20));

  if (filters.modelTier) {
    query = query.where('model_tier', '=', filters.modelTier);
  }

  if (filters.status) {
    query = query.where('status', '=', filters.status);
  }

  if (filters.search) {
    query = query.where('name', 'ilike', `%${filters.search}%`);
  }

  return query.execute();
}
```

**Never build SQL strings dynamically with user input.** Use parameterized queries or a typed query builder.

---

## 5. Python Repository Pattern

```python
from typing import Protocol
from uuid import UUID
from result import Result, Ok, Err
import asyncpg

class PromptRepository(Protocol):
    async def find_by_id(self, prompt_id: UUID) -> Result["Prompt", str]: ...

class PostgresPromptRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def find_by_id(self, prompt_id: UUID) -> Result["Prompt", str]:
        async with self._pool.acquire() as conn:
            try:
                row = await conn.fetchrow(
                    """
                    SELECT id, name, content, model_tier, status, created_at
                    FROM prompts
                    WHERE id = $1 AND deleted_at IS NULL
                    """,
                    prompt_id,
                )
                if row is None:
                    return Err("NOT_FOUND")
                return Ok(Prompt.from_row(row))
            except asyncpg.PostgresError as exc:
                logger.error("find_by_id failed", prompt_id=str(prompt_id), error=str(exc))
                return Err("DB_ERROR")
```

---

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|---|---|
| `SELECT *` in queries | Select only required columns |
| String interpolation in SQL | Parameterized queries only |
| N+1 queries in loops | Batch with `ANY($1)` or JOIN |
| Missing `deleted_at IS NULL` filter | Always filter soft-deleted records |
| Direct DB access from service layer | All DB access through repository |
| Catching generic `Exception` from DB | Catch specific DB error types |
| Missing indexes on foreign keys | Index all FKs and query columns |

---

## Checklist

Before merging database code:
- [ ] All queries use parameterized inputs
- [ ] `deleted_at IS NULL` applied on all queries against soft-delete tables
- [ ] No `SELECT *` — explicit column list
- [ ] N+1 queries eliminated
- [ ] Transactions used for multi-step mutations
- [ ] Indexes exist for all WHERE / JOIN / ORDER BY columns
- [ ] EXPLAIN ANALYZE reviewed for queries on large tables
- [ ] Repository methods return `Result<T, E>` — no raw DB errors
