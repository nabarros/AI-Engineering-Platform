export function runExceptionExpiryEnforcement({ registry, nowMs = Date.now() } = {}) {
  if (!registry || typeof registry.enforceExpiry !== "function" || typeof registry.listActive !== "function") {
    throw new Error("registry with enforceExpiry() and listActive() is required.");
  }

  const enforcementResult = registry.enforceExpiry(nowMs);
  const closureLog = typeof registry.closureLog === "function" ? registry.closureLog() : [];

  return {
    enforcedAt: nowMs,
    closedCount: enforcementResult.closed.length,
    closed: enforcementResult.closed,
    closureLog,
    activeByAgent: []
  };
}
