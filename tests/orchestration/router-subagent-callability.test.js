import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CAPABILITY_REGISTRY } from "../../src/orchestration/default-capability-registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function parseRouterAgents(routerFileText) {
  const agentsArrayMatch = routerFileText.match(/agents:\s*\[(.*?)\]/s);
  if (!agentsArrayMatch) {
    throw new Error("Router frontmatter missing agents array");
  }

  return [...agentsArrayMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function parseAgentName(agentFileText) {
  const nameMatch = agentFileText.match(/\nname:\s*"([^"]+)"/);
  if (!nameMatch) {
    throw new Error("Agent frontmatter missing name field");
  }
  return nameMatch[1];
}

test("router callable set should include every capability registry specialist", () => {
  const routerText = readText(".github/agents/aiep-senior-staff-router.agent.md");
  const routerCallableAgents = parseRouterAgents(routerText);
  const uniqueRouterCallableAgents = new Set(routerCallableAgents);

  assert.equal(
    uniqueRouterCallableAgents.size,
    routerCallableAgents.length,
    "Router agents list contains duplicated names"
  );

  const registryIds = DEFAULT_CAPABILITY_REGISTRY.map((entry) => entry.id);
  for (const specialistId of registryIds) {
    assert.ok(
      uniqueRouterCallableAgents.has(specialistId),
      `Router cannot call capability specialist: ${specialistId}`
    );
  }
});

test("router callable agents should map to existing agent frontmatter names", () => {
  const routerText = readText(".github/agents/aiep-senior-staff-router.agent.md");
  const routerCallableAgents = parseRouterAgents(routerText);

  const agentsDir = path.join(repoRoot, ".github/agents");
  const agentFiles = fs
    .readdirSync(agentsDir)
    .filter((name) => name.endsWith(".agent.md") && name !== "aiep-senior-staff-router.agent.md");

  const availableAgentNames = new Set(
    agentFiles.map((fileName) => {
      const text = fs.readFileSync(path.join(agentsDir, fileName), "utf8");
      return parseAgentName(text);
    })
  );

  for (const callableAgentName of routerCallableAgents) {
    assert.ok(
      availableAgentNames.has(callableAgentName),
      `Router references a non-existent or mismatched subagent: ${callableAgentName}`
    );
  }
});
