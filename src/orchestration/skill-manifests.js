const TASK_KEYWORD_SKILL_MAP = Object.freeze([
  { keyword: "bugfix", skills: ["debugging", "testing"] },
  { keyword: "bug", skills: ["debugging", "testing"] },
  { keyword: "fix", skills: ["debugging", "testing"] },
  { keyword: "feature", skills: ["feature-development", "testing"] },
  { keyword: "implement", skills: ["feature-development", "testing"] },
  { keyword: "review", skills: ["review", "testing"] },
  { keyword: "security", skills: ["security", "testing"] },
  { keyword: "secure", skills: ["security", "testing"] },
  { keyword: "ui", skills: ["ui", "feature-development"] },
  { keyword: "frontend", skills: ["frontend", "ui"] },
  { keyword: "backend", skills: ["backend", "feature-development"] },
  { keyword: "performance", skills: ["performance", "testing"] }
]);

export const MINIMUM_SKILL_MANIFESTS = Object.freeze({
  "AIEP Senior Staff Backend Engineer": ["backend", "api", "data", "auth", "security", "review", "testing", "feature-development", "debugging", "performance"],
  "AIEP Senior Staff Frontend Engineer": ["frontend", "ui", "accessibility", "review", "testing", "feature-development", "debugging", "performance"],
  "AIEP Senior Staff UI/UX Engineer": ["ui", "frontend", "accessibility", "review", "feature-development"],
  "AIEP Senior Staff SRE Engineer": ["backend", "security", "review", "testing", "performance", "debugging"],
  "AIEP Implementation Guardian": ["backend", "frontend", "security", "review", "testing", "feature-development", "debugging", "performance"],
  "AIEP Context Planner": ["review", "feature-development", "performance"],
  "AIEP Code Reviewer": ["review", "security", "testing", "debugging", "performance"]
});

export function resolveAllowedSkillsForAgent(agentId) {
  const manifest = MINIMUM_SKILL_MANIFESTS[agentId];
  return Array.isArray(manifest) ? [...manifest] : [];
}

export function inferRequiredSkillsFromTask(task, { risk, targetAgent } = {}) {
  const required = new Set(["testing"]);
  const normalizedRisk = String(risk || task?.risk || "MEDIUM").toUpperCase();
  const domain = String(task?.domain || "").toLowerCase();
  const text = [task?.domain, task?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const rule of TASK_KEYWORD_SKILL_MAP) {
    if (text.includes(rule.keyword)) {
      for (const skill of rule.skills) {
        required.add(skill);
      }
    }
  }

  if (required.size === 1) {
    required.add("feature-development");
  }

  if (normalizedRisk === "HIGH" || normalizedRisk === "CRITICAL") {
    required.add("security");
    required.add("review");
  }

  if (domain) {
    const targetManifest = resolveAllowedSkillsForAgent(targetAgent);
    if (targetManifest.includes(domain)) {
      required.add(domain);
    }
  }

  return [...required].sort();
}

export function enforceSkillSubsetPolicy({ agentId, task, exceptionRegistry = null, nowMs } = {}) {
  const allowedSkills = resolveAllowedSkillsForAgent(agentId);
  const requiredSkills = inferRequiredSkillsFromTask(task, {
    risk: task?.risk,
    targetAgent: agentId
  });
  const allowedSkillSet = new Set(allowedSkills);
  const exceptionAllowedSkills = [];
  const deniedSkills = [];

  for (const skill of requiredSkills) {
    if (allowedSkillSet.has(skill)) {
      continue;
    }

    const allowedByException = Boolean(
      exceptionRegistry && exceptionRegistry.isSkillAllowedByException(agentId, skill, nowMs)
    );

    if (allowedByException) {
      exceptionAllowedSkills.push(skill);
      continue;
    }

    deniedSkills.push(skill);
  }

  return {
    allowed: deniedSkills.length === 0,
    requiredSkills,
    allowedSkills,
    deniedSkills,
    exceptionAllowedSkills
  };
}
