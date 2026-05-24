import test from "node:test";
import assert from "node:assert/strict";

import {
  CONNECTOR_CONTRACT_VERSION,
  createConnectorDefinition,
  validateConnectorDefinition
} from "../../src/orchestration/connectors/connector-contract.js";
import { ConnectorRegistry } from "../../src/orchestration/connectors/connector-registry.js";
import { createConnectorPolicyEngine } from "../../src/orchestration/connectors/connector-policy-engine.js";
import { BUILTIN_CONNECTORS } from "../../src/orchestration/connectors/builtin-connectors.js";
import { ConnectorSandbox } from "../../src/orchestration/connectors/connector-sandbox.js";

function sampleConnector(id = "sample") {
  return createConnectorDefinition({
    id,
    name: "Sample",
    version: "1.0.0",
    auth: { type: "oauth2", scopes: ["read"] },
    quotas: { rateLimitPerMinute: 10 },
    health: { timeoutMs: 1000 },
    cost: { unitCostUsd: 0.001, billingUnit: "call" },
    audit: { fields: ["tenantId", "action"] },
    actions: {
      readData: { mode: "read", requiresApproval: false },
      writeData: { mode: "write", requiresApproval: true }
    }
  });
}

test("ECR-01 should validate connector contract v1", () => {
  const connector = sampleConnector();
  assert.equal(connector.contractVersion, CONNECTOR_CONTRACT_VERSION);

  const result = validateConnectorDefinition(connector);
  assert.equal(result.valid, true);

  const invalid = validateConnectorDefinition({ id: "broken" });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length > 0);
});

test("ECR-02 should provide dynamic connector discovery with cache and health", async () => {
  let now = 1_000;
  const registry = new ConnectorRegistry({
    cacheTtlMs: 100,
    nowFn: () => now
  });

  registry.addDiscoveryProvider(async () => [sampleConnector("dynamic")]);
  const firstRefresh = await registry.refreshDynamicConnectors();
  assert.equal(firstRefresh.refreshed, true);
  assert.equal(registry.lookup("dynamic").id, "dynamic");

  const cachedRefresh = await registry.refreshDynamicConnectors();
  assert.equal(cachedRefresh.fromCache, true);

  now += 120;
  const secondRefresh = await registry.refreshDynamicConnectors();
  assert.equal(secondRefresh.refreshed, true);

  const health = registry.health();
  assert.equal(health.healthy, true);
  assert.equal(health.connectorCount >= 1, true);
});

test("ECR-03 should enforce deny-by-default tenant RBAC with audit output", () => {
  const engine = createConnectorPolicyEngine({
    tenantPolicies: {
      t1: {
        allow: [
          { connectorId: "github", actions: ["getRepo"], roles: ["developer"], reason: "Read repo metadata" }
        ],
        deny: []
      }
    }
  });

  const denied = engine.evaluate({
    tenantId: "t1",
    connectorId: "github",
    action: "triggerWorkflow",
    actorRoles: ["developer"]
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "DENY_BY_DEFAULT");

  const allowed = engine.evaluate({
    tenantId: "t1",
    connectorId: "github",
    action: "getRepo",
    actorRoles: ["developer"]
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.audit.decision, "allow");
});

test("ECR-04..ECR-08 should include required built-in production connectors", () => {
  const connectorIds = BUILTIN_CONNECTORS.map((connector) => connector.id).sort();

  assert.deepEqual(connectorIds, [
    "cloud-cost",
    "github",
    "jira",
    "kubernetes",
    "slack"
  ]);
});

test("ECR-09 should provide deterministic sandbox simulation mode", async () => {
  const sandbox = new ConnectorSandbox();

  const first = await sandbox.simulate({
    connectorId: "github",
    action: "getRepo",
    payload: { repo: "aiep" }
  });

  const second = await sandbox.simulate({
    connectorId: "github",
    action: "getRepo",
    payload: { repo: "aiep" }
  });

  assert.equal(first.simulated, true);
  assert.equal(second.simulated, true);
  assert.equal(first.result.seed, second.result.seed);
});
