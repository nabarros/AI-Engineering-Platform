export const DELEGATION_TEMPLATE_VERSION = "1.0.0";
export const MEMORY_HANDOFF_PACKET_VERSION = "1.0.0";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

export function validateMemoryHandoffPacket(packet) {
  const errors = [];

  if (!packet || typeof packet !== "object") {
    return { valid: false, errors: ["Memory handoff packet must be an object."] };
  }

  if (packet.version !== MEMORY_HANDOFF_PACKET_VERSION) {
    errors.push(`version must be ${MEMORY_HANDOFF_PACKET_VERSION}.`);
  }

  if (!isNonEmptyString(packet.fromAgent)) {
    errors.push("fromAgent is required.");
  }

  if (!isNonEmptyString(packet.toAgent)) {
    errors.push("toAgent is required.");
  }

  if (!isNonEmptyString(packet.taskId)) {
    errors.push("taskId is required.");
  }

  if (!Array.isArray(packet.entries) || packet.entries.length === 0) {
    errors.push("entries must be a non-empty array.");
  } else {
    for (const entry of packet.entries) {
      if (!entry || typeof entry !== "object") {
        errors.push("entries must contain objects.");
        continue;
      }

      if (!isNonEmptyString(entry.key)) {
        errors.push("entry.key is required.");
      }
      if (!isNonEmptyString(entry.layer)) {
        errors.push("entry.layer is required.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function buildMemoryHandoffPacket({ fromAgent, toAgent, taskId, entries = [], metadata = {}, generatedAtMs = Date.now() }) {
  const packet = {
    version: MEMORY_HANDOFF_PACKET_VERSION,
    fromAgent,
    toAgent,
    taskId,
    generatedAtMs,
    metadata: {
      summary: isNonEmptyString(metadata.summary) ? metadata.summary : "",
      retrievalIntent: isNonEmptyString(metadata.retrievalIntent) ? metadata.retrievalIntent : "general"
    },
    entries: Array.isArray(entries)
      ? entries.map((entry) => ({
        key: entry?.key,
        layer: entry?.layer,
        value: entry?.value,
        source: entry?.source || null,
        provenanceScore: typeof entry?.provenanceScore === "number" ? entry.provenanceScore : 1
      }))
      : []
  };

  const validation = validateMemoryHandoffPacket(packet);
  if (!validation.valid) {
    throw new Error(`Invalid memory handoff packet: ${validation.errors.join(" ")}`);
  }

  return packet;
}

export function validateDelegationContract(contract) {
  const errors = [];

  if (!contract || typeof contract !== "object") {
    return { valid: false, errors: ["Contract must be an object."] };
  }

  if (contract.templateVersion !== DELEGATION_TEMPLATE_VERSION) {
    errors.push(`templateVersion must be ${DELEGATION_TEMPLATE_VERSION}.`);
  }

  if (!isNonEmptyString(contract.fromAgent)) {
    errors.push("fromAgent is required.");
  }

  if (!isNonEmptyString(contract.toAgent)) {
    errors.push("toAgent is required.");
  }

  if (!contract.task || typeof contract.task !== "object") {
    errors.push("task is required.");
  } else {
    if (!isNonEmptyString(contract.task.taskId)) {
      errors.push("task.taskId is required.");
    }
    if (!isNonEmptyString(contract.task.objective)) {
      errors.push("task.objective is required.");
    }
    if (!isStringArray(contract.task.constraints)) {
      errors.push("task.constraints must be a non-empty string array.");
    }
    if (!isStringArray(contract.task.requiredContext)) {
      errors.push("task.requiredContext must be a non-empty string array.");
    }
  }

  if (contract.handoff?.memoryHandoffPacket) {
    const packetValidation = validateMemoryHandoffPacket(contract.handoff.memoryHandoffPacket);
    if (!packetValidation.valid) {
      errors.push(`handoff.memoryHandoffPacket invalid: ${packetValidation.errors.join(" ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function buildDelegationContract({ fromAgent, toAgent, task, handoff = {} }) {
  const memoryHandoffPacket = handoff.memoryHandoffPacket
    ? buildMemoryHandoffPacket({
      fromAgent,
      toAgent,
      taskId: task?.taskId,
      ...handoff.memoryHandoffPacket
    })
    : null;

  const contract = {
    templateVersion: DELEGATION_TEMPLATE_VERSION,
    fromAgent,
    toAgent,
    task: {
      taskId: task?.taskId,
      objective: task?.objective,
      constraints: Array.isArray(task?.constraints) ? task.constraints : [],
      requiredContext: Array.isArray(task?.requiredContext) ? task.requiredContext : []
    },
    handoff: {
      summary: String(handoff.summary || ""),
      artifacts: Array.isArray(handoff.artifacts) ? handoff.artifacts : [],
      timestampMs: typeof handoff.timestampMs === "number" ? handoff.timestampMs : Date.now(),
      memoryHandoffPacket
    }
  };

  const validation = validateDelegationContract(contract);
  if (!validation.valid) {
    throw new Error(`Invalid delegation contract: ${validation.errors.join(" ")}`);
  }

  return contract;
}
