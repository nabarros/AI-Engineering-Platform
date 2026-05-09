import test from "node:test";
import assert from "node:assert/strict";
import { OrchestrationMemory, buildRelationshipShadowReport, runMemoryMaintenance } from "../../src/orchestration/index.js";

test("should build a 14-day shadow report with false-link summary and top active agents", () => {
  const nowMs = Date.UTC(2026, 4, 9);
  const day = 24 * 60 * 60 * 1000;
  const samples = [
    {
      recordedAt: nowMs - 13 * day,
      task: { domain: "backend", description: "API feature" },
      selectedSpecialist: "AIEP Senior Staff Backend Engineer",
      inferredSpecialist: "AIEP Senior Staff Backend Engineer",
      matches: true,
      mismatchType: "none"
    },
    {
      recordedAt: nowMs - 10 * day,
      task: { domain: "frontend", description: "React component" },
      selectedSpecialist: "AIEP Senior Staff Backend Engineer",
      inferredSpecialist: "AIEP Senior Staff Frontend Engineer",
      matches: false,
      mismatchType: "specialist_mismatch"
    },
    {
      recordedAt: nowMs - 4 * day,
      task: { domain: "review", description: "QA regression" },
      selectedSpecialist: "AIEP Code Reviewer",
      inferredSpecialist: "AIEP Code Reviewer",
      matches: true,
      mismatchType: "none"
    }
  ];

  const report = buildRelationshipShadowReport(samples, { generatedAt: nowMs, windowDays: 14 });

  assert.equal(report.sampleCount, 3);
  assert.equal(report.falseLinkCount, 1);
  assert.equal(report.falseLinkRate, 0.3333);
  assert.equal(report.byMismatchType.specialist_mismatch, 1);
  assert.equal(report.topActiveAgents[0].specialistId, "AIEP Senior Staff Backend Engineer");
  assert.equal(report.topActiveAgents[0].appearances, 3);
});

test("should prune expired metadata and reindex memory maintenance state deterministically", () => {
  const summary = runMemoryMaintenance({
    nowMs: Date.UTC(2026, 4, 9),
    state: {
      taskMetadata: [
        ["req-expired", {
          requestId: "req-expired",
          payload: { summary: "expired" },
          updatedAt: Date.UTC(2026, 4, 1),
          provenanceScore: 0.5,
          expiresAt: Date.UTC(2026, 4, 8)
        }],
        ["req-fresh", {
          requestId: "req-fresh",
          payload: { summary: "fresh" },
          updatedAt: Date.UTC(2026, 4, 8),
          provenanceScore: 0.9,
          expiresAt: null
        }]
      ],
      repositoryMetadata: [
        ["repo-expired", {
          key: "repo-expired",
          payload: { summary: "expired" },
          updatedAt: Date.UTC(2026, 4, 2),
          provenanceScore: 0.4,
          expiresAt: Date.UTC(2026, 4, 8)
        }],
        ["repo-fresh", {
          key: "repo-fresh",
          payload: { summary: "fresh" },
          updatedAt: Date.UTC(2026, 4, 8),
          provenanceScore: 1,
          expiresAt: null
        }]
      ]
    }
  });

  assert.equal(summary.inputSource, "input");
  assert.equal(summary.pruned.total, 2);
  assert.equal(summary.compaction.compactedMemoryEntries, 0);
  assert.equal(summary.compaction.compactedIndexedEntries, 0);
  assert.equal(summary.reindexed.total, 2);
  assert.equal(summary.graphHealth.indexName, "repositoryGraph");
  assert.equal(summary.remaining.taskMetadata, 1);
  assert.equal(summary.remaining.repositoryMetadata, 1);
  assert.equal(summary.remaining.repositoryGraph, 0);
  assert.equal(summary.archive.memoryEntries, 0);
  assert.equal(summary.archive.indexedMetadata, 0);
});

test("should rank repository metadata with graph-like fields above weaker matches", () => {
  const memory = new OrchestrationMemory();

  memory.indexRepositoryMetadata("repo-graph-rich", {
    summary: "backend feature implementation",
    ownerTeam: "platform-backend",
    specialistId: "AIEP Senior Staff Backend Engineer",
    relatedTo: ["service-api", "task-42"],
    links: [{ target: "docs/feature.md" }]
  }, { provenanceScore: 0.9 });

  memory.indexRepositoryMetadata("repo-weak-match", {
    summary: "backend feature implementation"
  }, { provenanceScore: 0.9 });

  const matches = memory.queryIndexedMetadata({
    intent: "backend",
    query: "backend feature implementation",
    limit: 5
  });

  const graphRich = matches.find((match) => match.key === "repo-graph-rich");
  const weakMatch = matches.find((match) => match.key === "repo-weak-match");

  assert.ok(graphRich);
  assert.ok(weakMatch);
  assert.ok(graphRich.score > weakMatch.score);
  assert.ok(graphRich.graphScore > weakMatch.graphScore);
});