function toMap(items, keyField = "id") {
  const map = new Map();
  for (const item of items) {
    map.set(item[keyField], item);
  }
  return map;
}

function buildDependencies(nodes, edges) {
  const dependencies = new Map();
  const dependents = new Map();

  for (const node of nodes) {
    dependencies.set(node.id, new Set());
    dependents.set(node.id, new Set());
  }

  for (const edge of edges) {
    if (!dependencies.has(edge.to) || !dependencies.has(edge.from)) continue;
    dependencies.get(edge.to).add(edge.from);
    dependents.get(edge.from).add(edge.to);
  }

  return { dependencies, dependents };
}

async function executeWithRetry(handler, payload, maxAttempts, timeoutMs) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await Promise.race([
        handler(payload),
        new Promise((_, reject) => {
          const timeout = setTimeout(() => {
            clearTimeout(timeout);
            reject(new Error("Node execution timeout"));
          }, timeoutMs);
        })
      ]);
      return { ok: true, result, attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }

  return { ok: false, error: String(lastError?.message || lastError || "Unknown error"), attempts: maxAttempts };
}

export async function executeTaskGraph({ nodes, edges = [], handlers, maxConcurrency = 3 }) {
  const nodeMap = toMap(nodes);
  const { dependencies, dependents } = buildDependencies(nodes, edges);

  const ready = [];
  for (const node of nodes) {
    if (dependencies.get(node.id).size === 0) {
      ready.push(node.id);
    }
  }

  const results = {};
  const running = new Set();
  const completed = new Set();

  const runNode = async (nodeId) => {
    const node = nodeMap.get(nodeId);
    const handler = handlers[node.agentId];

    if (typeof handler !== "function") {
      results[nodeId] = { ok: false, error: `No handler for agentId ${node.agentId}` };
      completed.add(nodeId);
      return;
    }

    const execution = await executeWithRetry(
      handler,
      {
        node,
        previousResults: results
      },
      node.maxAttempts || 2,
      node.timeoutMs || 10_000
    );

    results[nodeId] = execution;
    completed.add(nodeId);

    for (const dependentId of dependents.get(nodeId)) {
      const missing = [...dependencies.get(dependentId)].filter((dependencyId) => !completed.has(dependencyId));
      if (missing.length === 0 && !ready.includes(dependentId) && !running.has(dependentId)) {
        ready.push(dependentId);
      }
    }
  };

  while (ready.length > 0 || running.size > 0) {
    while (ready.length > 0 && running.size < maxConcurrency) {
      const nodeId = ready.shift();
      running.add(nodeId);
      runNode(nodeId).finally(() => {
        running.delete(nodeId);
      });
    }

    if (running.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  const success = Object.values(results).every((entry) => entry.ok === true);
  return {
    ok: success,
    results,
    executedNodes: Object.keys(results).length,
    totalNodes: nodes.length
  };
}
