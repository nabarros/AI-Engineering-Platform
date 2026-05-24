export const COLLABORATION_PROTOCOL_VERSION = "1.0.0";

export const COLLABORATION_MESSAGE_TYPES = Object.freeze([
  "handoff",
  "ack",
  "retry",
  "cancel",
  "heartbeat",
  "negotiate",
  "compensate"
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isKnownType(type) {
  return COLLABORATION_MESSAGE_TYPES.includes(type);
}

export function validateCollaborationMessage(message) {
  const errors = [];

  if (!message || typeof message !== "object") {
    return { valid: false, errors: ["message must be an object."] };
  }

  if (message.protocolVersion !== COLLABORATION_PROTOCOL_VERSION) {
    errors.push(`protocolVersion must be ${COLLABORATION_PROTOCOL_VERSION}.`);
  }

  if (!isNonEmptyString(message.messageId)) {
    errors.push("messageId is required.");
  }

  if (!isNonEmptyString(message.workflowId)) {
    errors.push("workflowId is required.");
  }

  if (!isNonEmptyString(message.fromAgent)) {
    errors.push("fromAgent is required.");
  }

  if (!isNonEmptyString(message.toAgent)) {
    errors.push("toAgent is required.");
  }

  if (!isKnownType(message.type)) {
    errors.push(`type must be one of ${COLLABORATION_MESSAGE_TYPES.join(", ")}.`);
  }

  if (typeof message.timestampMs !== "number") {
    errors.push("timestampMs must be a number.");
  }

  if (!message.payload || typeof message.payload !== "object") {
    errors.push("payload must be an object.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createCollaborationMessage(input) {
  const message = {
    protocolVersion: COLLABORATION_PROTOCOL_VERSION,
    messageId: input?.messageId,
    workflowId: input?.workflowId,
    fromAgent: input?.fromAgent,
    toAgent: input?.toAgent,
    type: input?.type,
    timestampMs: typeof input?.timestampMs === "number" ? input.timestampMs : Date.now(),
    payload: input?.payload || {}
  };

  const validation = validateCollaborationMessage(message);
  if (!validation.valid) {
    throw new Error(`Invalid collaboration message: ${validation.errors.join(" ")}`);
  }

  return Object.freeze(message);
}
