export const CONNECTOR_CONTRACT_VERSION = "1.0.0";

const ALLOWED_AUTH_TYPES = new Set(["oauth2", "api-key", "service-account"]);
const ALLOWED_ACTION_MODES = new Set(["read", "write"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

function validateActionDefinitions(actions, errors) {
  if (!actions || typeof actions !== "object" || Array.isArray(actions)) {
    errors.push("actions must be an object keyed by action name.");
    return;
  }

  const entries = Object.entries(actions);
  if (entries.length === 0) {
    errors.push("actions must define at least one action.");
    return;
  }

  for (const [name, definition] of entries) {
    if (!isNonEmptyString(name)) {
      errors.push("actions keys must be non-empty strings.");
      continue;
    }

    if (!definition || typeof definition !== "object") {
      errors.push(`actions.${name} must be an object.`);
      continue;
    }

    if (!ALLOWED_ACTION_MODES.has(definition.mode)) {
      errors.push(`actions.${name}.mode must be read or write.`);
    }

    if (definition.mode === "write" && definition.requiresApproval !== true) {
      errors.push(`actions.${name} requiresApproval must be true for write actions.`);
    }
  }
}

export function validateConnectorDefinition(definition) {
  const errors = [];

  if (!definition || typeof definition !== "object") {
    return { valid: false, errors: ["Connector definition must be an object."] };
  }

  if (definition.contractVersion !== CONNECTOR_CONTRACT_VERSION) {
    errors.push(`contractVersion must be ${CONNECTOR_CONTRACT_VERSION}.`);
  }

  if (!isNonEmptyString(definition.id)) {
    errors.push("id is required.");
  }

  if (!isNonEmptyString(definition.name)) {
    errors.push("name is required.");
  }

  if (!isNonEmptyString(definition.version)) {
    errors.push("version is required.");
  }

  const auth = definition.auth;
  if (!auth || typeof auth !== "object") {
    errors.push("auth is required.");
  } else {
    if (!ALLOWED_AUTH_TYPES.has(auth.type)) {
      errors.push("auth.type must be oauth2, api-key, or service-account.");
    }

    if (!isStringArray(auth.scopes) || auth.scopes.length === 0) {
      errors.push("auth.scopes must be a non-empty string array.");
    }
  }

  const quotas = definition.quotas;
  if (!quotas || typeof quotas !== "object" || typeof quotas.rateLimitPerMinute !== "number" || quotas.rateLimitPerMinute <= 0) {
    errors.push("quotas.rateLimitPerMinute must be a positive number.");
  }

  const health = definition.health;
  if (!health || typeof health !== "object" || typeof health.timeoutMs !== "number" || health.timeoutMs <= 0) {
    errors.push("health.timeoutMs must be a positive number.");
  }

  const cost = definition.cost;
  if (
    !cost ||
    typeof cost !== "object" ||
    typeof cost.unitCostUsd !== "number" ||
    cost.unitCostUsd < 0 ||
    !isNonEmptyString(cost.billingUnit)
  ) {
    errors.push("cost.unitCostUsd and cost.billingUnit are required.");
  }

  const audit = definition.audit;
  if (!audit || typeof audit !== "object" || !isStringArray(audit.fields) || audit.fields.length === 0) {
    errors.push("audit.fields must be a non-empty string array.");
  }

  validateActionDefinitions(definition.actions, errors);

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createConnectorDefinition(input) {
  const normalized = {
    contractVersion: CONNECTOR_CONTRACT_VERSION,
    id: input?.id,
    name: input?.name,
    version: input?.version,
    auth: {
      type: input?.auth?.type,
      scopes: Array.isArray(input?.auth?.scopes) ? input.auth.scopes : []
    },
    quotas: {
      rateLimitPerMinute: input?.quotas?.rateLimitPerMinute
    },
    health: {
      timeoutMs: input?.health?.timeoutMs
    },
    cost: {
      unitCostUsd: input?.cost?.unitCostUsd,
      billingUnit: input?.cost?.billingUnit
    },
    audit: {
      fields: Array.isArray(input?.audit?.fields) ? input.audit.fields : []
    },
    actions: input?.actions || {}
  };

  const validation = validateConnectorDefinition(normalized);
  if (!validation.valid) {
    throw new Error(`Invalid connector definition: ${validation.errors.join(" ")}`);
  }

  return Object.freeze(normalized);
}
