import {
  DEFAULT_CAPABILITY_REGISTRY,
  generateScenarioCorpus,
  evaluateWeights
} from "../src/orchestration/index.js";

const weightCandidates = [
  { name: "balanced", domain: 0.35, quality: 0.25, learning: 0.2, cost: 0.12, latency: 0.08 },
  { name: "cost-aware", domain: 0.3, quality: 0.22, learning: 0.18, cost: 0.2, latency: 0.1 },
  { name: "quality-first", domain: 0.34, quality: 0.34, learning: 0.18, cost: 0.08, latency: 0.06 },
  { name: "latency-cost", domain: 0.28, quality: 0.2, learning: 0.16, cost: 0.2, latency: 0.16 }
];

function main() {
  const scenarios = generateScenarioCorpus();
  const results = weightCandidates
    .map((weights) => evaluateWeights({ scenarios, registry: DEFAULT_CAPABILITY_REGISTRY, weights }))
    .sort((a, b) => b.utility - a.utility);
  const best = results[0];

  console.log(`Orchestration benchmark results (${scenarios.length} scenarios):`);
  for (const row of results) {
    console.log(
      `- ${row.weights.name}: accuracy=${row.accuracy}, avgTokens=${row.avgTokens}, utility=${row.utility}`
    );
  }

  console.log("\nTop 2 scoring profiles:");
  console.log(JSON.stringify(results.slice(0, 2).map((entry) => entry.weights), null, 2));

  console.log("\nRecommended scoring profile:");
  console.log(JSON.stringify(best.weights, null, 2));
}

main();
