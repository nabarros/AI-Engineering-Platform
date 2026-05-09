const TIER_LEVELS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });

function normalizeRisk(value) {
  const risk = String(value || "MEDIUM").toUpperCase();
  if (risk === "LOW" || risk === "MEDIUM" || risk === "HIGH" || risk === "CRITICAL") {
    return risk;
  }
  return "MEDIUM";
}

function normalizeTier(value) {
  const tier = String(value || "MEDIUM").toUpperCase();
  return Object.hasOwn(TIER_LEVELS, tier) ? tier : "MEDIUM";
}

function downgradeTier(tier) {
  if (tier === "HIGH") return "MEDIUM";
  if (tier === "MEDIUM") return "LOW";
  return "LOW";
}

export function createDowngradePolicy(options = {}) {
  let rollbackSwitch = options.rollbackSwitch === true;
  const enabled = options.enabled !== false;
  const highVolumeThreshold = Math.max(5, Number(options.highVolumeThreshold) || 40);

  return {
    evaluate(input = {}) {
      const risk = normalizeRisk(input.risk);
      const currentTier = normalizeTier(input.currentTier);
      const recentVolume = Math.max(0, Number(input.recentVolume) || 0);
      const taskClass = String(input.taskClass || "unspecified");

      if (!enabled) {
        return {
          taskClass,
          applied: false,
          recommendedTier: currentTier,
          reason: "policy_disabled",
          rollbackActive: rollbackSwitch
        };
      }

      if (rollbackSwitch) {
        return {
          taskClass,
          applied: false,
          recommendedTier: currentTier,
          reason: "rollback_switch_enabled",
          rollbackActive: true
        };
      }

      if (risk !== "LOW") {
        return {
          taskClass,
          applied: false,
          recommendedTier: currentTier,
          reason: "risk_not_low",
          rollbackActive: false
        };
      }

      if (recentVolume < highVolumeThreshold) {
        return {
          taskClass,
          applied: false,
          recommendedTier: currentTier,
          reason: "volume_below_threshold",
          rollbackActive: false
        };
      }

      const targetTier = downgradeTier(currentTier);
      return {
        taskClass,
        applied: targetTier !== currentTier,
        recommendedTier: targetTier,
        reason: targetTier === currentTier ? "already_low_tier" : "low_risk_high_volume",
        rollbackActive: false
      };
    },

    setRollbackSwitch(isEnabled) {
      rollbackSwitch = isEnabled === true;
      return rollbackSwitch;
    },

    status() {
      return {
        enabled,
        rollbackSwitch,
        highVolumeThreshold
      };
    }
  };
}
