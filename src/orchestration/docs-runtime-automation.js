export function generateAgentRosterFromRegistry(registry = []) {
  const rows = (Array.isArray(registry) ? registry : [])
    .map((entry) => ({
      id: entry.id,
      domains: Array.isArray(entry.domains) ? entry.domains : [],
      maxRisk: entry.maxRisk,
      tokenCostTier: entry.tokenCostTier,
      latencyTier: entry.latencyTier
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    generatedAtMs: Date.now(),
    count: rows.length,
    rows
  };
}

export function checkNamingParity({ runtimeIds = [], routerCallableIds = [], frontmatterNames = [] } = {}) {
  const runtime = new Set(runtimeIds);
  const callable = new Set(routerCallableIds);
  const frontmatter = new Set(frontmatterNames);

  const missingInCallable = [...runtime].filter((id) => !callable.has(id));
  const missingInFrontmatter = [...runtime].filter((id) => !frontmatter.has(id));
  const callableUnknown = [...callable].filter((id) => !runtime.has(id));

  return {
    pass: missingInCallable.length === 0 && missingInFrontmatter.length === 0 && callableUnknown.length === 0,
    missingInCallable,
    missingInFrontmatter,
    callableUnknown
  };
}

export function lintReportAgentCounts({ reportText = "", expectedCount } = {}) {
  const text = String(reportText || "");
  const regex = /(\d+)\s+(routing-system\s+)?agents/gi;
  const findings = [];

  let match = regex.exec(text);
  while (match) {
    const found = Number(match[1]);
    if (Number.isFinite(expectedCount) && found !== expectedCount) {
      findings.push({
        found,
        expected: expectedCount,
        message: `Outdated agent count detected: ${found}, expected ${expectedCount}.`
      });
    }
    match = regex.exec(text);
  }

  return {
    pass: findings.length === 0,
    findings
  };
}
