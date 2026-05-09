const KEYWORD_TO_SPECIALIST_RULES = Object.freeze([
  {
    specialistId: "AIEP Senior Staff Backend Engineer",
    keywords: ["backend", "api", "database", "sql", "fastify", "node", "service", "integration"]
  },
  {
    specialistId: "AIEP Senior Staff Frontend Engineer",
    keywords: ["frontend", "react", "ui", "component", "hook", "state", "css", "tailwind"]
  },
  {
    specialistId: "AIEP Senior Staff UI/UX Engineer",
    keywords: ["ux", "journey", "interaction", "wireframe", "usability", "accessibility"]
  },
  {
    specialistId: "AIEP Senior Staff SRE Engineer",
    keywords: ["sre", "reliability", "incident", "observability", "monitoring", "kubernetes", "latency"]
  },
  {
    specialistId: "AIEP Code Reviewer",
    keywords: ["review", "verification", "audit", "regression", "qa"]
  },
  {
    specialistId: "AIEP Context Planner",
    keywords: ["plan", "planning", "strategy", "roadmap", "decompose"]
  },
  {
    specialistId: "AIEP Implementation Guardian",
    keywords: ["security", "compliance", "refactor", "hardening", "safety"]
  }
]);

const DOMAIN_DEFAULT_SPECIALIST = Object.freeze({
  backend: "AIEP Senior Staff Backend Engineer",
  api: "AIEP Senior Staff Backend Engineer",
  data: "AIEP Senior Staff Backend Engineer",
  auth: "AIEP Senior Staff Backend Engineer",
  frontend: "AIEP Senior Staff Frontend Engineer",
  ui: "AIEP Senior Staff Frontend Engineer",
  ux: "AIEP Senior Staff UI/UX Engineer",
  accessibility: "AIEP Senior Staff UI/UX Engineer",
  sre: "AIEP Senior Staff SRE Engineer",
  reliability: "AIEP Senior Staff SRE Engineer",
  observability: "AIEP Senior Staff SRE Engineer",
  review: "AIEP Code Reviewer",
  planning: "AIEP Context Planner",
  strategy: "AIEP Context Planner",
  security: "AIEP Implementation Guardian",
  refactor: "AIEP Implementation Guardian"
});

function normalizeTaskText(task) {
  return [task?.domain, task?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getShadowSampleTimestamp(sample) {
  const candidates = [sample?.recordedAt, sample?.timestamp, sample?.observedAt, sample?.createdAt];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function countShadowAgentCoverage(samples) {
  const counts = new Map();

  for (const sample of samples) {
    for (const specialistId of [sample?.selectedSpecialist, sample?.inferredSpecialist]) {
      if (!specialistId) {
        continue;
      }

      const key = String(specialistId);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([specialistId, appearances]) => ({ specialistId, appearances }))
    .sort((left, right) => {
      if (right.appearances !== left.appearances) {
        return right.appearances - left.appearances;
      }
      return left.specialistId.localeCompare(right.specialistId);
    });
}

export function inferRelationshipCandidate(task) {
  const domain = String(task?.domain || "general").toLowerCase();
  const text = normalizeTaskText(task);
  const scoreBySpecialist = new Map();

  for (const rule of KEYWORD_TO_SPECIALIST_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      scoreBySpecialist.set(rule.specialistId, (scoreBySpecialist.get(rule.specialistId) || 0) + score);
    }
  }

  const entries = [...scoreBySpecialist.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });

  if (entries.length > 0) {
    return entries[0][0];
  }

  return DOMAIN_DEFAULT_SPECIALIST[domain] || "AIEP Implementation Guardian";
}

export function evaluateRelationshipShadow({ task, selectedSpecialist }) {
  const inferredSpecialist = inferRelationshipCandidate(task);
  const selected = selectedSpecialist || null;
  const matches = inferredSpecialist === selected;

  let mismatchType = "none";
  if (!selected) {
    mismatchType = "selection_missing";
  } else if (!inferredSpecialist) {
    mismatchType = "inference_missing";
  } else if (!matches) {
    mismatchType = "specialist_mismatch";
  }

  return {
    inferredSpecialist,
    selectedSpecialist: selected,
    matches,
    mismatchType
  };
}

export function createRelationshipShadowTracker({ maxSamples = 500 } = {}) {
  const safeMaxSamples = Math.max(1, Number(maxSamples) || 500);
  const samples = [];

  return {
    record(sample) {
      if (!sample || typeof sample !== "object") {
        return;
      }

      samples.push(sample);
      if (samples.length > safeMaxSamples) {
        samples.shift();
      }
    },

    summary() {
      const totalSamples = samples.length;
      const byMismatchType = {};
      let mismatches = 0;

      for (const sample of samples) {
        if (sample.matches === false) {
          mismatches += 1;
          const type = String(sample.mismatchType || "unknown");
          byMismatchType[type] = (byMismatchType[type] || 0) + 1;
        }
      }

      return {
        totalSamples,
        mismatches,
        mismatchRate: totalSamples > 0 ? Number((mismatches / totalSamples).toFixed(4)) : 0,
        byMismatchType
      };
    }
  };
}

export function buildRelationshipShadowReport(samples = [], options = {}) {
  const safeSamples = Array.isArray(samples) ? samples : [];
  const generatedAt = typeof options.generatedAt === "number" ? options.generatedAt : Date.now();
  const windowDays = Math.max(1, Number(options.windowDays) || 14);
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const windowStart = generatedAt - windowMs;

  const retainedSamples = safeSamples.filter((sample) => {
    const sampleTimestamp = getShadowSampleTimestamp(sample);
    return sampleTimestamp === null || sampleTimestamp >= windowStart;
  });

  const summaryTracker = createRelationshipShadowTracker({ maxSamples: Math.max(1, retainedSamples.length || 1) });
  for (const sample of retainedSamples) {
    summaryTracker.record(sample);
  }

  const summary = summaryTracker.summary();

  return {
    generatedAt,
    windowDays,
    windowStart,
    windowEnd: generatedAt,
    sampleCount: retainedSamples.length,
    falseLinkCount: summary.mismatches,
    falseLinkRate: summary.mismatchRate,
    byMismatchType: summary.byMismatchType,
    topActiveAgents: countShadowAgentCoverage(retainedSamples)
  };
}
