import crypto from "node:crypto";

function sortObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortObject(value[key]);
  }
  return sorted;
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

function normalizeDescription(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

export function buildContextHash(context = {}) {
  const payload = {
    task: {
      domain: String(context?.task?.domain || "general").toLowerCase(),
      risk: String(context?.task?.risk || "MEDIUM").toUpperCase(),
      description: normalizeDescription(context?.task?.description)
    },
    selectedAgent: String(context?.selectedAgent || "unknown"),
    objectiveId: String(context?.objectiveId || "objective:default"),
    workflowId: String(context?.workflowId || "workflow:default"),
    tokenBudgetTier: String(context?.tokenBudgetTier || "MEDIUM").toUpperCase(),
    latencyBudgetTier: String(context?.latencyBudgetTier || "MEDIUM").toUpperCase()
  };

  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function buildCacheKey(policyVersion, contextHash) {
  return `${String(policyVersion || "unknown-policy")}::${String(contextHash || "unknown-context")}`;
}

export function createResponseCache({ maxEntries = 400 } = {}) {
  const entries = new Map();
  const safeMaxEntries = Math.max(1, Number(maxEntries) || 400);
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  return {
    get(input = {}) {
      const key = buildCacheKey(input.policyVersion, input.contextHash);
      if (!entries.has(key)) {
        misses += 1;
        return null;
      }

      hits += 1;
      const entry = entries.get(key);
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },

    set(input = {}, value) {
      const key = buildCacheKey(input.policyVersion, input.contextHash);
      if (entries.has(key)) {
        entries.delete(key);
      }

      entries.set(key, {
        value,
        policyVersion: String(input.policyVersion || "unknown-policy"),
        contextHash: String(input.contextHash || "unknown-context"),
        updatedAt: Date.now()
      });

      while (entries.size > safeMaxEntries) {
        const firstKey = entries.keys().next().value;
        entries.delete(firstKey);
        evictions += 1;
      }
    },

    invalidateByPolicyVersion(policyVersion) {
      const target = String(policyVersion || "");
      let removed = 0;
      for (const [key, entry] of entries.entries()) {
        if (entry.policyVersion === target) {
          entries.delete(key);
          removed += 1;
        }
      }
      return removed;
    },

    invalidateByContextHash(contextHash) {
      const target = String(contextHash || "");
      let removed = 0;
      for (const [key, entry] of entries.entries()) {
        if (entry.contextHash === target) {
          entries.delete(key);
          removed += 1;
        }
      }
      return removed;
    },

    stats() {
      return {
        entries: entries.size,
        maxEntries: safeMaxEntries,
        hits,
        misses,
        evictions
      };
    }
  };
}
