import { routeTask } from "./router.js";

const COST_BY_TIER = Object.freeze({ LOW: 1200, MEDIUM: 3000, HIGH: 6500 });
const DOMAINS = [
  "backend", "frontend", "ux", "sre", "review", "planning", "security",
  "refactor", "api", "ai", "llm", "architecture", "design", "devops",
  "infrastructure", "deployment", "database", "ml", "inference",
  "embeddings", "rag", "cicd", "containers", "service", "migration", "strategy"
];
const RISKS = ["LOW", "MEDIUM", "HIGH"];
const TOKEN_BUDGETS = ["LOW", "MEDIUM", "HIGH"];
const LATENCY_BUDGETS = ["LOW", "MEDIUM", "HIGH"];

const EXPECTED_BY_DOMAIN = Object.freeze({
  backend: "AIEP Senior Staff Backend Engineer",
  frontend: "AIEP Senior Staff Frontend Engineer",
  ux: "AIEP Senior Staff UI/UX Engineer",
  sre: "AIEP Senior Staff SRE Engineer",
  review: "AIEP Code Reviewer",
  planning: "AIEP Context Planner",
  security: "AIEP Implementation Guardian",
  refactor: "AIEP Implementation Guardian",
  api: "AIEP Senior Staff Backend Engineer",
  ai: "AIEP Senior Staff AI/LLM Engineer",
  llm: "AIEP Senior Staff AI/LLM Engineer",
  ml: "AIEP Senior Staff AI/LLM Engineer",
  inference: "AIEP Senior Staff AI/LLM Engineer",
  embeddings: "AIEP Senior Staff AI/LLM Engineer",
  rag: "AIEP Senior Staff AI/LLM Engineer",
  architecture: "AIEP Senior Staff Architect",
  design: "AIEP Senior Staff Architect",
  strategy: "AIEP Senior Staff Architect",
  devops: "AIEP Senior Staff DevOps Engineer",
  infrastructure: "AIEP Senior Staff DevOps Engineer",
  deployment: "AIEP Senior Staff DevOps Engineer",
  cicd: "AIEP Senior Staff DevOps Engineer",
  containers: "AIEP Senior Staff DevOps Engineer",
  database: "AIEP Senior Staff Backend Engineer",
  service: "AIEP Senior Staff Backend Engineer",
  migration: "AIEP Senior Staff Backend Engineer"
});

export function generateScenarioCorpus() {
  const scenarios = [];
  let id = 1;

  for (const domain of DOMAINS) {
    for (const risk of RISKS) {
      for (const tokenBudgetTier of TOKEN_BUDGETS) {
        for (const latencyBudgetTier of LATENCY_BUDGETS) {
          scenarios.push({
            id: `scenario-${id}`,
            task: {
              domain,
              risk,
              description: `${domain} task under ${risk} risk with ${tokenBudgetTier} token budget and ${latencyBudgetTier} latency budget`
            },
            budget: { tokenBudgetTier, latencyBudgetTier },
            expected: EXPECTED_BY_DOMAIN[domain]
          });
          id += 1;
        }
      }
    }
  }

  return scenarios;
}

export function tokenCostForAgent(registry, agentId) {
  const match = registry.find((candidate) => candidate.id === agentId);
  if (!match) return COST_BY_TIER.MEDIUM;
  return COST_BY_TIER[match.tokenCostTier] || COST_BY_TIER.MEDIUM;
}

export function evaluateWeights({ scenarios, registry, weights }) {
  let correct = 0;
  let totalTokens = 0;

  for (const scenario of scenarios) {
    const result = routeTask({
      task: scenario.task,
      registry,
      budget: scenario.budget,
      scoringWeights: weights
    });

    if (result.selected?.id === scenario.expected) {
      correct += 1;
    }

    totalTokens += tokenCostForAgent(registry, result.selected?.id);
  }

  const accuracy = correct / scenarios.length;
  const avgTokens = totalTokens / scenarios.length;
  const utility = accuracy * 100 - avgTokens / 120;

  return {
    weights,
    totalScenarios: scenarios.length,
    accuracy: Number(accuracy.toFixed(4)),
    avgTokens: Number(avgTokens.toFixed(2)),
    utility: Number(utility.toFixed(2))
  };
}

export function buildMultiStepReliabilityBenchmark(executions) {
  const runs = Array.isArray(executions) ? executions : [];
  const total = runs.length;
  const completed = runs.filter((run) => run?.completed === true).length;
  const recovered = runs.filter((run) => run?.recovered === true).length;
  const verificationFailures = runs.filter((run) => run?.verificationPass === false).length;

  return {
    totalRuns: total,
    completionRate: total > 0 ? Number((completed / total).toFixed(4)) : 0,
    recoveryRate: total > 0 ? Number((recovered / total).toFixed(4)) : 0,
    verificationFailureRate: total > 0 ? Number((verificationFailures / total).toFixed(4)) : 0
  };
}
