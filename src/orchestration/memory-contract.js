export const MEMORY_LAYER_CONTRACT_VERSION = "1.0.0";

export const MEMORY_LAYERS = Object.freeze([
  "working",
  "episodic",
  "semantic",
  "procedural"
]);

export const LEGACY_SCOPE_ALIASES = Object.freeze({
  session: "working",
  repository: "semantic",
  patterns: "procedural"
});

function clamp01(value, fallback = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeStringField(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeStringField(item))
    .filter(Boolean);
}

export function resolveMemoryLayer(scopeOrLayer) {
  const input = String(scopeOrLayer || "").trim().toLowerCase();
  if (MEMORY_LAYERS.includes(input)) {
    return input;
  }

  const aliasLayer = LEGACY_SCOPE_ALIASES[input];
  if (aliasLayer) {
    return aliasLayer;
  }

  throw new Error(`Unknown memory scope or layer: ${scopeOrLayer}`);
}

export function resolveLegacyScope(scopeOrLayer) {
  const input = String(scopeOrLayer || "").trim().toLowerCase();
  if (LEGACY_SCOPE_ALIASES[input]) {
    return input;
  }

  const foundAlias = Object.entries(LEGACY_SCOPE_ALIASES)
    .find(([, layer]) => layer === input);

  return foundAlias ? foundAlias[0] : null;
}

export function normalizeProvenance(provenance = {}) {
  if (typeof provenance === "number") {
    return {
      score: clamp01(provenance),
      confidence: clamp01(provenance),
      writer: null,
      strategy: null
    };
  }

  const scoreInput =
    typeof provenance.score === "number" ? provenance.score : provenance.confidence;

  return {
    score: clamp01(scoreInput, 1),
    confidence: clamp01(provenance.confidence, clamp01(scoreInput, 1)),
    writer: normalizeStringField(provenance.writer),
    strategy: normalizeStringField(provenance.strategy)
  };
}

export function normalizeSourceMetadata(source = {}) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {
      sourceType: "unknown",
      sourceId: null,
      filePath: null,
      symbol: null,
      requestId: null,
      agentId: null,
      tags: []
    };
  }

  return {
    sourceType: normalizeStringField(source.sourceType) || "unknown",
    sourceId: normalizeStringField(source.sourceId),
    filePath: normalizeStringField(source.filePath),
    symbol: normalizeStringField(source.symbol),
    requestId: normalizeStringField(source.requestId),
    agentId: normalizeStringField(source.agentId),
    tags: normalizeStringArray(source.tags)
  };
}

export function createMemoryMetadata({ scope, layer, nowMs = Date.now(), provenance, source } = {}) {
  const resolvedLayer = resolveMemoryLayer(layer || scope);
  const resolvedScope = resolveLegacyScope(scope || layer) || resolvedLayer;

  return {
    contractVersion: MEMORY_LAYER_CONTRACT_VERSION,
    scope: resolvedScope,
    layer: resolvedLayer,
    writtenAt: nowMs,
    updatedAt: nowMs,
    provenance: normalizeProvenance(provenance),
    source: normalizeSourceMetadata(source)
  };
}

export function validateMemoryContractEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return { valid: false, errors: ["Entry must be an object."] };
  }

  const errors = [];
  const metadata = entry.metadata;

  if (!metadata || typeof metadata !== "object") {
    errors.push("metadata is required.");
  } else {
    if (!MEMORY_LAYERS.includes(String(metadata.layer || ""))) {
      errors.push("metadata.layer must be one of working|episodic|semantic|procedural.");
    }
    if (typeof metadata.updatedAt !== "number") {
      errors.push("metadata.updatedAt must be a number.");
    }
    if (!metadata.provenance || typeof metadata.provenance !== "object") {
      errors.push("metadata.provenance is required.");
    }
    if (!metadata.source || typeof metadata.source !== "object") {
      errors.push("metadata.source is required.");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
