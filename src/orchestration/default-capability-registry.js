export const DEFAULT_CAPABILITY_REGISTRY = [
  {
    id: "AIEP Senior Staff Backend Engineer",
    domains: ["backend", "api", "data", "auth", "general"],
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
    domains: ["frontend", "ui", "accessibility", "general"],
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
    domains: ["ux", "ui", "frontend", "accessibility", "general"],
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
    domains: ["sre", "reliability", "observability", "performance", "general"],
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
    domains: ["implementation", "security", "refactor", "general"],
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
    domains: ["planning", "general", "risk", "strategy"],
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
    domains: ["review", "security", "testing", "general"],
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
  }
];
