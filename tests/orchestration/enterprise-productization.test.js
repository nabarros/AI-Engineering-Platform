import test from "node:test";
import assert from "node:assert/strict";

import {
  createTenantPolicyPacks,
  buildComplianceEvidenceArtifact,
  enforceDataResidency,
  buildSlaSloControlPanel,
  createPlanAndQuotaEngine,
  buildSupportabilityBundle
} from "../../src/orchestration/enterprise-productization.js";

test("ENT-01 should provide tenant policy packs", () => {
  const packs = createTenantPolicyPacks();
  assert.equal(Object.keys(packs).length, 3);
  assert.equal(packs.regulated.controls.residencyEnforced, true);
});

test("ENT-02 should build compliance evidence artifact", () => {
  const artifact = buildComplianceEvidenceArtifact({ tenantId: "t1", controls: ["CC6.1"] });
  assert.equal(artifact.signed, true);
  assert.equal(artifact.frameworkMappings.SOC2.length, 1);
});

test("ENT-03 should enforce data residency", () => {
  const denied = enforceDataResidency({ tenantRegion: "eu-west", requestedRegion: "us-east", allowedRegions: ["eu-west"] });
  assert.equal(denied.allowed, false);

  const allowed = enforceDataResidency({ tenantRegion: "eu-west", requestedRegion: "eu-west", allowedRegions: ["eu-west"] });
  assert.equal(allowed.allowed, true);
});

test("ENT-04 should build SLA and SLO control panel summary", () => {
  const panel = buildSlaSloControlPanel({
    tenantId: "t1",
    targets: { availability: 0.99, latencyP95Ms: 1000 },
    windows: [{ availability: 0.995, latencyP95Ms: 850, errorRate: 0.01 }]
  });

  assert.equal(panel.adherence.availabilityOk, true);
  assert.equal(panel.adherence.latencyOk, true);
});

test("ENT-05 should enforce billing plan quotas", () => {
  const engine = createPlanAndQuotaEngine({
    plans: {
      pro: { monthlyQuota: 100 }
    }
  });

  const first = engine.consume({ tenantId: "t1", planId: "pro", amount: 60 });
  assert.equal(first.allowed, true);

  const second = engine.consume({ tenantId: "t1", planId: "pro", amount: 50 });
  assert.equal(second.allowed, false);
  assert.equal(second.code, "QUOTA_EXCEEDED");
});

test("ENT-06 should build supportability bundle export", () => {
  const bundle = buildSupportabilityBundle({
    requestId: "r1",
    trace: { step: 1 },
    policyDecision: { allowed: true },
    tokenCost: { total: 1200 },
    verification: { pass: true }
  });

  assert.equal(bundle.requestId, "r1");
  assert.equal(bundle.verification.pass, true);
});
