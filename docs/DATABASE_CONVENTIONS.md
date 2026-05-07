---
ai_priority: high
context_type: governance
load_when: database schema design, writing queries, migrations, repository patterns
token_budget: medium
---

# Database Conventions

## AI Agent Load Guidance

Load this file when working with database schemas, migrations, queries, or repository layer code. Load `.ai/skills/database-patterns.md` for implementation patterns and examples.

---

## Schema Design

### Naming Conventions

| Object | Convention | Example |
|--------|-----------|---------|
| Tables | `snake_case`, plural | `prompt_versions` |
| Columns | `snake_case` | `created_at` |
| Indexes | `idx_{table}_{columns}` | `idx_prompts_model_status` |
| Unique constraints | `uq_{table}_{columns}` | `uq_users_email` |
| Foreign keys | `fk_{table}_{ref_table}` | `fk_prompts_models` |
| Check constraints | `chk_{table}_{rule}` | `chk_prompts_status` |
| Sequences | auto (use IDENTITY) | — |

### Standard Columns

All tables must include:

```sql
id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

Tables with soft delete must include:

```sql
deleted_at  TIMESTAMPTZ NULL
```

Use `WHERE deleted_at IS NULL` in all queries — never `WHERE active = true`.

### IDs

- All primary keys: UUID v4 (`gen_random_uuid()`)
- No auto-increment integers for external-facing IDs (prevents enumeration)
- Human-readable prefixed IDs at the application layer (`usr-{uuid}`, `pmt-{uuid}`) — the prefix is derived from the resource type, not stored separately
- Foreign keys reference `{table}.id` directly

### Timestamps

- All timestamps in UTC, stored as `TIMESTAMPTZ`
- Never use `TIMESTAMP WITHOUT TIME ZONE`
- Application layer always passes UTC timestamps
- `updated_at` maintained via trigger (not application layer)

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Query Standards

### Parameterized Queries

**All queries must use parameterized inputs.** No string interpolation or concatenation.

```typescript
// GOOD
const { rows } = await db.query(
  `SELECT id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL`,
  [userId]
);

// CRITICAL VIOLATION — SQL injection
const { rows } = await db.query(
  `SELECT id, email, role FROM users WHERE id = '${userId}'`
);
```

### Index Strategy

- Add an index on any column used in `WHERE`, `ORDER BY`, or `JOIN` conditions at > 10k rows
- Composite indexes: most selective column first
- Partial indexes for filtered queries: `CREATE INDEX ON prompts (status) WHERE deleted_at IS NULL`
- EXPLAIN ANALYZE any query that accesses > 50k rows before merging
- Avoid indexes on frequently updated columns in high-write tables

### N+1 Prevention

- Never load a collection and then query for each item — use JOINs or IN clauses

```typescript
// BAD — N+1
const prompts = await promptRepo.findAll();
for (const prompt of prompts) {
  prompt.model = await modelRepo.findById(prompt.modelId); // N queries
}

// GOOD — single query with JOIN
const prompts = await promptRepo.findAllWithModels(); // JOIN in query
```

### Query Limits

- All list queries must have an explicit `LIMIT` clause
- Maximum page size: 1000 rows for internal queries; 100 for API-exposed queries
- Add `ORDER BY` clause when pagination matters (PostgreSQL result order is not guaranteed)

---

## Repository Pattern

All database access goes through repository classes. Services never query the database directly.

```typescript
// Structure
interface PromptRepository {
  findById(id: string): Promise<Result<Prompt, 'NOT_FOUND' | 'DB_ERROR'>>;
  findByModel(modelId: string, pagination: Pagination): Promise<Result<Page<Prompt>, 'DB_ERROR'>>;
  save(prompt: NewPrompt): Promise<Result<Prompt, 'DUPLICATE' | 'DB_ERROR'>>;
  softDelete(id: string): Promise<Result<void, 'NOT_FOUND' | 'DB_ERROR'>>;
}
```

- Repositories return `Result<T, E>` — they never throw database errors directly to services
- Database errors are caught and mapped to domain error codes (`DB_ERROR`, `DUPLICATE`, etc.)
- Repositories are injected as dependencies, not imported directly

---

## Migrations

### Rules

- Forward-only: never modify an existing migration file after it's merged to `main`
- One concern per migration file (schema change OR data migration, not both)
- Additive migrations are preferred: add columns, don't remove/rename
- All migrations must be tested in a staging environment before production
- Every migration must have a rollback script tested alongside the forward migration

### File Naming

```
migrations/
  YYYY-MM-DD-NNN-{description}.sql
  2024-01-15-001-add-prompts-table.sql
  2024-01-15-002-add-prompt-versions.sql
  2024-01-22-001-add-model-tier-to-prompts.sql
```

### Zero-Downtime Migration Pattern

For schema changes that affect running services:

**Phase 1 (deploy before app change):** Add new column as nullable
```sql
ALTER TABLE prompts ADD COLUMN model_tier VARCHAR(20) NULL;
```

**Phase 2 (app change):** Write to both old and new columns

**Phase 3 (after full deployment):** Backfill existing rows, add NOT NULL constraint
```sql
UPDATE prompts SET model_tier = 'standard' WHERE model_tier IS NULL;
ALTER TABLE prompts ALTER COLUMN model_tier SET NOT NULL;
```

**Phase 4 (after stabilization):** Remove old column

### Breaking Changes

Never do these in a migration on a live system without a multi-phase plan:
- DROP TABLE
- DROP COLUMN
- RENAME COLUMN (breaks existing queries)
- Change column type
- Add NOT NULL constraint to existing column without a default

---

## Connection Management

- Connection pooling via PgBouncer (transaction mode)
- Pool size: min 5, max 20 per service instance
- Acquire timeout: 5 seconds
- Idle timeout: 10 minutes
- Health check query: `SELECT 1`
- Graceful shutdown: drain connections before process exit

---

## Transaction Patterns

```typescript
// Use transactions for operations that must be atomic
async function deployPromptVersion(promptId: string, versionId: string): Promise<Result<void, string>> {
  return db.transaction(async (trx) => {
    // Archive current active version
    await trx.query(
      `UPDATE prompt_versions SET status = 'archived' WHERE prompt_id = $1 AND status = 'active'`,
      [promptId]
    );
    // Activate new version
    await trx.query(
      `UPDATE prompt_versions SET status = 'active' WHERE id = $1`,
      [versionId]
    );
  });
}
```

- Use transactions for all multi-step mutations
- Keep transactions short — avoid external calls inside transactions
- Implement retry logic for deadlocks (Postgres error code 40P01)

---

## Schema Documentation

Every table must have a comment:

```sql
COMMENT ON TABLE prompts IS 'Stores versioned LLM prompt templates managed by the prompt service';
COMMENT ON COLUMN prompts.model_tier IS 'The cost tier of the model this prompt is designed for: standard, premium, custom';
```

---

## Related Files

- Database skill patterns → `.ai/skills/database-patterns.md`
- Migration strategy → `.ai/skills/migration-strategy.md`
- Engineering standards → `docs/ENGINEERING_STANDARDS.md`
