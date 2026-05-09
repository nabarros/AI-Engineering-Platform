import { buildRetrievalPlan, detectTaskIntent } from "./retrieval-planner.js";

export { detectTaskIntent };

export function buildOrientedQuery(task, limit = 5) {
  const plan = buildRetrievalPlan(task, limit);
  return plan.query;
}

export function retrieveOrientedContext(memory, task, limit = 5) {
  if (!memory || typeof memory.queryIndexedMetadata !== "function") {
    return [];
  }

  const plan = buildRetrievalPlan(task, limit);
  return memory.queryIndexedMetadata({
    intent: plan.intent,
    query: plan.query,
    limit: plan.limit
  });
}
