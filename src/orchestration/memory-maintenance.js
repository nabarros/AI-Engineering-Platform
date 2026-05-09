import { OrchestrationMemory } from "./memory-store.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function createMemoryMaintenanceSampleState(nowMs = Date.now()) {
  const expiredAt = nowMs - DAY_IN_MS;
  const freshAt = nowMs - 2 * 60 * 60 * 1000;
  const staleAt = nowMs - 45 * DAY_IN_MS;

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
      ],
      [
        "repo-stale-low-value",
        {
          key: "repo-stale-low-value",
          payload: { ownerTeam: "platform", summary: "stale metadata" },
          updatedAt: staleAt,
          provenanceScore: 0.1,
          metadata: {
            provenance: { score: 0.1 },
            source: { sourceType: "sample" },
            writtenAt: staleAt,
            updatedAt: staleAt
          },
          expiresAt: null
        }
      ]
    ],
    repositoryGraph: [
      [
        "repo-fresh",
        {
          key: "repo-fresh",
          payload: {
            symbols: ["runMemoryMaintenance"],
            dependencies: ["memory-store.js"],
            ownership: ["memory-platform"],
            links: ["docs/runbooks/memory.md"],
            summary: "Fresh graph node"
          },
          updatedAt: freshAt,
          expiresAt: null
        }
      ],
      [
        "repo-stale",
        {
          key: "repo-stale",
          payload: {
            symbols: ["oldSymbol"],
            dependencies: ["legacy.js"],
            ownership: ["legacy-team"],
            links: [],
            summary: "Stale graph node"
          },
          updatedAt: staleAt,
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
  const compaction = memory.compactAndArchive({ nowMs: effectiveNowMs });
  const reindexed = memory.reindexMetadata();
  const graphHealth = memory.getRepositoryGraphHealthReport({ nowMs: effectiveNowMs });
  const exported = memory.exportState();

  return {
    generatedAt: effectiveNowMs,
    inputSource: normalizedInput ? "input" : "sample",
    pruned,
    compaction,
    reindexed,
    graphHealth,
    remaining: {
      taskMetadata: exported.taskMetadata.length,
      repositoryMetadata: exported.repositoryMetadata.length,
      repositoryGraph: exported.repositoryGraph.length
    },
    archive: {
      memoryEntries: exported.archives.memoryEntries.length,
      indexedMetadata: exported.archives.indexedMetadata.length
    }
  };
}