const RISK_LEVELS = Object.freeze(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const DEFAULT_EXCEPTION_POLICY = Object.freeze({
  expiresAtRequired: true,
  maxTtlMs: 7 * 24 * 60 * 60 * 1000
});

function normalizeRisk(risk) {
  const normalized = String(risk || "MEDIUM").toUpperCase();
  return RISK_LEVELS.includes(normalized) ? normalized : "MEDIUM";
}

function normalizeDomain(domain) {
  const normalized = String(domain || "general").trim().toLowerCase();
  return normalized || "general";
}

function uniqueSkills(skills) {
  const deduped = new Set();
  for (const skill of skills) {
    const normalized = String(skill || "").trim().toLowerCase();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return [...deduped].sort();
}

function buildRiskRows({ agentId, role, domain, allow, deny = [], highRiskAllow = ["security", "review"] }) {
  const baseAllow = uniqueSkills([...allow, "testing"]);
  const baseDeny = uniqueSkills(deny);
  const highAllow = uniqueSkills([...baseAllow, ...highRiskAllow]);

  return RISK_LEVELS.map((risk) => {
    const isHighRisk = risk === "HIGH" || risk === "CRITICAL";
    return Object.freeze({
      agentId,
      role,
      domain,
      risk,
      allow: isHighRisk ? highAllow : baseAllow,
      deny: baseDeny,
      exception: DEFAULT_EXCEPTION_POLICY
    });
  });
}

const COMPILED_ROWS = [
  ...buildRiskRows({
    agentId: "AIEP Senior Staff Backend Engineer",
    role: "backend",
    domain: "backend",
    allow: ["backend", "api", "data", "auth", "feature-development", "debugging", "performance", "security", "review"],
    deny: ["ui", "frontend", "accessibility"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff Backend Engineer",
    role: "backend",
    domain: "general",
    allow: ["feature-development", "review", "debugging", "performance"],
    deny: ["ui", "frontend", "accessibility"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff Frontend Engineer",
    role: "frontend",
    domain: "frontend",
    allow: ["frontend", "ui", "accessibility", "feature-development", "debugging", "performance"],
    deny: ["backend", "auth", "data"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff Frontend Engineer",
    role: "frontend",
    domain: "general",
    allow: ["feature-development", "review", "debugging", "performance"],
    deny: ["backend", "auth", "data"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff UI/UX Engineer",
    role: "ui-ux",
    domain: "ux",
    allow: ["ux", "ui", "frontend", "accessibility", "feature-development", "review"],
    deny: ["backend", "data", "auth"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff UI/UX Engineer",
    role: "ui-ux",
    domain: "ui",
    allow: ["ux", "ui", "frontend", "accessibility", "feature-development", "review"],
    deny: ["backend", "data", "auth"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff UI/UX Engineer",
    role: "ui-ux",
    domain: "general",
    allow: ["ux", "ui", "frontend", "accessibility", "feature-development", "review"],
    deny: ["backend", "data", "auth"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff SRE Engineer",
    role: "sre",
    domain: "sre",
    allow: ["sre", "backend", "performance", "debugging", "security", "review", "observability", "incident", "monitoring"],
    deny: ["ui", "frontend", "accessibility"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff SRE Engineer",
    role: "sre",
    domain: "general",
    allow: ["sre", "performance", "debugging", "review", "security", "observability"],
    deny: ["ui", "frontend", "accessibility"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Implementation Guardian",
    role: "implementation-guardian",
    domain: "implementation",
    allow: ["implementation", "backend", "frontend", "feature-development", "debugging", "review", "security", "performance", "refactor", "patterns"],
    deny: []
  }),
  ...buildRiskRows({
    agentId: "AIEP Implementation Guardian",
    role: "implementation-guardian",
    domain: "general",
    allow: ["implementation", "backend", "frontend", "feature-development", "debugging", "review", "security", "performance"],
    deny: []
  }),
  ...buildRiskRows({
    agentId: "AIEP Context Planner",
    role: "planner",
    domain: "planning",
    allow: ["planning", "review", "feature-development", "performance", "decomposition", "strategy"],
    deny: ["auth", "data", "security"],
    highRiskAllow: ["review"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Context Planner",
    role: "planner",
    domain: "general",
    allow: ["planning", "review", "feature-development", "performance"],
    deny: ["auth", "data", "security"],
    highRiskAllow: ["review"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Code Reviewer",
    role: "reviewer",
    domain: "review",
    allow: ["review", "testing", "debugging", "security", "performance"],
    deny: ["feature-development"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Code Reviewer",
    role: "reviewer",
    domain: "general",
    allow: ["review", "testing", "debugging", "security", "performance"],
    deny: ["feature-development"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff Architect",
    role: "architect",
    domain: "architecture",
    allow: ["architecture", "design", "system-design", "api", "backend", "frontend", "devops", "ai", "llm", "feature-development", "debugging", "performance"],
    deny: ["accessibility", "ui"],
    highRiskAllow: ["auth", "data", "security", "review"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff Architect",
    role: "architect",
    domain: "general",
    allow: ["api", "architecture", "backend", "design", "system-design", "feature-development", "performance", "security", "review", "ai", "llm", "devops", "deployment", "frontend"],
    deny: ["accessibility"],
    highRiskAllow: ["auth", "data", "security", "review"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff AI/LLM Engineer",
    role: "ai-llm",
    domain: "ai",
    allow: ["llm", "rag", "embeddings", "inference", "api", "feature-development", "debugging", "performance", "ai"],
    deny: ["accessibility", "frontend", "ui"],
    highRiskAllow: ["security", "review"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff AI/LLM Engineer",
    role: "ai-llm",
    domain: "general",
    allow: ["llm", "rag", "embeddings", "inference", "feature-development", "debugging", "performance"],
    deny: ["accessibility", "frontend", "ui"],
    highRiskAllow: ["security", "review"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff DevOps Engineer",
    role: "devops",
    domain: "devops",
    allow: ["cicd", "containers", "deployment", "infrastructure", "feature-development", "debugging", "performance", "devops"],
    deny: ["accessibility", "frontend", "ui"],
    highRiskAllow: ["security", "review"]
  }),
  ...buildRiskRows({
    agentId: "AIEP Senior Staff DevOps Engineer",
    role: "devops",
    domain: "general",
    allow: ["cicd", "deployment", "infrastructure", "feature-development", "debugging", "performance"],
    deny: ["accessibility", "frontend", "ui"],
    highRiskAllow: ["security", "review"]
  })
];

export const SKILL_POLICY_MATRIX_VERSION = "1.0.0";
export const COMPILED_SKILL_POLICY_ROWS = Object.freeze(COMPILED_ROWS);

function clonePolicy(policy) {
  if (!policy) {
    return null;
  }

  return {
    agentId: policy.agentId,
    role: policy.role,
    domain: policy.domain,
    risk: policy.risk,
    allow: [...policy.allow],
    deny: [...policy.deny],
    exception: {
      expiresAtRequired: Boolean(policy.exception?.expiresAtRequired),
      maxTtlMs: Number(policy.exception?.maxTtlMs || 0)
    }
  };
}

export function listCompiledSkillPoliciesForAgent(agentId) {
  const normalizedAgentId = String(agentId || "").trim();
  return COMPILED_SKILL_POLICY_ROWS
    .filter((row) => row.agentId === normalizedAgentId)
    .map((row) => clonePolicy(row));
}

export function resolveCompiledSkillPolicy({ agentId, domain, risk } = {}) {
  const normalizedAgentId = String(agentId || "").trim();
  if (!normalizedAgentId) {
    return null;
  }

  const normalizedDomain = normalizeDomain(domain);
  const normalizedRisk = normalizeRisk(risk);

  const candidates = [
    { domain: normalizedDomain, risk: normalizedRisk },
    { domain: "general", risk: normalizedRisk },
    { domain: normalizedDomain, risk: "MEDIUM" },
    { domain: "general", risk: "MEDIUM" }
  ];

  for (const candidate of candidates) {
    const found = COMPILED_SKILL_POLICY_ROWS.find((row) => {
      return row.agentId === normalizedAgentId && row.domain === candidate.domain && row.risk === candidate.risk;
    });

    if (found) {
      return clonePolicy(found);
    }
  }

  return null;
}
