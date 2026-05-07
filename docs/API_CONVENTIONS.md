---
ai_priority: high
context_type: governance
load_when: designing APIs, adding endpoints, reviewing API PRs
token_budget: medium
---

# API Conventions

## AI Agent Load Guidance

Load this file when designing new REST or event API endpoints, or when reviewing API-related code. Load `.ai/skills/api-design.md` for implementation patterns.

---

## Design Principles

1. **Spec-first:** Write the OpenAPI/AsyncAPI spec before implementation. The spec is the contract.
2. **Consistency over cleverness:** Follow conventions even when there is a "better" way for a specific case.
3. **Explicit versions:** All breaking changes require a version bump.
4. **Fail loudly:** Return descriptive, actionable error responses.
5. **Minimal surface:** Only expose what clients genuinely need.

---

## REST API Conventions

### URL Structure

```
/{version}/{resource}/{id}/{sub-resource}

/v1/prompts                          # collection
/v1/prompts/pmt-abc123               # single resource
/v1/prompts/pmt-abc123/versions      # sub-collection
/v1/prompts/pmt-abc123/versions/3    # specific sub-resource
```

Rules:
- Lowercase only, hyphen-separated words: `/llm-models`, not `/llmModels`
- Plural nouns for collections: `/users`, `/prompts`, `/models`
- No verbs in URLs — use HTTP methods instead
- No trailing slashes
- IDs are resource-typed: `usr-{uuid}`, `pmt-{uuid}`, `mdl-{uuid}` (aids debugging, avoids ID collisions across types)

### HTTP Methods

| Method | Use | Idempotent | Body |
|--------|-----|-----------|------|
| GET | Fetch resource(s) | Yes | No |
| POST | Create resource or trigger action | No | Yes |
| PUT | Replace entire resource | Yes | Yes |
| PATCH | Partial update | No | Yes |
| DELETE | Remove resource | Yes | No |

- Use GET for reads, never POST for reads
- Use POST `/v1/prompts/pmt-123/deploy` for actions — not DELETE + POST
- PATCH uses JSON Merge Patch format (RFC 7396)

### Status Codes

| Code | Use |
|------|-----|
| 200 OK | Successful GET, PATCH, PUT |
| 201 Created | Successful POST creating a resource |
| 202 Accepted | Async operation started |
| 204 No Content | Successful DELETE |
| 400 Bad Request | Client sent invalid data (validation error) |
| 401 Unauthorized | Not authenticated |
| 403 Forbidden | Authenticated but not authorized |
| 404 Not Found | Resource doesn't exist |
| 409 Conflict | Resource already exists, state conflict |
| 422 Unprocessable Entity | Semantically invalid (passes schema, fails business rules) |
| 429 Too Many Requests | Rate limit exceeded |
| 500 Internal Server Error | Unexpected server error |
| 503 Service Unavailable | Dependency unavailable |

### Request / Response Envelope

#### Success Response

```typescript
// Collection
{
  "data": T[],
  "meta": {
    "page": number,
    "pageSize": number,
    "total": number,
    "hasMore": boolean
  }
}

// Single resource
{
  "data": T
}

// Async operation
{
  "data": {
    "jobId": "job-abc123",
    "status": "pending",
    "pollUrl": "/v1/jobs/job-abc123"
  }
}
```

#### Error Response

```typescript
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": {                                // optional — validation errors
    "fieldName": "field-specific message"
  },
  "requestId": "req-xyz789"                  // always include for traceability
}
```

Error codes: `UPPER_SNAKE_CASE`, domain-prefixed

```
AUTH_TOKEN_EXPIRED
PROMPT_NOT_FOUND
MODEL_UNAVAILABLE
RATE_LIMIT_EXCEEDED
VALIDATION_ERROR
```

### Pagination

All collection endpoints must support pagination:

```
GET /v1/prompts?page=1&pageSize=20&sort=createdAt&order=desc
```

- Default `pageSize`: 20
- Maximum `pageSize`: 100
- `sort` defaults to `createdAt`, `order` defaults to `desc`
- Cursor-based pagination for high-volume collections (> 100k records)

### Filtering

```
GET /v1/prompts?model=gpt-4o&status=active&createdAfter=2024-01-01
```

- Filter parameters are exact match by default
- Suffix `_like` for partial match: `?name_like=summariz`
- Date filters: ISO 8601 format, UTC timezone
- Array values: comma-separated `?tags=qa,production`

### Versioning Strategy

- URL path versioning: `/v1/`, `/v2/`
- Minor, backwards-compatible changes: no new version
- Breaking changes: new major version, old version deprecated with sunset date (minimum 6 months)
- Deprecation notice: `Deprecation: true` and `Sunset: {date}` response headers

---

## Event API Conventions (Kafka / AsyncAPI)

### Topic Naming

```
{domain}.{entity}.{event}

ai.llm.request.completed
ai.prompt.deployed
auth.user.created
platform.job.failed
```

- All lowercase, dot-separated
- Present or past tense for events: `.created`, `.completed`, `.failed`
- Commands (imperative): not published to Kafka — use REST for commands

### Event Schema

All events must include this envelope:

```json
{
  "eventId": "evt-abc123",
  "eventType": "ai.llm.request.completed",
  "schemaVersion": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "llm-gateway",
  "traceId": "trace-xyz789",
  "data": { ... }
}
```

### Schema Evolution

- Additive changes (new optional fields): backwards-compatible, no version bump
- Removing fields or changing types: bump `schemaVersion` major
- Old consumers must continue working during migration period
- Schema registered in Confluent Schema Registry with compatibility mode `BACKWARD`

---

## API Documentation Requirements

Every endpoint must have in its OpenAPI spec:
- Summary (< 10 words)
- Description (explains business purpose, not just technical behaviour)
- All parameters documented with type, constraints, and example
- All response codes documented with example bodies
- Authentication requirement stated
- Rate limit noted if endpoint-specific

---

## Internal Service APIs

For internal REST APIs (service-to-service):

- Same envelope format as public APIs for consistency
- Use service identity JWTs for authentication, not user JWTs
- Internal APIs can use path `/internal/v1/` to signal they are not for external consumers
- Internal APIs still require authentication — zero-trust networking

---

## GraphQL (if applicable)

- Schema-first using SDL
- Mutations always return the mutated type
- Use DataLoader for all relationship resolution to prevent N+1
- Pagination via Relay-style cursor connections for collections > 100 items
- Disable introspection in production

---

## Anti-Patterns

| Pattern | Why Forbidden |
|---------|--------------|
| `GET /v1/deleteUser` | Verbs in URLs, wrong method for delete |
| `POST /v1/getUsers` | GET must be used for reads |
| Returning 200 for errors | Breaks client error handling |
| Different envelope shape per endpoint | Inconsistent contract |
| Undocumented fields in responses | Silent API contract additions |
| Leaking internal error details | Information disclosure |
| Accepting but ignoring unknown fields silently | Silent contract confusion |
