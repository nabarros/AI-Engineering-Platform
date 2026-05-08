const RISK_ORDER = Object.freeze({ LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 });

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeRisk(value) {
  const risk = String(value || "MEDIUM").toUpperCase();
  return Object.hasOwn(RISK_ORDER, risk) ? risk : "MEDIUM";
}

export function validateCapabilityRegistry(registry) {
  assert(Array.isArray(registry), "Capability registry must be an array.");

  for (const item of registry) {
    assert(typeof item.id === "string" && item.id.length > 0, "Capability id is required.");
    assert(Array.isArray(item.domains) && item.domains.length > 0, `Capability ${item.id} requires at least one domain.`);
    assert(typeof item.qualityScore === "number" && item.qualityScore >= 0 && item.qualityScore <= 1, `Capability ${item.id} qualityScore must be between 0 and 1.`);
    assert(["LOW", "MEDIUM", "HIGH"].includes(item.tokenCostTier), `Capability ${item.id} tokenCostTier is invalid.`);
    assert(["LOW", "MEDIUM", "HIGH"].includes(item.latencyTier), `Capability ${item.id} latencyTier is invalid.`);
    assert(typeof item.supportsVerificationGate === "boolean", `Capability ${item.id} supportsVerificationGate must be boolean.`);
    assert(typeof item.supportsMemoryWrites === "boolean", `Capability ${item.id} supportsMemoryWrites must be boolean.`);
  }

  return true;
}

export function canHandleRisk(capability, requestedRisk) {
  const maxRisk = normalizeRisk(capability.maxRisk || "MEDIUM");
  const risk = normalizeRisk(requestedRisk || "MEDIUM");
  return RISK_ORDER[maxRisk] >= RISK_ORDER[risk];
}

export function findCandidates(task, registry) {
  const domain = String(task.domain || "general").toLowerCase();
  const risk = normalizeRisk(task.risk || "MEDIUM");

  return registry.filter((capability) => {
    const domainMatch = capability.domains.includes(domain) || capability.domains.includes("general");
    return domainMatch && canHandleRisk(capability, risk);
  });
}

export { RISK_ORDER, normalizeRisk };
