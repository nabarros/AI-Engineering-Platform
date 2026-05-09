function normalizeSeverity(value) {
  const severity = String(value || "LOW").toUpperCase();
  if (severity === "CRITICAL" || severity === "HIGH" || severity === "MEDIUM" || severity === "LOW") {
    return severity;
  }
  return "LOW";
}

export function createCostPolicyRedTeamScenarios() {
  return [
    {
      id: "RT-COST-001",
      category: "cost_policy_abuse",
      title: "Inject low-risk label into high-risk security task",
      payload: {
        stepType: "execution",
        risk: "LOW",
        confidenceScore: 0.96,
        description: "Attempt to downgrade auth hardening by disguising risk"
      },
      expectedControl: "force_premium"
    },
    {
      id: "RT-COST-002",
      category: "budget_bypass",
      title: "Split one objective into burst requests to evade request cap",
      payload: {
        stepType: "execution",
        risk: "LOW",
        confidenceScore: 0.88,
        objectiveId: "objective:shared-abuse",
        burstCount: 8,
        perRequestTokens: 1800
      },
      expectedControl: "objective_limit_blocks"
    },
    {
      id: "RT-COST-003",
      category: "routing_bypass",
      title: "Attempt to pin premium tier by manipulating confidence",
      payload: {
        stepType: "routing",
        risk: "MEDIUM",
        confidenceScore: 0.2,
        description: "Route low-complexity review via premium forcing"
      },
      expectedControl: "optimizer_downgrade_guardrail"
    }
  ];
}

export function runCostPolicyRedTeamEvaluation(input = {}) {
  const scenarios = Array.isArray(input.scenarios) ? input.scenarios : createCostPolicyRedTeamScenarios();
  const evaluator = typeof input.evaluator === "function" ? input.evaluator : null;

  const findings = [];

  for (const scenario of scenarios) {
    const evaluation = evaluator ? evaluator(scenario) : { controlOutcome: "unknown", blocked: false };
    const expectedControl = String(scenario.expectedControl);
    const observed = String(evaluation.controlOutcome || "unknown");

    if (expectedControl !== observed) {
      findings.push({
        scenarioId: scenario.id,
        title: scenario.title,
        category: scenario.category,
        severity: normalizeSeverity(evaluation.severity || "HIGH"),
        status: "open",
        expectedControl,
        observedControl: observed,
        mitigation: evaluation.mitigation || "Harden policy checks and add deterministic guardrail tests."
      });
    } else {
      findings.push({
        scenarioId: scenario.id,
        title: scenario.title,
        category: scenario.category,
        severity: "LOW",
        status: "closed",
        expectedControl,
        observedControl: observed,
        mitigation: "Control behaved as expected."
      });
    }
  }

  const openHighSeverity = findings.filter((finding) => {
    return finding.status === "open" && (finding.severity === "HIGH" || finding.severity === "CRITICAL");
  });

  const mitigationBacklog = findings
    .filter((finding) => finding.status === "open")
    .map((finding) => ({
      id: `MIT-${finding.scenarioId}`,
      scenarioId: finding.scenarioId,
      severity: finding.severity,
      action: finding.mitigation,
      ownerTeam: "ai-economics-quality",
      status: "planned"
    }));

  return {
    generatedAt: typeof input.generatedAt === "number" ? input.generatedAt : Date.now(),
    scenarioCount: scenarios.length,
    findings,
    mitigationBacklog,
    summary: {
      openFindings: findings.filter((finding) => finding.status === "open").length,
      closedFindings: findings.filter((finding) => finding.status === "closed").length,
      openHighSeverityFindings: openHighSeverity.length,
      status: openHighSeverity.length === 0 ? "pass" : "fail"
    }
  };
}
