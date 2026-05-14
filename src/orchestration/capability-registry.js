const RISK_ORDER = Object.freeze({ LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 });
export const CAPABILITY_SCHEMA_VERSION = "1.0.0";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeRisk(value) {
  const risk = String(value || "MEDIUM").toUpperCase();
  return Object.hasOwn(RISK_ORDER, risk) ? risk : "MEDIUM";
}

function assertNonEmptyString(value, message) {
  assert(typeof value === "string" && value.trim().length > 0, message);
}

function assertMetadataSchema(metadata, capabilityId) {
  assert(metadata && typeof metadata === "object" && !Array.isArray(metadata), `Capability ${capabilityId} metadata must be an object.`);
  assertNonEmptyString(metadata.ownerTeam, `Capability ${capabilityId} metadata.ownerTeam must be a non-empty string.`);
  assert(Array.isArray(metadata.skillScopes) && metadata.skillScopes.length > 0, `Capability ${capabilityId} metadata.skillScopes must be a non-empty array.`);
  for (const skillScope of metadata.skillScopes) {
    assertNonEmptyString(skillScope, `Capability ${capabilityId} metadata.skillScopes entries must be non-empty strings.`);
  }
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
    assertMetadataSchema(item.metadata, item.id);
  }

  return true;
}

export function getCapabilityRegistrySchema() {
  return {
    version: CAPABILITY_SCHEMA_VERSION,
    requiredFields: [
      "id",
      "domains",
      "qualityScore",
      "tokenCostTier",
      "latencyTier",
      "supportsVerificationGate",
      "supportsMemoryWrites",
      "metadata",
      "metadata.ownerTeam",
      "metadata.skillScopes"
    ]
  };
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

export function findBestCandidatesForCompoundTask(task, registry) {
  const domains = Array.isArray(task.domains) ? task.domains : [task.domain || "general"];
  const risk = normalizeRisk(task.risk || "MEDIUM");

  const domainCandidates = {};
  let coveredDomains = 0;

  for (const domain of domains) {
    const normalized = domain.toLowerCase();
    const candidates = registry
      .filter((cap) => {
        const domainMatch = cap.domains.includes(normalized) || cap.domains.includes("general");
        return domainMatch && canHandleRisk(cap, risk);
      })
      .sort((a, b) => {
        const aExact = a.domains.includes(normalized) ? 1 : 0;
        const bExact = b.domains.includes(normalized) ? 1 : 0;
        if (bExact !== aExact) return bExact - aExact;
        return b.qualityScore - a.qualityScore;
      });

    domainCandidates[normalized] = candidates;
    if (candidates.length > 0) coveredDomains++;
  }

  const coverageScore = domains.length > 0 ? coveredDomains / domains.length : 0;

  return {
    domainCandidates,
    coverageScore,
    totalDomains: domains.length,
    coveredDomains
  };
}

export function getCapabilityById(id, registry) {
  return registry.find((cap) => cap.id === id) || null;
}

export function getDomainCoverage(registry) {
  const coverage = {};

  for (const capability of registry) {
    for (const domain of capability.domains) {
      if (!coverage[domain]) {
        coverage[domain] = [];
      }
      coverage[domain].push(capability.id);
    }
  }

  return coverage;
}

export { RISK_ORDER, normalizeRisk };
