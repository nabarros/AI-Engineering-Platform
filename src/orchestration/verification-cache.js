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

function buildEvidenceSignature(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return "none";
  }

  return JSON.stringify(sortObject(evidence));
}

function buildCacheKey({ task, selectedAgent, executionEvidence }) {
  const domain = String(task?.domain || "general").toLowerCase();
  const risk = String(task?.risk || "MEDIUM").toUpperCase();
  const agent = String(selectedAgent || "unknown");
  const signature = buildEvidenceSignature(executionEvidence);
  return `${domain}|${risk}|${agent}|${signature}`;
}

export function createVerificationCache({ maxEntries = 300 } = {}) {
  const safeMaxEntries = Math.max(1, Number(maxEntries) || 300);
  const entries = new Map();
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  return {
    get(request) {
      const key = buildCacheKey(request || {});
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

    set(request, verification) {
      const key = buildCacheKey(request || {});
      if (entries.has(key)) {
        entries.delete(key);
      }

      entries.set(key, {
        value: verification,
        updatedAt: Date.now()
      });

      while (entries.size > safeMaxEntries) {
        const firstKey = entries.keys().next().value;
        entries.delete(firstKey);
        evictions += 1;
      }
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
