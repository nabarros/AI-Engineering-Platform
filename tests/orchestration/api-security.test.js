import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createOrchestrationServer } from "../../src/api/orchestration-server.js";

async function startServer(runtime) {
  await new Promise((resolve, reject) => {
    runtime.server.listen(0, "127.0.0.1", (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const address = runtime.server.address();
  return `http://127.0.0.1:${address.port}`;
}

function validPayload() {
  return {
    requestId: "sec-1",
    task: { domain: "backend", risk: "MEDIUM", description: "secure orchestration" },
    budget: { tokenBudgetTier: "LOW", latencyBudgetTier: "LOW" },
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.9,
      tokenUsage: 1000,
      latencyMs: 100
    }
  };
}

test("should enforce auth, tenant isolation, rate-limit, and idempotency", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiep-auth-"));
  const runtime = createOrchestrationServer({
    stateFilePath: path.join(tempDir, "shared.json"),
    auth: {
      requireAuth: true,
      apiKeys: {
        "test-key": {
          principal: "integration-test",
          tenants: ["tenant-a"],
          scopes: ["orchestrate:write"]
        }
      }
    },
    rateLimit: {
      limit: 3,
      windowMs: 60_000
    }
  });

  const baseUrl = await startServer(runtime);

  try {
    const unauthorized = await fetch(`${baseUrl}/orchestrate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant-a" },
      body: JSON.stringify(validPayload())
    });
    assert.equal(unauthorized.status, 401);

    const forbiddenTenant = await fetch(`${baseUrl}/orchestrate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-b",
        "x-api-key": "test-key"
      },
      body: JSON.stringify(validPayload())
    });
    assert.equal(forbiddenTenant.status, 403);

    const idemHeaders = {
      "content-type": "application/json",
      "x-tenant-id": "tenant-a",
      "x-api-key": "test-key",
      "idempotency-key": "idem-1"
    };

    const first = await fetch(`${baseUrl}/orchestrate`, {
      method: "POST",
      headers: idemHeaders,
      body: JSON.stringify(validPayload())
    });
    assert.equal(first.status, 200);

    const second = await fetch(`${baseUrl}/orchestrate`, {
      method: "POST",
      headers: idemHeaders,
      body: JSON.stringify(validPayload())
    });
    assert.equal(second.status, 200);

    const secondJson = await second.json();
    assert.equal(secondJson.meta.idempotencyReplay, true);

    const third = await fetch(`${baseUrl}/orchestrate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-a",
        "x-api-key": "test-key"
      },
      body: JSON.stringify({ ...validPayload(), requestId: "sec-2" })
    });
    assert.equal(third.status, 200);

    const fourth = await fetch(`${baseUrl}/orchestrate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-a",
        "x-api-key": "test-key"
      },
      body: JSON.stringify({ ...validPayload(), requestId: "sec-3" })
    });
    assert.equal(fourth.status, 429);
  } finally {
    await runtime.close();
  }
});
