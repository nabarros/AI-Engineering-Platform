const BUGFIX_KEYWORDS = ["bug", "bugfix", "fix", "regression", "defect", "failure"];
const FEATURE_KEYWORDS = ["feature", "implement", "add", "build", "enhance"];
const REVIEW_KEYWORDS = ["review", "audit", "assess", "check", "inspect"];

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function detectTaskIntent(task) {
  const text = [task?.domain, task?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (includesAny(text, BUGFIX_KEYWORDS)) {
    return "bugfix";
  }
  if (includesAny(text, FEATURE_KEYWORDS)) {
    return "feature";
  }
  if (includesAny(text, REVIEW_KEYWORDS)) {
    return "review";
  }
  return "general";
}

export function buildOrientedQuery(task) {
  const intent = detectTaskIntent(task);
  const domain = String(task?.domain || "general").toLowerCase();
  const description = String(task?.description || "").toLowerCase().trim();
  return `${intent} ${domain} ${description}`.trim();
}

export function retrieveOrientedContext(memory, task, limit = 5) {
  if (!memory || typeof memory.queryIndexedMetadata !== "function") {
    return [];
  }

  const intent = detectTaskIntent(task);
  const query = buildOrientedQuery(task);
  return memory.queryIndexedMetadata({ intent, query, limit });
}
