import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { 
  AgentOrchestrator, 
  MemoryService, 
  WorkflowEngine, 
  DEFAULT_CAPABILITY_REGISTRY 
} from "../../src/orchestration/index.js";
import { createOrchestrationServer } from "../../src/api/orchestration-server.js";

const testTmpDir = path.join(process.cwd(), "data", "test-durable");

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

describe("Durable Agent Execution & Memory System Tests", () => {
  before(() => {
    fs.rmSync(testTmpDir, { recursive: true, force: true });
    fs.mkdirSync(testTmpDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(testTmpDir, { recursive: true, force: true });
  });

  test("MemoryService should record interaction and save snapshots/reports", async () => {
    const memoryService = new MemoryService({
      memoryDir: path.join(testTmpDir, "memory")
    });

    const sessionId = "test-session-123";
    const task = {
      description: "Test task routing",
      risk: "LOW"
    };
    const result = {
      ok: true,
      selectedSpecialist: "backend",
      classification: { primaryDomain: "backend" },
      budgetDecision: { effectiveTier: "LOW" }
    };
    const evidence = {
      qualityScore: 0.95,
      tokenUsage: 120,
      latencyMs: 50
    };

    memoryService.recordInteraction(sessionId, task, result, evidence);

    await new Promise(res => setTimeout(res, 200));

    const snapshot = await memoryService.getSnapshot(sessionId);
    assert.strictEqual(snapshot.session_id, sessionId);
    assert.strictEqual(snapshot.active_goal, "Test task routing");
    assert.strictEqual(snapshot.current_topic, "backend");

    const reports = await memoryService.getContextReports(sessionId);
    assert.strictEqual(reports.length, 1);
    assert.strictEqual(reports[0].user_intent, "Test task routing");
    assert.strictEqual(reports[0].assistant_action, "backend");
    assert.strictEqual(reports[0].metadata.tokenUsage, 120);
  });

  test("WorkflowEngine should execute step-by-step and checkpoint", async () => {
    const orchestrator = new AgentOrchestrator({
      capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
      scoringWeights: { domain: 0.35, quality: 0.25, learning: 0.2, cost: 0.12, latency: 0.08 }
    });

    const engine = new WorkflowEngine(orchestrator, {
      jobsDir: path.join(testTmpDir, "jobs"),
      memoryDir: path.join(testTmpDir, "memory")
    });

    await engine.start();

    const requestPayload = {
      task: {
        domain: "backend",
        risk: "LOW",
        description: "Verify backend behavior"
      }
    };

    const job = await engine.createJob("test-tenant", requestPayload);
    assert.strictEqual(job.status, "pending");
    assert.strictEqual(job.current_step, "PARSE_REQUEST");

    await engine.stepParseRequest(job);
    assert.strictEqual(job.current_step, "PLAN_EXECUTION");

    await engine.stepPlanExecution(job);
    assert.strictEqual(job.current_step, "EXECUTE_TOOL_CALLS");
    assert.ok(job.checkpoint_data.plan);
    assert.strictEqual(job.checkpoint_data.classification.primaryDomain, "backend");

    await engine.stepExecuteToolCalls(job);
    assert.strictEqual(job.current_step, "GENERATE_RESPONSE");
    assert.ok(job.checkpoint_data.route);

    await engine.stepGenerateResponse(job);
    assert.strictEqual(job.current_step, "PERSIST_MEMORY");
    assert.ok(job.checkpoint_data.result);

    await engine.stepPersistMemory(job);
    assert.strictEqual(job.current_step, "COMPLETED");
    assert.strictEqual(job.status, "completed");

    await engine.stop();
  });

  test("WorkflowEngine recovery logic should resume incomplete jobs", async () => {
    const orchestrator = new AgentOrchestrator({
      capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
      scoringWeights: { domain: 0.35, quality: 0.25, learning: 0.2, cost: 0.12, latency: 0.08 }
    });

    const engine = new WorkflowEngine(orchestrator, {
      jobsDir: path.join(testTmpDir, "jobs-recovery"),
      memoryDir: path.join(testTmpDir, "memory-recovery")
    });

    const requestPayload = {
      task: {
        domain: "backend",
        risk: "LOW",
        description: "Recovery test"
      }
    };

    const job = await engine.createJob("test-tenant", requestPayload);
    job.status = "running";
    job.current_step = "EXECUTE_TOOL_CALLS";
    job.checkpoint_data.classification = { primaryDomain: "backend" };
    job.checkpoint_data.plan = [];
    job.checkpoint_data.budgetDecision = { effectiveTier: "LOW" };

    await engine.saveJobState(job);

    await engine.start();

    await new Promise(res => setTimeout(res, 500));

    const completedJob = await engine.getJob(job.job_id);
    assert.strictEqual(completedJob.status, "completed");
    assert.strictEqual(completedJob.current_step, "COMPLETED");

    await engine.stop();
  });

  test("Server Integration - HTTP API endpoints", async () => {
    const serverInstance = createOrchestrationServer({
      stateFilePath: path.join(testTmpDir, "server-state.json")
    });

    await new Promise((resolve) => serverInstance.server.listen(9898, "127.0.0.1", resolve));

    const orchestratePayload = {
      task: {
        domain: "backend",
        risk: "LOW",
        description: "API Integration task test"
      }
    };

    const res1 = await makeRequest({
      hostname: "127.0.0.1",
      port: 9898,
      path: "/orchestrate",
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-id": "test-tenant-http" }
    }, orchestratePayload);

    assert.ok([200, 202].includes(res1.statusCode));
    const jobId = res1.body.meta?.jobId || res1.body.jobId;
    assert.ok(jobId);

    await new Promise(res => setTimeout(res, 300));

    const res2 = await makeRequest({
      hostname: "127.0.0.1",
      port: 9898,
      path: "/v1/jobs",
      method: "GET",
      headers: { "x-tenant-id": "test-tenant-http" }
    });
    assert.strictEqual(res2.statusCode, 200);
    assert.ok(Array.isArray(res2.body.data));

    const res3 = await makeRequest({
      hostname: "127.0.0.1",
      port: 9898,
      path: `/v1/jobs/${jobId}`,
      method: "GET",
      headers: { "x-tenant-id": "test-tenant-http" }
    });
    assert.strictEqual(res3.statusCode, 200);
    assert.strictEqual(res3.body.data.job_id, jobId);

    const res4 = await makeRequest({
      hostname: "127.0.0.1",
      port: 9898,
      path: `/v1/jobs/${jobId}/resume`,
      method: "POST",
      headers: { "x-tenant-id": "test-tenant-http" }
    });
    assert.strictEqual(res4.statusCode, 202);
    assert.strictEqual(res4.body.data.resumed, true);

    await serverInstance.close();
  });
});
