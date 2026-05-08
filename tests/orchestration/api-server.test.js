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

test("should expose health and orchestration endpoints", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiep-api-"));
  const stateFilePath = path.join(tempDir, "state.json");
  const runtime = createOrchestrationServer({ stateFilePath });
  const baseUrl = await startServer(runtime);

  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);

    const orchestrateResponse = await fetch(`${baseUrl}/orchestrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: "api-test-001",
        task: {
          domain: "backend",
          risk: "MEDIUM",
          description: "Implement API behavior and tests"
        },
        budget: {
          tokenBudgetTier: "LOW",
          latencyBudgetTier: "MEDIUM"
        },
        confirmation: true,
        executionEvidence: {
          testsPassed: true,
          securityChecksPassed: true,
          contractChecksPassed: true,
          errorHandlingValidated: true,
          qualityScore: 0.9,
          latencyMs: 140,
          tokenUsage: 1700
        }
      })
    });

    assert.equal(orchestrateResponse.status, 200);
    const orchestrateJson = await orchestrateResponse.json();
    assert.equal(orchestrateJson.data.ok, true);
    assert.ok(orchestrateJson.data.selectedSpecialist);

    const metricsResponse = await fetch(`${baseUrl}/metrics`);
    assert.equal(metricsResponse.status, 200);

    const graphResponse = await fetch(`${baseUrl}/orchestrate-graph`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: "graph-test-001",
        maxConcurrency: 2,
        nodes: [
          {
            id: "n1",
            agentId: "routing",
            task: {
              domain: "backend",
              risk: "MEDIUM",
              description: "Build backend plan"
            },
            budget: {
              tokenBudgetTier: "LOW",
              latencyBudgetTier: "LOW"
            },
            confirmation: true,
            executionEvidence: {
              testsPassed: true,
              securityChecksPassed: true,
              contractChecksPassed: true,
              errorHandlingValidated: true,
              qualityScore: 0.91,
              latencyMs: 100,
              tokenUsage: 1500
            }
          },
          {
            id: "n2",
            agentId: "routing",
            task: {
              domain: "review",
              risk: "LOW",
              description: "Review backend plan"
            },
            budget: {
              tokenBudgetTier: "LOW",
              latencyBudgetTier: "LOW"
            },
            confirmation: true,
            executionEvidence: {
              testsPassed: true,
              securityChecksPassed: true,
              contractChecksPassed: true,
              errorHandlingValidated: true,
              qualityScore: 0.88,
              latencyMs: 120,
              tokenUsage: 900
            }
          }
        ],
        edges: [{ from: "n1", to: "n2" }]
      })
    });

    assert.equal(graphResponse.status, 200);
    const graphJson = await graphResponse.json();
    assert.equal(graphJson.data.ok, true);
    assert.equal(graphJson.data.executedNodes, 2);
  } finally {
    await runtime.close();
  }
});
