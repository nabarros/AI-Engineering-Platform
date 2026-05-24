function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

export function buildCollaborationHandoffGraph(events = []) {
  const handoffs = events.filter((event) => event?.type === "handoff");

  const nodes = uniqueBy(
    handoffs.flatMap((handoff) => [handoff.fromAgent, handoff.toAgent]).map((agentId) => ({ id: agentId, label: agentId })),
    (node) => node.id
  );

  const edges = handoffs.map((handoff, index) => ({
    id: `edge-${index + 1}`,
    from: handoff.fromAgent,
    to: handoff.toAgent,
    workflowId: handoff.workflowId,
    taskId: handoff.taskId || null,
    timestampMs: handoff.timestampMs || null
  }));

  const mermaid = [
    "graph LR",
    ...edges.map((edge) => `  ${edge.from} --> ${edge.to}`)
  ].join("\n");

  return {
    nodes,
    edges,
    mermaid
  };
}
