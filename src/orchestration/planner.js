const DOMAIN_KEYWORDS = Object.freeze({
  frontend: ["ui", "component", "page", "layout", "css", "style", "react", "view", "render", "browser", "dom"],
  backend: ["api", "endpoint", "server", "route", "handler", "middleware", "service", "database", "query", "migration"],
  testing: ["test", "spec", "assert", "coverage", "mock", "stub", "e2e", "integration test", "unit test"],
  devops: ["deploy", "pipeline", "ci", "cd", "docker", "container", "kubernetes", "k8s", "terraform", "infrastructure"],
  architecture: ["design", "pattern", "architecture", "diagram", "rfc", "adr", "schema", "model"],
  security: ["auth", "permission", "encrypt", "token", "oauth", "rbac", "vulnerability", "audit"],
  ai: ["model", "llm", "embedding", "inference", "prompt", "rag", "fine-tune", "training", "ml"],
  general: ["refactor", "fix", "update", "improve", "add", "create", "implement", "build"]
});

const DEPENDENCY_SIGNALS = Object.freeze([
  { pattern: /\bthen\b/i, type: "sequential" },
  { pattern: /\bafter\b/i, type: "sequential" },
  { pattern: /\bbefore\b/i, type: "reverse-sequential" },
  { pattern: /\bonce\b.*\bis\b/i, type: "sequential" },
  { pattern: /\busing\b/i, type: "depends-on-prior" },
  { pattern: /\bbased on\b/i, type: "depends-on-prior" },
  { pattern: /\bwith\b.*\bfrom\b/i, type: "depends-on-prior" }
]);

const RISK_INDICATORS = Object.freeze({
  CRITICAL: ["production", "database migration", "breaking change", "delete", "drop", "destroy", "credentials", "secrets"],
  HIGH: ["deploy", "auth", "security", "payment", "user data", "api change", "schema change", "infrastructure"],
  MEDIUM: ["refactor", "new feature", "integration", "update dependency", "configuration"],
  LOW: ["test", "documentation", "style", "lint", "comment", "readme", "typo"]
});

const COMPLEXITY_SIGNALS = Object.freeze({
  high: ["integrate", "migrate", "redesign", "rewrite", "architect", "distributed", "concurrent"],
  medium: ["implement", "create", "build", "add feature", "connect", "extend"],
  low: ["fix", "update", "rename", "move", "document", "configure", "toggle"]
});

const VALIDATION_CRITERIA_BY_DOMAIN = Object.freeze({
  frontend: ["Visual regression tests pass.", "Accessibility audit passes (WCAG 2.1 AA).", "Cross-browser rendering verified."],
  backend: ["API contract tests pass.", "No N+1 queries detected.", "Error handling covers edge cases."],
  testing: ["Coverage threshold met.", "No flaky tests introduced.", "Test isolation verified."],
  devops: ["Infrastructure changes are idempotent.", "Rollback procedure documented.", "Health checks pass post-deploy."],
  architecture: ["Design reviewed and approved.", "ADR or RFC documented.", "Backward compatibility maintained."],
  security: ["Security scan passes.", "No secrets in source.", "Principle of least privilege applied."],
  ai: ["Model output validated against golden set.", "Latency within SLA bounds.", "Fallback behavior tested."],
  general: ["Output is deterministic and validated.", "Security and policy checks pass.", "Tests or verification evidence attached."]
});

function detectDomain(text) {
  const lower = text.toLowerCase();
  let bestDomain = "general";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (domain === "general") continue;
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}

function assessRisk(text) {
  const lower = text.toLowerCase();

  for (const [level, indicators] of Object.entries(RISK_INDICATORS)) {
    if (indicators.some((ind) => lower.includes(ind))) {
      return level;
    }
  }

  return "MEDIUM";
}

function estimateComplexity(text) {
  const lower = text.toLowerCase();

  for (const [level, signals] of Object.entries(COMPLEXITY_SIGNALS)) {
    if (signals.some((sig) => lower.includes(sig))) {
      return level;
    }
  }

  return "medium";
}

function getAcceptanceCriteria(domain, text) {
  const base = VALIDATION_CRITERIA_BY_DOMAIN[domain] || VALIDATION_CRITERIA_BY_DOMAIN.general;
  const extra = [];

  if (/\bperformance\b/i.test(text)) extra.push("Performance benchmarks meet defined thresholds.");
  if (/\bbackward.?compat/i.test(text)) extra.push("Backward compatibility verified with existing consumers.");
  if (/\bidempoten/i.test(text)) extra.push("Operation is idempotent and safe to retry.");

  return [...base, ...extra];
}

function decomposeDescription(description) {
  const text = String(description || "").trim();
  if (!text) return [{ text: "Deliver the requested outcome", connector: null }];

  const clauses = [];
  const sentenceSplitPattern = /(?:;\s*)|(?:\.\s+(?=[A-Z]))|(?:\n\s*[-*]\s*)|(?:\n\s*\d+[.)]\s*)/;
  const sentences = text.split(sentenceSplitPattern).filter((s) => s.trim().length > 0);

  for (const sentence of sentences) {
    const conjunctionPattern = /\b(then|after that|next|finally|afterwards|subsequently|once done)\b/gi;
    const parts = sentence.split(conjunctionPattern);

    let connector = null;
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      if (conjunctionPattern.test(trimmed)) {
        connector = trimmed.toLowerCase();
        conjunctionPattern.lastIndex = 0;
        continue;
      }

      clauses.push({ text: trimmed, connector });
      connector = null;
    }
  }

  return clauses.length > 0 ? clauses : [{ text, connector: null }];
}

function detectImplicitDependencies(steps) {
  const outputArtifacts = new Map();

  for (const step of steps) {
    const lower = step.title.toLowerCase();

    if (/\bcreate\b|\bbuild\b|\bimplement\b|\bset up\b|\binitialize\b/.test(lower)) {
      const nouns = lower.match(/\b(?:api|service|database|schema|component|module|endpoint|model|config|pipeline)\b/g) || [];
      for (const noun of nouns) {
        outputArtifacts.set(noun, step.id);
      }
    }
  }

  for (const step of steps) {
    const lower = step.title.toLowerCase();
    const consumptionPatterns = [
      /\btest\b.*\b(\w+)\b/,
      /\bconnect\b.*\bto\b.*\b(\w+)\b/,
      /\buse\b.*\b(\w+)\b/,
      /\bdeploy\b.*\b(\w+)\b/,
      /\bintegrate\b.*\b(\w+)\b/,
      /\bdocument\b.*\b(\w+)\b/
    ];

    for (const [artifact, producerId] of outputArtifacts) {
      if (step.id === producerId) continue;
      if (lower.includes(artifact)) {
        if (!step.dependsOn.includes(producerId)) {
          step.dependsOn.push(producerId);
        }
      }
    }

    if (/\btest|spec|assert|verify\b/i.test(lower)) {
      for (const other of steps) {
        if (other.id === step.id) continue;
        if (/\bcreate|build|implement\b/i.test(other.title.toLowerCase())) {
          const otherNouns = other.title.toLowerCase().match(/\b(?:api|service|database|component|module|endpoint|model)\b/g) || [];
          const stepRef = otherNouns.some((n) => lower.includes(n));
          if (stepRef && !step.dependsOn.includes(other.id)) {
            step.dependsOn.push(other.id);
          }
        }
      }
    }

    if (/\bdeploy|release|ship\b/i.test(lower)) {
      for (const other of steps) {
        if (other.id === step.id) continue;
        if (/\btest|verify|validate\b/i.test(other.title.toLowerCase())) {
          if (!step.dependsOn.includes(other.id)) {
            step.dependsOn.push(other.id);
          }
        }
      }
    }
  }

  return steps;
}

function parseAnnotations(text) {
  const annotations = {};
  const riskMatch = text.match(/\[risk:\s*(LOW|MEDIUM|HIGH|CRITICAL)\]/i);
  if (riskMatch) {
    annotations.risk = riskMatch[1].toUpperCase();
  }

  const domainMatch = text.match(/\[domain:\s*(\w+)\]/i);
  if (domainMatch) {
    annotations.domain = domainMatch[1].toLowerCase();
  }

  const complexityMatch = text.match(/\[complexity:\s*(low|medium|high)\]/i);
  if (complexityMatch) {
    annotations.complexity = complexityMatch[1].toLowerCase();
  }

  const cleanedText = text
    .replace(/\[risk:\s*\w+\]/gi, "")
    .replace(/\[domain:\s*\w+\]/gi, "")
    .replace(/\[complexity:\s*\w+\]/gi, "")
    .trim();

  return { cleanedText, annotations };
}

function toSentence(value) {
  const text = String(value || "").trim();
  if (text.length === 0) return "";
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
  return capitalized.endsWith(".") ? capitalized : `${capitalized}.`;
}

function validateDependencyGraph(steps) {
  const ids = new Set(steps.map((s) => s.id));
  for (const step of steps) {
    step.dependsOn = step.dependsOn.filter((dep) => ids.has(dep) && dep !== step.id);
  }

  const visited = new Set();
  const visiting = new Set();

  function hasCycle(stepId) {
    if (visiting.has(stepId)) return true;
    if (visited.has(stepId)) return false;
    visiting.add(stepId);
    const step = steps.find((s) => s.id === stepId);
    if (step) {
      for (const dep of step.dependsOn) {
        if (hasCycle(dep)) return true;
      }
    }
    visiting.delete(stepId);
    visited.add(stepId);
    return false;
  }

  for (const step of steps) {
    if (hasCycle(step.id)) {
      step.dependsOn = step.dependsOn.slice(0, 1);
    }
  }

  return steps;
}

export function createExecutionPlan(task) {
  const description = String(task.description || "");
  const clauses = decomposeDescription(description);

  const steps = clauses.map((clause, index) => {
    const { cleanedText, annotations } = parseAnnotations(clause.text);
    const domain = annotations.domain || detectDomain(cleanedText);
    const risk = annotations.risk || assessRisk(cleanedText);
    const complexity = annotations.complexity || estimateComplexity(cleanedText);
    const id = `step-${index + 1}`;

    const dependsOn = [];
    if (clause.connector && index > 0) {
      dependsOn.push(`step-${index}`);
    }

    return {
      id,
      title: toSentence(cleanedText),
      dependsOn,
      domain,
      risk,
      acceptanceCriteria: getAcceptanceCriteria(domain, cleanedText),
      estimatedComplexity: complexity
    };
  });

  detectImplicitDependencies(steps);
  validateDependencyGraph(steps);

  return steps;
}
