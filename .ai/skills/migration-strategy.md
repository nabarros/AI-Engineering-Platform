---
tags: [database, migration, postgresql, zero-downtime, deployment]
applies_to: [src/services/**/migrations/**]
priority: high
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Skill: Migration Strategy

## Purpose

Zero-downtime database migration patterns for PostgreSQL. Load when writing schema migrations, backfill scripts, or planning breaking schema changes.

## Applicability

Load when: creating new migrations, renaming columns, dropping tables, adding non-nullable columns, changing column types. Pair with `docs/DATABASE_CONVENTIONS.md` for naming conventions.

---

## Core Principle

**Migrations must be safe to run while services are live.** Never take the database offline. Use phased, additive changes so old and new code versions can coexist.

---

## 1. Migration File Naming

```
migrations/
  V001__create_prompts_table.sql
  V002__add_prompt_tags.sql
  V003__add_prompt_versions_table.sql
  V004__add_prompt_status_index.sql
```

Format: `V{sequence}__{snake_case_description}.sql`

Rules:
- Sequence numbers are permanent — never reuse
- Descriptions must clearly describe what changed
- One migration per logical change
- Migrations are immutable once merged to main

---

## 2. Migration Template

```sql
-- V012__add_model_tier_to_prompts.sql
-- Description: Add model_tier column to prompts table
-- Risk: LOW - additive change, nullable first
-- Estimated time: < 1s on current table size (~500K rows)
-- Rollback: V013__rollback_model_tier.sql

BEGIN;

-- Safe: adding nullable column
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS model_tier TEXT;

-- Add constraint after column exists
ALTER TABLE prompts
ADD CONSTRAINT prompts_model_tier_check
  CHECK (model_tier IN ('standard', 'premium', 'custom'));

-- Add index concurrently (does not lock table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_model_tier
ON prompts (model_tier)
WHERE deleted_at IS NULL;

COMMIT;
```

---

## 3. Zero-Downtime Patterns

### Adding a Non-Nullable Column (3-Phase Pattern)

**Never add a NOT NULL column without a default or existing data.**

**Phase 1 — Migration: Add nullable column**
```sql
ALTER TABLE prompts ADD COLUMN model_tier TEXT;
```

**Phase 2 — Code: Write to both old and new column; read from old**
Deploy code that:
- Writes `model_tier` on all new records
- Reads from `status` (old column) with fallback to `model_tier`

**Phase 3 — Migration: Backfill, add constraint, make NOT NULL**
```sql
-- Backfill in batches (see section 4)
UPDATE prompts
SET model_tier = 'standard'
WHERE model_tier IS NULL AND deleted_at IS NULL;

-- Add NOT NULL constraint
ALTER TABLE prompts ALTER COLUMN model_tier SET NOT NULL;
```

**Phase 4 — Code: Read exclusively from `model_tier`**
Remove fallback reads. The old column (if renaming) can now be dropped in a future migration.

---

### Renaming a Column (4-Phase Pattern)

Never rename directly with `ALTER TABLE RENAME COLUMN` in a single migration — old code still reads the old name.

**Phase 1 — Migration:** Add new column  
**Phase 2 — Code:** Write to both old and new; read from old  
**Phase 3 — Migration:** Backfill new column; add NOT NULL; update indexes  
**Phase 4 — Code:** Read from new column only  
**Phase 5 — Migration:** Drop old column  

---

### Dropping a Column (2-Phase Pattern)

**Phase 1 — Code:** Remove all reads/writes of the column from application code. Deploy.  
**Phase 2 — Migration:** Drop the column (now safe because no code references it).

```sql
-- Phase 2 migration
ALTER TABLE prompts DROP COLUMN IF EXISTS legacy_category;
```

---

## 4. Backfill Script Pattern

For large tables, backfill in batches to avoid long-running transactions and table locks:

```sql
-- V013__backfill_model_tier.sql
DO $$
DECLARE
  batch_size INT := 1000;
  rows_updated INT;
  total_updated INT := 0;
BEGIN
  LOOP
    UPDATE prompts
    SET model_tier = 'standard',
        updated_at = now()
    WHERE id IN (
      SELECT id FROM prompts
      WHERE model_tier IS NULL AND deleted_at IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED  -- skip rows locked by other sessions
    );

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    total_updated := total_updated + rows_updated;

    EXIT WHEN rows_updated = 0;

    -- Brief pause to reduce contention
    PERFORM pg_sleep(0.05);
  END LOOP;

  RAISE NOTICE 'Backfill complete. Total rows updated: %', total_updated;
END $$;
```

---

## 5. Index Migrations

Always create indexes with `CONCURRENTLY` to avoid table locks:

```sql
-- GOOD — non-blocking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_org_id
ON prompts (organization_id)
WHERE deleted_at IS NULL;

-- BAD — locks the table
CREATE INDEX idx_prompts_org_id ON prompts (organization_id);
```

Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. Run it outside `BEGIN/COMMIT`.

---

## 6. Rollback Strategy

Every migration must have a corresponding rollback or be designed to be additive:

```sql
-- Rollback for V012 (stored alongside migration or in notes)
-- V012_rollback.sql
BEGIN;
  DROP INDEX IF EXISTS idx_prompts_model_tier;
  ALTER TABLE prompts DROP CONSTRAINT IF EXISTS prompts_model_tier_check;
  ALTER TABLE prompts DROP COLUMN IF EXISTS model_tier;
COMMIT;
```

When a migration is not easily reversible (e.g., data transformations), document the manual recovery steps in the migration header comment.

---

## 7. Migration Execution Protocol

```bash
# 1. Review migration plan
flyway info -url=jdbc:postgresql://$DB_HOST/$DB_NAME -user=$DB_USER

# 2. Dry run (check syntax)
flyway validate -url=... -user=... -password=...

# 3. Run against staging first
flyway migrate -url=$STAGING_DB_URL

# 4. Verify application health in staging (5 min observation)

# 5. Run against production
flyway migrate -url=$PROD_DB_URL

# 6. Emergency halt (if needed)
# — Do NOT run the rollback immediately
# — First: check application error rate
# — If errors spike: deploy previous application version
# — Then: evaluate whether migration rollback is safe
```

---

## Anti-Patterns

| Anti-Pattern | Consequence |
|---|---|
| Adding NOT NULL column without default | Locks table; old code crashes on INSERT |
| Modifying migration already on main | Checksum mismatch; Flyway refuses to run |
| Dropping column while code reads it | Application errors immediately |
| Index without CONCURRENTLY | Table lock; service degradation |
| Renaming column in one step | Old code reads null; data loss risk |
| Long-running transaction in migration | Blocks all writes during migration |
| Backfilling millions of rows in one UPDATE | Locks table; risk of timeout |
