function normalizeSkill(skill) {
  return String(skill || "").trim().toLowerCase();
}

function normalizeAgent(agentId) {
  return String(agentId || "").trim();
}

export function createSkillExceptionRegistry() {
  const grants = [];
  const events = [];

  function logEvent(type, payload) {
    events.push({
      type,
      timestampMs: Date.now(),
      payload: { ...payload }
    });
  }

  function markExpired(nowMs) {
    for (const grant of grants) {
      if (!grant.expired && grant.expiresAt <= nowMs) {
        grant.expired = true;
        logEvent("expired", {
          agentId: grant.agentId,
          skill: grant.skill,
          expiresAt: grant.expiresAt
        });
      }
    }
  }

  return {
    grant({ agentId, skill, reason, approver, expiresAt }) {
      const normalizedAgentId = normalizeAgent(agentId);
      const normalizedSkill = normalizeSkill(skill);

      if (!normalizedAgentId) {
        throw new Error("agentId is required.");
      }
      if (!normalizedSkill) {
        throw new Error("skill is required.");
      }
      if (!String(reason || "").trim()) {
        throw new Error("reason is required.");
      }
      if (!String(approver || "").trim()) {
        throw new Error("approver is required.");
      }
      if (typeof expiresAt !== "number" || expiresAt <= Date.now()) {
        throw new Error("expiresAt must be a future unix timestamp in milliseconds.");
      }

      const record = {
        agentId: normalizedAgentId,
        skill: normalizedSkill,
        reason: String(reason),
        approver: String(approver),
        expiresAt,
        grantedAt: Date.now(),
        expired: false
      };
      grants.push(record);
      logEvent("granted", {
        agentId: record.agentId,
        skill: record.skill,
        approver: record.approver,
        expiresAt: record.expiresAt
      });

      return { ...record };
    },

    listActive(agentId) {
      const normalizedAgentId = normalizeAgent(agentId);
      const nowMs = Date.now();
      markExpired(nowMs);

      return grants
        .filter((grant) => !grant.expired && grant.agentId === normalizedAgentId)
        .map((grant) => ({
          agentId: grant.agentId,
          skill: grant.skill,
          reason: grant.reason,
          approver: grant.approver,
          expiresAt: grant.expiresAt,
          grantedAt: grant.grantedAt
        }));
    },

    isSkillAllowedByException(agentId, skill, nowMs = Date.now()) {
      const normalizedAgentId = normalizeAgent(agentId);
      const normalizedSkill = normalizeSkill(skill);
      markExpired(nowMs);

      const allowed = grants.some((grant) => {
        return !grant.expired && grant.agentId === normalizedAgentId && grant.skill === normalizedSkill;
      });

      logEvent("checked", {
        agentId: normalizedAgentId,
        skill: normalizedSkill,
        allowed,
        checkedAt: nowMs
      });

      return allowed;
    },

    auditLog() {
      return events.map((event) => ({
        type: event.type,
        timestampMs: event.timestampMs,
        payload: { ...event.payload }
      }));
    }
  };
}
