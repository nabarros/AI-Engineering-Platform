import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CAPABILITY_REGISTRY } from "../../src/orchestration/default-capability-registry.js";
import {
  generateAgentRosterFromRegistry,
  checkNamingParity,
  lintReportAgentCounts
} from "../../src/orchestration/docs-runtime-automation.js";

test("DOC-01 should generate roster docs payload from runtime registry", () => {
  const roster = generateAgentRosterFromRegistry(DEFAULT_CAPABILITY_REGISTRY);
  assert.equal(roster.count, DEFAULT_CAPABILITY_REGISTRY.length);
});

test("DOC-02 should enforce naming parity checks", () => {
  const runtimeIds = ["A", "B"];
  const parity = checkNamingParity({
    runtimeIds,
    routerCallableIds: ["A", "B"],
    frontmatterNames: ["A", "B"]
  });

  assert.equal(parity.pass, true);

  const mismatch = checkNamingParity({
    runtimeIds,
    routerCallableIds: ["A", "C"],
    frontmatterNames: ["A"]
  });
  assert.equal(mismatch.pass, false);
});

test("DOC-03 should lint outdated agent counts in reports", () => {
  const lint = lintReportAgentCounts({ reportText: "All 8 routing-system agents", expectedCount: 11 });
  assert.equal(lint.pass, false);
  assert.equal(lint.findings.length, 1);
});
