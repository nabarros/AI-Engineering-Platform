export const DEFAULT_CAPABILITY_REGISTRY = [
  {
    id: "AIEP Senior Staff Backend Engineer",
    domains: ["backend", "api", "data", "auth", "database", "service", "migration", "queue", "caching", "general"],
    maxRisk: "HIGH",
    tokenCostTier: "MEDIUM",
    latencyTier: "MEDIUM",
    qualityScore: 0.94,
    supportsVerificationGate: true,
    supportsMemoryWrites: true,
    metadata: {
      ownerTeam: "be",
      skillScopes: ["api", "data", "auth", "observability"]
    }
  },
  {
    id: "AIEP Senior Staff Frontend Engineer",
    domains: ["frontend", "ui", "accessibility", "component", "state-management", "routing", "performance", "general"],
    maxRisk: "HIGH",
    tokenCostTier: "MEDIUM",
    latencyTier: "MEDIUM",
    qualityScore: 0.93,
    supportsVerificationGate: true,
    supportsMemoryWrites: true,
    metadata: {
      ownerTeam: "fe",
      skillScopes: ["react", "state", "a11y", "performance"]
    }
  },
  {
    id: "AIEP Senior Staff UI/UX Engineer",
    domains: ["ux", "ui", "frontend", "accessibility", "design-system", "interaction", "responsive", "general"],
    maxRisk: "MEDIUM",
    tokenCostTier: "LOW",
    latencyTier: "LOW",
    qualityScore: 0.9,
    supportsVerificationGate: true,
    supportsMemoryWrites: false,
    metadata: {
      ownerTeam: "ux",
      skillScopes: ["journeys", "interaction", "a11y", "content"]
    }
  },
  {
    id: "AIEP Senior Staff SRE Engineer",
    domains: ["sre", "reliability", "observability", "performance", "monitoring", "alerting", "incident", "general"],
    maxRisk: "HIGH",
    tokenCostTier: "LOW",
    latencyTier: "LOW",
    qualityScore: 0.91,
    supportsVerificationGate: true,
    supportsMemoryWrites: false,
    metadata: {
      ownerTeam: "sre",
      skillScopes: ["reliability", "slo", "incident", "telemetry"]
    }
  },
  {
    id: "AIEP Implementation Guardian",
    domains: ["implementation", "security", "refactor", "code-quality", "patterns", "standards", "general"],
    maxRisk: "HIGH",
    tokenCostTier: "MEDIUM",
    latencyTier: "MEDIUM",
    qualityScore: 0.95,
    supportsVerificationGate: true,
    supportsMemoryWrites: true,
    metadata: {
      ownerTeam: "impl",
      skillScopes: ["delivery", "security", "tests", "compliance"]
    }
  },
  {
    id: "AIEP Context Planner",
    domains: ["planning", "general", "risk", "strategy", "decomposition", "coordination", "prioritization"],
    maxRisk: "HIGH",
    tokenCostTier: "LOW",
    latencyTier: "LOW",
    qualityScore: 0.92,
    supportsVerificationGate: false,
    supportsMemoryWrites: false,
    metadata: {
      ownerTeam: "plan",
      skillScopes: ["planning", "risk", "decomposition", "dependencies"]
    }
  },
  {
    id: "AIEP Code Reviewer",
    domains: ["review", "security", "testing", "code-quality", "best-practices", "vulnerability", "general"],
    maxRisk: "HIGH",
    tokenCostTier: "LOW",
    latencyTier: "LOW",
    qualityScore: 0.93,
    supportsVerificationGate: true,
    supportsMemoryWrites: false,
    metadata: {
      ownerTeam: "qa",
      skillScopes: ["review", "security", "tests", "regression"]
    }
  },
  {
    id: "AIEP Senior Staff AI/LLM Engineer",
    domains: ["ai", "llm", "ml", "inference", "embeddings", "rag", "general"],
    maxRisk: "HIGH",
    tokenCostTier: "HIGH",
    latencyTier: "MEDIUM",
    qualityScore: 0.94,
    supportsVerificationGate: true,
    supportsMemoryWrites: true,
    metadata: {
      ownerTeam: "ai",
      skillScopes: ["llm", "inference", "embeddings", "rag"]
    }
  },
  {
    id: "AIEP Senior Staff Architect",
    domains: ["architecture", "design", "api", "strategy", "general"],
    maxRisk: "HIGH",
    tokenCostTier: "LOW",
    latencyTier: "LOW",
    qualityScore: 0.96,
    supportsVerificationGate: true,
    supportsMemoryWrites: true,
    metadata: {
      ownerTeam: "arch",
      skillScopes: ["system-design", "adr", "api", "scalability"]
    }
  },
  {
    id: "AIEP Senior Staff DevOps Engineer",
    domains: ["devops", "infrastructure", "deployment", "cicd", "containers", "general"],
    maxRisk: "HIGH",
    tokenCostTier: "MEDIUM",
    latencyTier: "MEDIUM",
    qualityScore: 0.92,
    supportsVerificationGate: true,
    supportsMemoryWrites: true,
    metadata: {
      ownerTeam: "devops",
      skillScopes: ["cicd", "infrastructure", "deployment", "containers"]
    }
  }
];
