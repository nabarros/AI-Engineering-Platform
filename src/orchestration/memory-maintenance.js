import { OrchestrationMemory } from "./memory-store.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function createMemoryMaintenanceSampleState(nowMs = Date.now()) {
  const expiredAt = nowMs - DAY_IN_MS;
  const freshAt = nowMs - 2 * 60 * 60 * 1000;

  return {
    taskMetadata: [
      [
        "req-expired",
        {
          requestId: "req-expired",
          payload: { intent: "feature", summary: "expired task metadata" },
          updatedAt: expiredAt,
          provenanceScore: 0.7,
          expiresAt: nowMs - 1000
        }
      ],
      [
        "req-fresh",
        {
          requestId: "req-fresh",
          payload: { intent: "feature", summary: "fresh task metadata" },
          updatedAt: freshAt,
          provenanceScore: 0.9,
          expiresAt: null
        }
      ]
    ],
    repositoryMetadata: [
      [
        "repo-expired",
        {
          key: "repo-expired",
          payload: { ownerTeam: "platform", summary: "expired repository metadata" },
          updatedAt: expiredAt,
          provenanceScore: 0.8,
          expiresAt: nowMs - 1000
        }
      ],
      [
        "repo-fresh",
        {
          key: "repo-fresh",
          payload: { ownerTeam: "platform", summary: "fresh repository metadata" },
          updatedAt: freshAt,
          provenanceScore: 1,
          expiresAt: null
        }
      ]
    ]
  };
}

export function normalizeMemoryMaintenanceInput(input) {
  if (!input) {
    return null;
  }

  if (typeof input === "object" && !Array.isArray(input)) {
    if (input.state && typeof input.state === "object") {
      return {
        state: input.state,
        nowMs: typeof input.nowMs === "number" ? input.nowMs : Date.now()
      };
    }

    if (Array.isArray(input.taskMetadata) || Array.isArray(input.repositoryMetadata)) {
      return {
        state: input,
        nowMs: typeof input.nowMs === "number" ? input.nowMs : Date.now()
      };
    }
  }

  return null;
}

export function runMemoryMaintenance(input = null, options = {}) {
  const nowMs = typeof options.nowMs === "number" ? options.nowMs : Date.now();
  const memory = new OrchestrationMemory();
  const normalizedInput = normalizeMemoryMaintenanceInput(input);
  const state = normalizedInput?.state || createMemoryMaintenanceSampleState(nowMs);
  const effectiveNowMs = typeof normalizedInput?.nowMs === "number" ? normalizedInput.nowMs : nowMs;

  memory.importState(state);

  const pruned = memory.pruneExpiredIndexedMetadata(effectiveNowMs);
  const reindexed = memory.reindexMetadata();
  const exported = memory.exportState();

  return {
    generatedAt: effectiveNowMs,
    inputSource: normalizedInput ? "input" : "sample",
    pruned,
    reindexed,
    remaining: {
      taskMetadata: exported.taskMetadata.length,
      repositoryMetadata: exported.repositoryMetadata.length
    }
  };
}