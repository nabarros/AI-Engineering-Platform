export const DELEGATION_TEMPLATE_VERSION = "1.0.0";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
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

  return {
    valid: errors.length === 0,
    errors
  };
}

export function buildDelegationContract({ fromAgent, toAgent, task, handoff = {} }) {
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
      timestampMs: typeof handoff.timestampMs === "number" ? handoff.timestampMs : Date.now()
    }
  };

  const validation = validateDelegationContract(contract);
  if (!validation.valid) {
    throw new Error(`Invalid delegation contract: ${validation.errors.join(" ")}`);
  }

  return contract;
}
