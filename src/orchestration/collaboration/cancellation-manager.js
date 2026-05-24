function toCompensationResult(step, executionError = null) {
  return {
    stepId: step.stepId,
    compensated: executionError === null,
    error: executionError ? String(executionError?.message || executionError) : null
  };
}

export async function cancelWorkflowWithCompensation({ workflowId, steps = [], reason }) {
  const cancelledAt = Date.now();
  const compensationResults = [];

  // Compensation runs in reverse to preserve dependency order.
  const reverseSteps = [...steps].reverse();

  for (const step of reverseSteps) {
    if (typeof step.compensate !== "function") {
      compensationResults.push({
        stepId: step.stepId,
        compensated: true,
        skipped: true,
        error: null
      });
      continue;
    }

    try {
      await step.compensate({ workflowId, reason, cancelledAt });
      compensationResults.push(toCompensationResult(step));
    } catch (error) {
      compensationResults.push(toCompensationResult(step, error));
    }
  }

  const failedCompensations = compensationResults.filter((entry) => entry.compensated !== true).length;

  return {
    workflowId,
    cancelled: true,
    reason,
    cancelledAt,
    compensationResults,
    cleanupSuccess: failedCompensations === 0
  };
}
