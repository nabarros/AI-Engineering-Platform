const BUGFIX_KEYWORDS = ["bug", "bugfix", "fix", "regression", "defect", "failure"];
const FEATURE_KEYWORDS = ["feature", "implement", "add", "build", "enhance"];
const REVIEW_KEYWORDS = ["review", "audit", "assess", "check", "inspect"];
const DOCS_KEYWORDS = ["docs", "documentation", "readme", "runbook", "guide", "roadmap"];

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeTaskText(task) {
  return [task?.domain, task?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function detectTaskIntent(task) {
  const text = normalizeTaskText(task);

  if (includesAny(text, BUGFIX_KEYWORDS)) {
    return "bugfix";
  }
  if (includesAny(text, FEATURE_KEYWORDS)) {
    return "feature";
  }
  if (includesAny(text, REVIEW_KEYWORDS)) {
    return "review";
  }
  if (includesAny(text, DOCS_KEYWORDS)) {
    return "docs";
  }
  return "general";
}

function buildIntentBoostTerms(intent) {
  switch (intent) {
    case "bugfix":
      return ["incident", "failure", "regression", "root-cause", "patch"];
    case "feature":
      return ["implementation", "interface", "acceptance", "capability"];
    case "review":
      return ["audit", "risk", "verification", "coverage"];
    case "docs":
      return ["documentation", "runbook", "evidence", "checklist"];
    default:
      return ["context", "history"];
  }
}

export function buildRetrievalPlan(task, limit = 5) {
  const intent = detectTaskIntent(task);
  const domain = String(task?.domain || "general").toLowerCase();
  const description = String(task?.description || "").toLowerCase().trim();
  const intentTerms = buildIntentBoostTerms(intent);
  const query = [intent, domain, ...intentTerms, description].filter(Boolean).join(" ").trim();

  return {
    intent,
    query,
    strategy: `intent:${intent}`,
    limit: Math.max(1, Number(limit) || 5),
    intentTerms
  };
}
