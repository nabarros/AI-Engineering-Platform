function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createTenantPolicyPacks() {
  return {
    regulated: {
      name: "regulated",
      controls: {
        piiMaskingRequired: true,
        residencyEnforced: true,
        approvalForWriteConnectors: true,
        strictAuditRetentionDays: 365
      }
    },
    standard: {
      name: "standard",
      controls: {
        piiMaskingRequired: true,
        residencyEnforced: true,
        approvalForWriteConnectors: true,
        strictAuditRetentionDays: 180
      }
    },
    innovation: {
      name: "innovation",
      controls: {
        piiMaskingRequired: true,
        residencyEnforced: false,
        approvalForWriteConnectors: true,
        strictAuditRetentionDays: 90
      }
    }
  };
}

export function buildComplianceEvidenceArtifact({ tenantId, controls = [], generatedAtMs = Date.now() } = {}) {
  const normalizedControls = Array.isArray(controls) ? controls : [];
  return {
    tenantId: String(tenantId || "unknown"),
    generatedAtMs,
    frameworkMappings: {
      SOC2: normalizedControls.map((control) => ({ control, mapped: true })),
      ISO27001: normalizedControls.map((control) => ({ control, mapped: true }))
    },
    signed: true
  };
}

export function enforceDataResidency({ tenantRegion, requestedRegion, allowedRegions = [] } = {}) {
  const normalizedAllowed = new Set(Array.isArray(allowedRegions) ? allowedRegions : []);
  const regionAllowed = normalizedAllowed.size === 0 || normalizedAllowed.has(requestedRegion);
  const sameRegion = tenantRegion === requestedRegion;

  if (!sameRegion || !regionAllowed) {
    return {
      allowed: false,
      code: "RESIDENCY_VIOLATION",
      reason: "Requested region violates tenant residency constraints."
    };
  }

  return {
    allowed: true,
    code: "RESIDENCY_ALLOWED"
  };
}

export function buildSlaSloControlPanel(input = {}) {
  const windows = Array.isArray(input.windows) ? input.windows : [];
  const targets = input.targets || { availability: 0.995, latencyP95Ms: 1200 };
  const latest = windows.at(-1) || { availability: 1, latencyP95Ms: 0, errorRate: 0 };

  return {
    tenantId: String(input.tenantId || "unknown"),
    targets,
    latest,
    adherence: {
      availabilityOk: latest.availability >= targets.availability,
      latencyOk: latest.latencyP95Ms <= targets.latencyP95Ms
    }
  };
}

export function createPlanAndQuotaEngine({ plans = {} } = {}) {
  const usageByTenant = new Map();

  function consume({ tenantId, planId, amount }) {
    const plan = plans[planId];
    if (!plan) {
      return { allowed: false, code: "UNKNOWN_PLAN" };
    }

    const key = `${tenantId}:${planId}`;
    const used = usageByTenant.get(key) || 0;
    const next = used + Math.max(0, Number(amount) || 0);

    if (next > plan.monthlyQuota) {
      return {
        allowed: false,
        code: "QUOTA_EXCEEDED",
        remaining: Math.max(0, plan.monthlyQuota - used)
      };
    }

    usageByTenant.set(key, next);
    return {
      allowed: true,
      code: "WITHIN_QUOTA",
      remaining: Math.max(0, plan.monthlyQuota - next)
    };
  }

  function snapshot() {
    const rows = [];
    for (const [key, used] of usageByTenant.entries()) {
      const [tenantId, planId] = key.split(":");
      rows.push({ tenantId, planId, used });
    }
    return rows;
  }

  return {
    consume,
    snapshot
  };
}

export function buildSupportabilityBundle(input = {}) {
  return clone({
    requestId: input.requestId || "unknown",
    trace: input.trace || {},
    policyDecision: input.policyDecision || {},
    tokenCost: input.tokenCost || {},
    verification: input.verification || {},
    generatedAtMs: typeof input.generatedAtMs === "number" ? input.generatedAtMs : Date.now()
  });
}
