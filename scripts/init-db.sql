-- AI Engineering Platform - Database Initialization Script
-- This script runs automatically when PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create basic schema tables
CREATE TABLE IF NOT EXISTS schema_migrations (
  version BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_ms INT
);

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255),
  changes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- Create shared state table for orchestration
CREATE TABLE IF NOT EXISTS shared_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  version INT DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, key)
);

-- Create indexes for shared state queries
CREATE INDEX IF NOT EXISTS idx_shared_state_tenant ON shared_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shared_state_updated ON shared_state(updated_at);

-- Grant permissions to app user
GRANT CONNECT ON DATABASE aiep_dev TO aiep_user;
GRANT USAGE ON SCHEMA public TO aiep_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aiep_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aiep_user;
