const TIER_LEVELS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });

export const DEFAULT_COST_QUALITY_GUARDRAILS = Object.freeze({
  minimumQualityScore: 0.85,
  minimumQualityScoreForDowngrade: 0.9,
  hardEscalationRiskLevels: ["HIGH", "CRITICAL"],
  highTokenThreshold: 2600
});

function normalizeTier(value) {
  const tier = String(value || "MEDIUM").toUpperCase();
  return Object.hasOwn(TIER_LEVELS, tier) ? tier : "MEDIUM";
}

function normalizeRisk(value) {
  const risk = String(value || "MEDIUM").toUpperCase();
  if (risk === "LOW" || risk === "MEDIUM" || risk === "HIGH" || risk === "CRITICAL") {
    return risk;
  }
  return "MEDIUM";
}

function minTier(left, right) {
  return (TIER_LEVELS[left] || TIER_LEVELS.MEDIUM) <= (TIER_LEVELS[right] || TIER_LEVELS.MEDIUM)
    ? left
    : right;
}

function maxTier(left, right) {
  return (TIER_LEVELS[left] || TIER_LEVELS.MEDIUM) >= (TIER_LEVELS[right] || TIER_LEVELS.MEDIUM)
    ? left
    : right;
}

export function optimizeCostQuality(input = {}) {
  const guardrails = {
    ...DEFAULT_COST_QUALITY_GUARDRAILS,
    ...(input.guardrails || {})
  };

  const risk = normalizeRisk(input.risk);
  const currentTier = normalizeTier(input.currentTier);
  const qualityScore = Number.isFinite(Number(input.qualityScore)) ? Number(input.qualityScore) : null;
  const verificationPass = input.verificationPass !== false;
  const predictedTokens = Math.max(0, Number(input.predictedTokens) || 0);
  const downgradeDecision = input.downgradeDecision || null;

  const reasons = [];
  let recommendedTier = currentTier;

  if (guardrails.hardEscalationRiskLevels.includes(risk)) {
    recommendedTier = maxTier(recommendedTier, "HIGH");
    reasons.push("risk_escalation");
  }

  if (!verificationPass) {
    recommendedTier = "HIGH";
    reasons.push("verification_failed");
  }

  if (qualityScore !== null && qualityScore < guardrails.minimumQualityScore) {
    recommendedTier = "HIGH";
    reasons.push("quality_guardrail_breach");
  }

  const downgradeAllowedByQuality = qualityScore !== null && qualityScore >= guardrails.minimumQualityScoreForDowngrade;
  const downgradeAllowedByRisk = risk === "LOW";
  const downgradeAllowedByTokens = predictedTokens >= guardrails.highTokenThreshold;

  if (
    downgradeDecision?.applied === true &&
    downgradeDecision.recommendedTier &&
    downgradeAllowedByQuality &&
    downgradeAllowedByRisk &&
    downgradeAllowedByTokens &&
    verificationPass
  ) {
    recommendedTier = minTier(recommendedTier, normalizeTier(downgradeDecision.recommendedTier));
    reasons.push("automated_downgrade");
  }

  return {
    recommendedTier,
    reasons: reasons.length ? reasons : ["no_change"],
    escalationTriggered: recommendedTier === "HIGH" && currentTier !== "HIGH",
    downgradeApplied: recommendedTier !== currentTier && (TIER_LEVELS[recommendedTier] < TIER_LEVELS[currentTier]),
    guardrails: {
      minimumQualityScore: guardrails.minimumQualityScore,
      minimumQualityScoreForDowngrade: guardrails.minimumQualityScoreForDowngrade,
      highTokenThreshold: guardrails.highTokenThreshold
    }
  };
}
