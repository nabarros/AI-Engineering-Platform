import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRouterRuntimeAdapter, FileStateStore } from "../src/orchestration/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const statePath = path.join(__dirname, "..", "data", "orchestration-state.json");

const adapter = createRouterRuntimeAdapter({
  stateStore: new FileStateStore(statePath)
});

const result = await adapter.orchestrateRouting({
  requestId: `demo-${Date.now()}`,
  task: {
    domain: "backend",
    risk: "MEDIUM",
    description: "Design reliable API behavior and add tests"
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
    qualityScore: 0.91,
    latencyMs: 120,
    tokenUsage: 1800
  }
});

console.log("Runtime adapter output:");
console.log(JSON.stringify(result, null, 2));
console.log(`State persisted at: ${statePath}`);
