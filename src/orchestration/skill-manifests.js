import {
  COMPILED_SKILL_POLICY_ROWS,
  SKILL_POLICY_MATRIX_VERSION,
  listCompiledSkillPoliciesForAgent,
  resolveCompiledSkillPolicy
} from "./skill-policy-matrix.js";

const TASK_KEYWORD_SKILL_MAP = Object.freeze([
  { keyword: "bugfix", skills: ["debugging", "testing"] },
  { keyword: "bug", skills: ["debugging", "testing"] },
  { keyword: "fix", skills: ["debugging", "testing"] },
  { keyword: "feature", skills: ["feature-development", "testing"] },
  { keyword: "implement", skills: ["feature-development", "testing"] },
  { keyword: "review", skills: ["review", "testing"] },
  { keyword: "security", skills: ["security", "testing"] },
  { keyword: "secure", skills: ["security", "testing"] },
  { keyword: "ui", skills: ["ui", "feature-development"] },
  { keyword: "frontend", skills: ["frontend", "ui"] },
  { keyword: "backend", skills: ["backend", "feature-development"] },
  { keyword: "performance", skills: ["performance", "testing"] }
]);

const SKILL_SUBSET_CACHE_MAX_ENTRIES = 512;
const SKILL_SUBSET_RESOLUTION_CACHE = new Map();

function normalizeSkill(skill) {
  return String(skill || "").trim().toLowerCase();
}

function normalizeDomain(domain) {
  return String(domain || "general").trim().toLowerCase() || "general";
}

function normalizeRisk(risk) {
  const normalized = String(risk || "MEDIUM").toUpperCase();
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(normalized) ? normalized : "MEDIUM";
}

function dedupeSkills(skills) {
  const values = new Set();
  for (const skill of skills) {
    const normalized = normalizeSkill(skill);
    if (normalized) {
      values.add(normalized);
    }
  }
  return [...values].sort();
}

function buildLegacyMinimumManifests() {
  const manifests = {};
  for (const row of COMPILED_SKILL_POLICY_ROWS) {
    if (!manifests[row.agentId]) {
      manifests[row.agentId] = new Set();
    }
    for (const skill of row.allow) {
      manifests[row.agentId].add(skill);
    }
  }

  const normalized = {};
  for (const [agentId, skillSet] of Object.entries(manifests)) {
    normalized[agentId] = [...skillSet].sort();
  }

  return Object.freeze(normalized);
}

export const MINIMUM_SKILL_MANIFESTS = buildLegacyMinimumManifests();

export const SKILL_MANIFEST_SCHEMA_V2 = Object.freeze({
  schemaVersion: "2.0.0",
  sourcePolicyVersion: SKILL_POLICY_MATRIX_VERSION,
  requiredFields: Object.freeze(["schemaVersion", "agentId", "domain", "risk", "allow", "deny", "exception"]),
  exceptionFields: Object.freeze(["expiresAtRequired", "maxTtlMs"])
});

function buildSubsetCacheKey({ agentId, task, requiredSkills }) {
  const normalizedAgentId = String(agentId || "").trim();
  const normalizedDomain = normalizeDomain(task?.domain);
  const normalizedRisk = normalizeRisk(task?.risk);
  const signature = dedupeSkills(requiredSkills).join("|");
  return `${normalizedAgentId}::${normalizedDomain}::${normalizedRisk}::${signature}`;
}

function clonePolicyResult(result) {
  return {
    ...result,
    requiredSkills: [...result.requiredSkills],
    allowedSkills: [...result.allowedSkills],
    deniedSkills: [...result.deniedSkills],
    deniedByExplicitPolicy: [...result.deniedByExplicitPolicy],
    exceptionAllowedSkills: [...result.exceptionAllowedSkills],
    denialReasons: result.denialReasons.map((reason) => ({ ...reason })),
    compiledManifest: {
      ...result.compiledManifest,
      allow: [...result.compiledManifest.allow],
      deny: [...result.compiledManifest.deny],
      exception: { ...result.compiledManifest.exception }
    },
    cache: { ...result.cache }
  };
}

function rememberSubsetResolution(cacheKey, result) {
  if (SKILL_SUBSET_RESOLUTION_CACHE.has(cacheKey)) {
    SKILL_SUBSET_RESOLUTION_CACHE.delete(cacheKey);
  }
  SKILL_SUBSET_RESOLUTION_CACHE.set(cacheKey, clonePolicyResult(result));

  while (SKILL_SUBSET_RESOLUTION_CACHE.size > SKILL_SUBSET_CACHE_MAX_ENTRIES) {
    const oldestKey = SKILL_SUBSET_RESOLUTION_CACHE.keys().next().value;
    SKILL_SUBSET_RESOLUTION_CACHE.delete(oldestKey);
  }
}

function validateSkillList(values, fieldName, errors) {
  if (!Array.isArray(values)) {
    errors.push(`${fieldName} must be an array.`);
    return [];
  }

  const normalized = dedupeSkills(values);
  if (normalized.length !== values.length) {
    errors.push(`${fieldName} must not contain duplicates or empty values.`);
  }
  return normalized;
}

export function resolveSkillManifestV2(agentId, { domain, risk } = {}) {
  const policy = resolveCompiledSkillPolicy({ agentId, domain, risk });
  if (!policy) {
    return {
      schemaVersion: SKILL_MANIFEST_SCHEMA_V2.schemaVersion,
      sourcePolicyVersion: SKILL_POLICY_MATRIX_VERSION,
      agentId: String(agentId || "").trim(),
      domain: normalizeDomain(domain),
      risk: normalizeRisk(risk),
      allow: [],
      deny: [],
      exception: {
        expiresAtRequired: true,
        maxTtlMs: 0
      }
    };
  }

  return {
    schemaVersion: SKILL_MANIFEST_SCHEMA_V2.schemaVersion,
    sourcePolicyVersion: SKILL_POLICY_MATRIX_VERSION,
    agentId: policy.agentId,
    domain: policy.domain,
    risk: policy.risk,
    allow: [...policy.allow],
    deny: [...policy.deny],
    exception: {
      expiresAtRequired: Boolean(policy.exception?.expiresAtRequired),
      maxTtlMs: Number(policy.exception?.maxTtlMs || 0)
    }
  };
}

export function validateSkillManifestV2(manifest) {
  const errors = [];
  const normalizedAgentId = String(manifest?.agentId || "").trim();
  const normalizedDomain = normalizeDomain(manifest?.domain);
  const normalizedRisk = normalizeRisk(manifest?.risk);

  if (manifest?.schemaVersion !== SKILL_MANIFEST_SCHEMA_V2.schemaVersion) {
    errors.push(`schemaVersion must equal ${SKILL_MANIFEST_SCHEMA_V2.schemaVersion}.`);
  }
  if (!normalizedAgentId) {
    errors.push("agentId is required.");
  }

  const allow = validateSkillList(manifest?.allow, "allow", errors);
  const deny = validateSkillList(manifest?.deny, "deny", errors);
  const denySet = new Set(deny);
  const overlap = allow.filter((skill) => denySet.has(skill));
  if (overlap.length > 0) {
    errors.push(`allow and deny overlap on: ${overlap.join(", ")}.`);
  }

  const exception = manifest?.exception || {};
  if (typeof exception.expiresAtRequired !== "boolean") {
    errors.push("exception.expiresAtRequired must be boolean.");
  }
  if (typeof exception.maxTtlMs !== "number" || exception.maxTtlMs <= 0) {
    errors.push("exception.maxTtlMs must be a positive number.");
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedManifest: {
      schemaVersion: manifest?.schemaVersion,
      sourcePolicyVersion: manifest?.sourcePolicyVersion,
      agentId: normalizedAgentId,
      domain: normalizedDomain,
      risk: normalizedRisk,
      allow,
      deny,
      exception: {
        expiresAtRequired: Boolean(exception.expiresAtRequired),
        maxTtlMs: Number(exception.maxTtlMs || 0)
      }
    }
  };
}

export function lintCompiledSkillPolicies() {
  const reports = [];
  for (const row of COMPILED_SKILL_POLICY_ROWS) {
    const manifest = resolveSkillManifestV2(row.agentId, {
      domain: row.domain,
      risk: row.risk
    });
    const validation = validateSkillManifestV2(manifest);
    reports.push({
      agentId: row.agentId,
      domain: row.domain,
      risk: row.risk,
      valid: validation.valid,
      errors: validation.errors
    });
  }

  return {
    valid: reports.every((report) => report.valid),
    reports
  };
}

export function resolveAllowedSkillsForAgent(agentId, { domain, risk } = {}) {
  const policy = resolveCompiledSkillPolicy({ agentId, domain, risk });
  return policy ? [...policy.allow] : [];
}

export function inferRequiredSkillsFromTask(task, { risk, targetAgent } = {}) {
  const required = new Set(["testing"]);
  const normalizedRisk = normalizeRisk(risk || task?.risk || "MEDIUM");
  const domain = normalizeDomain(task?.domain);
  const text = [task?.domain, task?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const rule of TASK_KEYWORD_SKILL_MAP) {
    if (text.includes(rule.keyword)) {
      for (const skill of rule.skills) {
        required.add(skill);
      }
    }
  }

  if (required.size === 1) {
    required.add("feature-development");
  }

  if (normalizedRisk === "HIGH" || normalizedRisk === "CRITICAL") {
    required.add("security");
    required.add("review");
  }

  if (domain && domain !== "general") {
    const targetManifest = resolveAllowedSkillsForAgent(targetAgent, {
      domain,
      risk: normalizedRisk
    });
    if (targetManifest.length > 0) {
      required.add(domain);
    }
  }

  return [...required].sort();
}

export function enforceSkillSubsetPolicy({ agentId, task, exceptionRegistry = null, nowMs } = {}) {
  const manifest = resolveSkillManifestV2(agentId, {
    domain: task?.domain,
    risk: task?.risk
  });
  const manifestValidation = validateSkillManifestV2(manifest);
  const allowedSkills = manifestValidation.normalizedManifest.allow;
  const deniedByPolicy = new Set(manifestValidation.normalizedManifest.deny);
  const requiredSkills = inferRequiredSkillsFromTask(task, {
    risk: task?.risk,
    targetAgent: agentId
  });

  const useCache = !exceptionRegistry;
  const cacheKey = buildSubsetCacheKey({ agentId, task, requiredSkills });
  if (useCache && SKILL_SUBSET_RESOLUTION_CACHE.has(cacheKey)) {
    const cached = clonePolicyResult(SKILL_SUBSET_RESOLUTION_CACHE.get(cacheKey));
    cached.cache = { hit: true, key: cacheKey };
    return cached;
  }

  const allowedSkillSet = new Set(allowedSkills);
  const exceptionAllowedSkills = [];
  const deniedSkills = [];
  const deniedByExplicitPolicy = [];
  const denialReasons = [];

  if (!manifestValidation.valid) {
    for (const error of manifestValidation.errors) {
      denialReasons.push({
        code: "SKILL_POLICY_SCHEMA_INVALID",
        skill: null,
        message: error
      });
    }
  }

  for (const skill of requiredSkills) {
    if (deniedByPolicy.has(skill)) {
      deniedSkills.push(skill);
      deniedByExplicitPolicy.push(skill);
      denialReasons.push({
        code: "SKILL_EXPLICIT_DENY",
        skill,
        message: `Required skill '${skill}' is explicitly denied for ${agentId}.`
      });
      continue;
    }

    if (allowedSkillSet.has(skill)) {
      continue;
    }

    const allowedByException = Boolean(
      exceptionRegistry && exceptionRegistry.isSkillAllowedByException(agentId, skill, nowMs)
    );

    if (allowedByException) {
      exceptionAllowedSkills.push(skill);
      continue;
    }

    deniedSkills.push(skill);
    denialReasons.push({
      code: "SKILL_NOT_ALLOWLISTED",
      skill,
      message: `Required skill '${skill}' is not in the compiled allowlist for ${agentId}.`
    });
  }

  const result = {
    allowed: deniedSkills.length === 0,
    requiredSkills,
    allowedSkills,
    deniedSkills,
    deniedByExplicitPolicy,
    exceptionAllowedSkills,
    denialReasons,
    compiledManifest: manifestValidation.normalizedManifest,
    cache: {
      hit: false,
      key: cacheKey
    }
  };

  if (useCache) {
    rememberSubsetResolution(cacheKey, result);
  }

  return result;
}

export function runSkillSubsetDryRun({ agentId, task, exceptionRegistry = null, nowMs } = {}) {
  const policy = enforceSkillSubsetPolicy({
    agentId,
    task,
    exceptionRegistry,
    nowMs
  });

  const messages = policy.denialReasons.map((reason) => `${reason.code}: ${reason.message}`);

  return {
    allowed: policy.allowed,
    blockedReasonCodes: policy.denialReasons.map((reason) => reason.code),
    messages,
    policy
  };
}

export function getSkillSubsetCacheStats() {
  return {
    entries: SKILL_SUBSET_RESOLUTION_CACHE.size,
    maxEntries: SKILL_SUBSET_CACHE_MAX_ENTRIES
  };
}

export function clearSkillSubsetResolutionCache() {
  SKILL_SUBSET_RESOLUTION_CACHE.clear();
}

export { SKILL_POLICY_MATRIX_VERSION, listCompiledSkillPoliciesForAgent };
