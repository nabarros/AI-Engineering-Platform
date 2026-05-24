export class TaskLeaseManager {
  constructor({ nowFn = () => Date.now() } = {}) {
    this.nowFn = nowFn;
    this.leases = new Map();
  }

  acquire({ taskId, agentId, ttlMs }) {
    const now = this.nowFn();
    const existing = this.leases.get(taskId);

    if (existing && existing.expiresAt > now && existing.holderAgentId !== agentId) {
      return {
        acquired: false,
        reason: "LEASE_HELD",
        lease: { ...existing }
      };
    }

    const lease = {
      taskId,
      holderAgentId: agentId,
      ttlMs,
      acquiredAt: now,
      heartbeatAt: now,
      expiresAt: now + ttlMs
    };

    this.leases.set(taskId, lease);
    return {
      acquired: true,
      lease: { ...lease }
    };
  }

  heartbeat({ taskId, agentId, ttlMs }) {
    const now = this.nowFn();
    const lease = this.leases.get(taskId);

    if (!lease) {
      return { renewed: false, reason: "LEASE_MISSING" };
    }

    if (lease.holderAgentId !== agentId) {
      return { renewed: false, reason: "LEASE_NOT_OWNER", lease: { ...lease } };
    }

    if (lease.expiresAt <= now) {
      return { renewed: false, reason: "LEASE_EXPIRED", lease: { ...lease } };
    }

    lease.heartbeatAt = now;
    lease.ttlMs = ttlMs || lease.ttlMs;
    lease.expiresAt = now + lease.ttlMs;

    return { renewed: true, lease: { ...lease } };
  }

  release({ taskId, agentId }) {
    const lease = this.leases.get(taskId);
    if (!lease) {
      return { released: false, reason: "LEASE_MISSING" };
    }

    if (lease.holderAgentId !== agentId) {
      return { released: false, reason: "LEASE_NOT_OWNER", lease: { ...lease } };
    }

    this.leases.delete(taskId);
    return { released: true };
  }

  reclaimExpired() {
    const now = this.nowFn();
    const reclaimed = [];

    for (const [taskId, lease] of this.leases.entries()) {
      if (lease.expiresAt <= now) {
        reclaimed.push({ ...lease });
        this.leases.delete(taskId);
      }
    }

    return {
      reclaimedCount: reclaimed.length,
      reclaimed
    };
  }
}
