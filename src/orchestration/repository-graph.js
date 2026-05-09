function asString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function normalizeOwnershipLinks(payload) {
  if (Array.isArray(payload?.owners)) {
    return normalizeStringArray(payload.owners);
  }

  if (typeof payload?.ownerTeam === "string") {
    return [payload.ownerTeam.trim()].filter(Boolean);
  }

  return [];
}

export function normalizeRepositoryGraphPayload(payload = {}) {
  return {
    symbols: normalizeStringArray(payload.symbols),
    dependencies: normalizeStringArray(payload.dependencies),
    ownership: normalizeOwnershipLinks(payload),
    links: normalizeStringArray(payload.links),
    summary: asString(payload.summary)
  };
}

export function createRepositoryGraphRecord(key, payload, options = {}, nowMs = Date.now()) {
  const normalizedKey = asString(key);
  if (!normalizedKey) {
    throw new Error("Repository graph record requires a non-empty key.");
  }

  const ttlMs = typeof options.ttlMs === "number" ? options.ttlMs : null;

  return {
    key: normalizedKey,
    payload: normalizeRepositoryGraphPayload(payload),
    updatedAt: nowMs,
    sourceMetadata: options.source || null,
    expiresAt: ttlMs === null ? null : nowMs + ttlMs
  };
}

export function summarizeRepositoryGraph(records, options = {}) {
  const nowMs = typeof options.nowMs === "number" ? options.nowMs : Date.now();
  const staleAfterMs = typeof options.staleAfterMs === "number" ? options.staleAfterMs : 30 * 24 * 60 * 60 * 1000;

  let nodeCount = 0;
  let symbolLinkCount = 0;
  let dependencyLinkCount = 0;
  let ownershipLinkCount = 0;
  let staleNodeCount = 0;
  let criticalIntegrityErrors = 0;

  for (const record of records) {
    nodeCount += 1;
    const payload = record.payload || {};

    const symbolCount = Array.isArray(payload.symbols) ? payload.symbols.length : -1;
    const dependencyCount = Array.isArray(payload.dependencies) ? payload.dependencies.length : -1;
    const ownershipCount = Array.isArray(payload.ownership) ? payload.ownership.length : -1;

    if (symbolCount < 0 || dependencyCount < 0 || ownershipCount < 0) {
      criticalIntegrityErrors += 1;
    }

    if (symbolCount > 0) symbolLinkCount += symbolCount;
    if (dependencyCount > 0) dependencyLinkCount += dependencyCount;
    if (ownershipCount > 0) ownershipLinkCount += ownershipCount;

    if (typeof record.updatedAt !== "number" || nowMs - record.updatedAt > staleAfterMs) {
      staleNodeCount += 1;
    }
  }

  return {
    generatedAt: nowMs,
    nodeCount,
    symbolLinkCount,
    dependencyLinkCount,
    ownershipLinkCount,
    staleNodeCount,
    criticalIntegrityErrors,
    healthy: criticalIntegrityErrors === 0
  };
}

export function scoreRepositoryGraphSignals(payload, intentTerm, tokens, baseScore) {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const normalizedBlob = JSON.stringify(payload).toLowerCase();
  let graphScore = 0;

  const matchesIntent = intentTerm && normalizedBlob.includes(intentTerm);
  if (matchesIntent) {
    graphScore += 2;
  }

  for (const token of tokens) {
    if (normalizedBlob.includes(token)) {
      graphScore += 0.75;
    }
  }

  if (Array.isArray(payload.symbols) && payload.symbols.length > 0) {
    graphScore += 1.5;
  }
  if (Array.isArray(payload.dependencies) && payload.dependencies.length > 0) {
    graphScore += 1.25;
  }
  if (Array.isArray(payload.ownership) && payload.ownership.length > 0) {
    graphScore += 1;
  }
  if (Array.isArray(payload.relatedTo) && payload.relatedTo.length > 0) {
    graphScore += 1.25;
  }
  if (Array.isArray(payload.links) && payload.links.length > 0) {
    graphScore += 1.25;
  }
  if (typeof payload.ownerTeam === "string" && payload.ownerTeam.trim()) {
    graphScore += 0.75;
  }
  if (typeof payload.specialistId === "string" && payload.specialistId.trim()) {
    graphScore += 0.75;
  }

  if (baseScore > 0 && graphScore > 0) {
    graphScore += 0.5;
  }

  return Number(graphScore.toFixed(4));
}
