const STEP_TYPE_DEFAULTS = Object.freeze({
  routing: "LOW",
  planning: "MEDIUM",
  execution: "MEDIUM",
  verification: "LOW",
  recovery: "HIGH",
  objective: "MEDIUM",
  default: "MEDIUM"
});

const CONFIDENCE_BANDS = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH"
});

const TIER_LEVELS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });

export const MODEL_TIER_POLICY_VERSION = "p4-tiering-policy-v1";

function normalizeStepType(value) {
  const stepType = String(value || "default").trim().toLowerCase();
  return Object.hasOwn(STEP_TYPE_DEFAULTS, stepType) ? stepType : "default";
}

function normalizeRisk(value) {
  const risk = String(value || "MEDIUM").trim().toUpperCase();
  if (risk === "LOW" || risk === "MEDIUM" || risk === "HIGH" || risk === "CRITICAL") {
    return risk;
  }
  return "MEDIUM";
}

export function resolveConfidenceBand(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return CONFIDENCE_BANDS.MEDIUM;
  }
  if (value < 0.6) return CONFIDENCE_BANDS.LOW;
  if (value < 0.85) return CONFIDENCE_BANDS.MEDIUM;
  return CONFIDENCE_BANDS.HIGH;
}

function maxTier(left, right) {
  const leftTier = String(left || "MEDIUM").toUpperCase();
  const rightTier = String(right || "MEDIUM").toUpperCase();
  return (TIER_LEVELS[leftTier] || TIER_LEVELS.MEDIUM) >= (TIER_LEVELS[rightTier] || TIER_LEVELS.MEDIUM)
    ? leftTier
    : rightTier;
}

function minTier(left, right) {
  const leftTier = String(left || "MEDIUM").toUpperCase();
  const rightTier = String(right || "MEDIUM").toUpperCase();
  return (TIER_LEVELS[leftTier] || TIER_LEVELS.MEDIUM) <= (TIER_LEVELS[rightTier] || TIER_LEVELS.MEDIUM)
    ? leftTier
    : rightTier;
}

export function resolveModelTierForStep(input = {}) {
  const stepType = normalizeStepType(input.stepType);
  const risk = normalizeRisk(input.risk);
  const confidenceBand = resolveConfidenceBand(input.confidenceScore);

  let tier = String(STEP_TYPE_DEFAULTS[stepType] || STEP_TYPE_DEFAULTS.default).toUpperCase();
  const reasons = [`step_default:${stepType}`];

  if (risk === "HIGH" || risk === "CRITICAL") {
    tier = maxTier(tier, "HIGH");
    reasons.push("risk_guardrail:high_or_critical");
  } else if (risk === "LOW") {
    tier = minTier(tier, "MEDIUM");
    reasons.push("risk_guardrail:low");
  }

  if (confidenceBand === CONFIDENCE_BANDS.LOW) {
    tier = maxTier(tier, "HIGH");
    reasons.push("confidence_guardrail:low");
  } else if (confidenceBand === CONFIDENCE_BANDS.HIGH && risk === "LOW") {
    tier = minTier(tier, "LOW");
    reasons.push("confidence_optimization:high_low_risk");
  }

  return {
    policyVersion: MODEL_TIER_POLICY_VERSION,
    stepType,
    risk,
    confidenceBand,
    tier,
    reasons
  };
}

export function buildTieringRoutingMatrix() {
  const risks = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const confidenceScores = [0.45, 0.72, 0.93];
  const stepTypes = Object.keys(STEP_TYPE_DEFAULTS).filter((stepType) => stepType !== "default");
  const rows = [];

  for (const stepType of stepTypes) {
    for (const risk of risks) {
      for (const confidenceScore of confidenceScores) {
        const resolved = resolveModelTierForStep({ stepType, risk, confidenceScore });
        rows.push({
          stepType,
          risk,
          confidenceBand: resolved.confidenceBand,
          tier: resolved.tier,
          policyVersion: resolved.policyVersion
        });
      }
    }
  }

  return {
    policyVersion: MODEL_TIER_POLICY_VERSION,
    generatedAt: Date.now(),
    rows
  };
}
