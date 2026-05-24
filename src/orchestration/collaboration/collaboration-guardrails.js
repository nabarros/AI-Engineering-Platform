export function enforceCollaborationGuardrails({
  path = [],
  maxHops = 1,
  restrictedEdges = [],
  requireEscalationFor = []
} = {}) {
  const violations = [];
  const hopCount = Math.max(0, path.length - 1);

  if (hopCount > maxHops) {
    violations.push({
      code: "MAX_HOPS_EXCEEDED",
      message: `Hop count ${hopCount} exceeds maxHops ${maxHops}.`
    });
  }

  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];

    const restricted = restrictedEdges.find((edge) => edge.from === from && edge.to === to);
    if (restricted) {
      violations.push({
        code: "RESTRICTED_EDGE",
        message: `Edge ${from}->${to} is restricted.`,
        edge: { from, to }
      });
    }

    if (requireEscalationFor.includes(to) && index === 0) {
      violations.push({
        code: "ESCALATION_REQUIRED",
        message: `Escalation required before routing to ${to}.`
      });
    }
  }

  return {
    allowed: violations.length === 0,
    violations
  };
}
