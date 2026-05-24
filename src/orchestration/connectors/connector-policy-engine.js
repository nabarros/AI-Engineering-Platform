function matchRule(rule, request) {
  if (rule.connectorId !== "*" && rule.connectorId !== request.connectorId) {
    return false;
  }

  if (rule.actions !== "*" && Array.isArray(rule.actions) && !rule.actions.includes(request.action)) {
    return false;
  }

  if (!Array.isArray(rule.roles) || rule.roles.length === 0) {
    return true;
  }

  return request.actorRoles.some((role) => rule.roles.includes(role));
}

export function createConnectorPolicyEngine({ tenantPolicies = {} } = {}) {
  function getPolicy(tenantId) {
    return tenantPolicies[tenantId] || { allow: [], deny: [] };
  }

  function evaluate(request) {
    const actorRoles = Array.isArray(request.actorRoles) ? request.actorRoles : [];
    const normalizedRequest = {
      tenantId: request.tenantId,
      connectorId: request.connectorId,
      action: request.action,
      actorRoles
    };

    const policy = getPolicy(normalizedRequest.tenantId);

    const denyRule = (policy.deny || []).find((rule) => matchRule(rule, normalizedRequest));
    if (denyRule) {
      return {
        allowed: false,
        code: "DENY_RULE_MATCH",
        reason: denyRule.reason || "Denied by tenant policy.",
        audit: {
          connectorId: normalizedRequest.connectorId,
          action: normalizedRequest.action,
          tenantId: normalizedRequest.tenantId,
          decision: "deny",
          matchedRule: denyRule
        }
      };
    }

    const allowRule = (policy.allow || []).find((rule) => matchRule(rule, normalizedRequest));
    if (!allowRule) {
      return {
        allowed: false,
        code: "DENY_BY_DEFAULT",
        reason: "No matching allow rule found.",
        audit: {
          connectorId: normalizedRequest.connectorId,
          action: normalizedRequest.action,
          tenantId: normalizedRequest.tenantId,
          decision: "deny",
          matchedRule: null
        }
      };
    }

    return {
      allowed: true,
      code: "ALLOW_RULE_MATCH",
      reason: allowRule.reason || "Allowed by tenant policy.",
      audit: {
        connectorId: normalizedRequest.connectorId,
        action: normalizedRequest.action,
        tenantId: normalizedRequest.tenantId,
        decision: "allow",
        matchedRule: allowRule
      }
    };
  }

  return {
    evaluate
  };
}
