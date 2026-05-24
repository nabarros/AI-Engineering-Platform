const DEFAULT_NEGOTIATION_POLICY = Object.freeze({
  maxHops: 1,
  allowedEdges: []
});

function isEdgeAllowed(edge, allowedEdges) {
  if (!Array.isArray(allowedEdges) || allowedEdges.length === 0) {
    return false;
  }

  return allowedEdges.some((allowed) => allowed.from === edge.from && allowed.to === edge.to);
}

export class PeerNegotiationChannel {
  constructor(policy = DEFAULT_NEGOTIATION_POLICY) {
    this.policy = {
      maxHops: policy.maxHops || DEFAULT_NEGOTIATION_POLICY.maxHops,
      allowedEdges: Array.isArray(policy.allowedEdges) ? policy.allowedEdges : []
    };
    this.transcript = [];
  }

  negotiate({ workflowId, fromAgent, toAgent, objective, hopCount = 1 }) {
    if (hopCount > this.policy.maxHops) {
      return {
        accepted: false,
        code: "MAX_HOPS_EXCEEDED",
        reason: `Negotiation exceeds maxHops=${this.policy.maxHops}.`
      };
    }

    const allowed = isEdgeAllowed({ from: fromAgent, to: toAgent }, this.policy.allowedEdges);
    if (!allowed) {
      return {
        accepted: false,
        code: "EDGE_RESTRICTED",
        reason: "Requested collaboration edge is not allowed by policy."
      };
    }

    const record = {
      workflowId,
      fromAgent,
      toAgent,
      objective,
      hopCount,
      accepted: true,
      timestampMs: Date.now()
    };

    this.transcript.push(record);

    return {
      accepted: true,
      code: "NEGOTIATION_ACCEPTED",
      record
    };
  }

  getTranscript() {
    return [...this.transcript];
  }
}
