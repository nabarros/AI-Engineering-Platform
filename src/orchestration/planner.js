function toSentence(value) {
  const text = String(value || "").trim();
  if (text.length === 0) return "";
  return text.endsWith(".") ? text : `${text}.`;
}

function splitAtomicSteps(taskDescription) {
  return String(taskDescription)
    .split(/\band\b|\bthen\b|\bafter\b|,/gi)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function createExecutionPlan(task) {
  const fragments = splitAtomicSteps(task.description);
  const steps = fragments.length > 0 ? fragments : [String(task.description || "Deliver the requested outcome")];

  return steps.map((step, index) => {
    const id = `step-${index + 1}`;
    return {
      id,
      title: toSentence(step),
      dependsOn: index === 0 ? [] : [`step-${index}`],
      acceptanceCriteria: [
        "Output is deterministic and validated.",
        "Security and policy checks pass.",
        "Tests or verification evidence attached."
      ]
    };
  });
}
