import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CAPABILITY_REGISTRY,
  DEFAULT_SCORING_WEIGHTS,
  createRouterRuntimeAdapter,
  IndexedSharedStateStore,
  TenantStateStore,
  HttpSharedStateStore,
  buildQualityDashboard,
  buildSubsetTokenImpactDashboard,
  buildSubsetTokenImpactReport,
  AdaptiveWeightTuner,
  executeTaskGraph,
  WorkflowEngine
} from "../orchestration/index.js";
import { createAuthGuard, IdempotencyCache, SlidingWindowRateLimiter } from "./security-controls.js";
import { getRouterKnowledgeStore } from "../services/router-knowledge-store.js";

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length ? safeJsonParse(raw) : {};
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

export function createOrchestrationServer(options = {}) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const stateFilePath = options.stateFilePath || path.join(__dirname, "..", "..", "data", "orchestration-state.json");
  const remoteSharedStateUrl = options.sharedStateUrl || process.env.ORCHESTRATION_SHARED_STATE_URL || "";
  const remoteStateApiKey = options.sharedStateApiKey || process.env.ORCHESTRATION_STATE_API_KEY || "";
  const runtimeEnvironment = options.runtimeEnvironment || process.env.NODE_ENV || "development";
  const sharedStateStore = options.sharedStateStore || (remoteSharedStateUrl
    ? new HttpSharedStateStore({ baseUrl: remoteSharedStateUrl, apiKey: remoteStateApiKey })
    : new IndexedSharedStateStore(stateFilePath));
  const authGuard = createAuthGuard(options.auth || {});
  const rateLimiter = new SlidingWindowRateLimiter(options.rateLimit || { limit: 120, windowMs: 60_000 });
  const idempotencyCache = new IdempotencyCache(options.idempotency || { ttlMs: 5 * 60_000 });

  const tenantRuntimes = new Map();

  function getTenantRuntime(tenantId) {
    if (tenantRuntimes.has(tenantId)) {
      return tenantRuntimes.get(tenantId);
    }

    const weightTuner = new AdaptiveWeightTuner({
      initialWeights: DEFAULT_SCORING_WEIGHTS,
      targetSuccessRate: 0.92,
      targetAvgTokens: 2800,
      targetAvgLatencyMs: 450,
      windowSize: 50
    });

    const runtime = {
      adapter: createRouterRuntimeAdapter({
        capabilityRegistry: options.capabilityRegistry || DEFAULT_CAPABILITY_REGISTRY,
        stateStore: new TenantStateStore(sharedStateStore, tenantId),
        weightTuner
      }),
      weightTuner,
      executions: []
    };

    const workflowEngine = new WorkflowEngine(runtime.adapter.orchestrator, {
      jobsDir: path.join(__dirname, "..", "..", "data", "jobs", tenantId),
      memoryDir: path.join(__dirname, "..", "..", "data", "memory", tenantId)
    });
    workflowEngine.start().catch(err => {
      console.error(`[WorkflowEngine] Failed to start workflow engine for tenant ${tenantId}:`, err);
    });
    runtime.workflowEngine = workflowEngine;

    tenantRuntimes.set(tenantId, runtime);
    return runtime;
  }

  function getTenantId(req, input) {
    return String(req.headers["x-tenant-id"] || input?.tenantId || "default").trim();
  }

  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const url = req.url || "/";
    const input = method === "POST" ? await readBody(req) : {};
    const tenantId = getTenantId(req, input);
    const auth = authGuard.verify(req, tenantId);
    if (!auth.allowed) {
      return sendJson(res, auth.statusCode || 403, {
        error: auth.message,
        code: auth.code
      });
    }

    const limiter = rateLimiter.check(`${auth.principal}:${tenantId}:${method}:${url}`);
    if (!limiter.allowed) {
      res.setHeader("retry-after", String(limiter.retryAfterSeconds));
      return sendJson(res, 429, {
        error: "Rate limit exceeded",
        code: "RATE_LIMITED"
      });
    }

    const runtime = getTenantRuntime(tenantId);

    if (method === "GET" && url === "/health") {
      return sendJson(res, 200, { ok: true, service: "orchestration-api", tenantId });
    }

    if (method === "GET" && url === "/weights") {
      return sendJson(res, 200, {
        weights: runtime.weightTuner.getWeights(),
        rollingMetrics: runtime.weightTuner.getRollingMetrics(),
        tenantId
      });
    }

    if (method === "GET" && url === "/metrics") {
      const subsetTokenImpactReport = buildSubsetTokenImpactReport(runtime.executions);
      const subsetTokenImpactDashboard = buildSubsetTokenImpactDashboard(subsetTokenImpactReport);

      return sendJson(res, 200, {
        dashboard: buildQualityDashboard(runtime.executions),
        subsetTokenImpact: {
          report: subsetTokenImpactReport,
          dashboard: subsetTokenImpactDashboard
        },
        recentSubsetAlertsCount: runtime.executions.filter((execution) => execution.subsetViolation === true).length,
        rollingMetrics: runtime.weightTuner.getRollingMetrics(),
        tenantId,
        stateIndex: await Promise.resolve(sharedStateStore.getIndexSummary())
      });
    }

    if (method === "POST" && url === "/orchestrate") {
      if (!input || !input.task) {
        return sendJson(res, 400, {
          error: "Invalid request",
          code: "INVALID_PAYLOAD",
          details: { required: ["task"] }
        });
      }

      const budget = {
        tokenBudgetTier: "LOW",
        latencyBudgetTier: "LOW",
        creditMode: "MAX_EFFICIENCY",
        ...(input.budget || {})
      };

      const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();
      if (idempotencyKey) {
        const replay = idempotencyCache.get(`${tenantId}:${idempotencyKey}`);
        if (replay) {
          return sendJson(res, replay.statusCode, {
            data: replay.payload,
            meta: { idempotencyReplay: true, tenantId }
          });
        }
      }

      const requestPayload = {
        requestId: input.requestId || `api-${Date.now()}`,
        task: input.task,
        budget,
        confirmation: input.confirmation === true,
        runtimeEnvironment,
        executionEvidence: input.executionEvidence || null
      };

      const job = await runtime.workflowEngine.createJob(tenantId, requestPayload);
      await runtime.workflowEngine.enqueueJob(job);

      const completedJob = await runtime.workflowEngine.waitForJob(job.job_id, 5000);

      if (completedJob.timeout) {
        return sendJson(res, 202, {
          status: "running",
          jobId: job.job_id,
          message: "Job is processing asynchronously",
          meta: { tenantId }
        });
      }

      const result = completedJob.checkpoint_data.result || { ok: false, error: completedJob.error };

      runtime.executions.push({
        taskClass: String(requestPayload.task?.taskClass || requestPayload.task?.class || requestPayload.task?.domain || requestPayload.task?.objective || "unspecified"),
        verificationPass: result.verification?.pass === true,
        fallbackUsed: Array.isArray(result.fallbackChain) && result.fallbackChain.length > 0,
        tokenUsage: Number(requestPayload.executionEvidence?.tokenUsage || 0),
        selectedAgent: result.selectedSpecialist || null,
        primaryDomain: result.classification?.primaryDomain || String(requestPayload.task?.domain || "unknown").toLowerCase(),
        isCompound: result.classification?.isCompound === true,
        needsClarification: result.needsClarification === true,
        delegationStatus: result.delegation?.status || (result.ok ? "delegated" : "blocked"),
        delegationReasonCode: result.delegation?.reasonCode || (result.ok ? "delegation_succeeded" : String(result.error || "unknown").toLowerCase()),
        subsetApplied: result.error !== "SKILL_POLICY_BLOCKED",
        subsetViolation: result.error === "SKILL_POLICY_BLOCKED"
      });
      if (runtime.executions.length > 500) runtime.executions.shift();

      const statusCode = result.ok ? 200 : 422;
      if (idempotencyKey) {
        idempotencyCache.set(`${tenantId}:${idempotencyKey}`, {
          statusCode,
          payload: result
        });
      }

      return sendJson(res, statusCode, {
        data: result,
        meta: { idempotencyReplay: false, tenantId, jobId: job.job_id }
      });
    }

    if (method === "POST" && url === "/orchestrate-graph") {
      if (!input || !Array.isArray(input.nodes) || input.nodes.length === 0) {
        return sendJson(res, 400, {
          error: "Invalid graph request",
          code: "INVALID_GRAPH",
          details: { required: ["nodes"] }
        });
      }

      const handlers = {
        routing: async ({ node }) => {
          const payload = {
            requestId: `${input.requestId || `graph-${Date.now()}`}-${node.id}`,
            task: node.task,
            budget: node.budget,
            confirmation: node.confirmation === true,
            runtimeEnvironment,
            executionEvidence: node.executionEvidence
          };
          return runtime.adapter.orchestrateRouting(payload);
        }
      };

      const graphResult = await executeTaskGraph({
        nodes: input.nodes,
        edges: input.edges || [],
        handlers,
        maxConcurrency: input.maxConcurrency || 3
      });

      return sendJson(res, graphResult.ok ? 200 : 422, {
        data: graphResult,
        meta: { tenantId }
      });
    }

    // ── Router Knowledge routes ──────────────────────────────────────────
    if (method === "POST" && url === "/v1/router/knowledge/lookup") {
      const promptText = input?.promptText;
      if (!promptText || typeof promptText !== "string") {
        return sendJson(res, 400, { error: "promptText is required", code: "VALIDATION_ERROR" });
      }
      const store = getRouterKnowledgeStore();
      const hit = await store.lookup(promptText, {
        taskDomain: input?.taskDomain,
        taskRisk: input?.taskRisk
      });
      return sendJson(res, 200, { data: hit, hit: hit !== null });
    }

    if (method === "POST" && url === "/v1/router/knowledge/store") {
      const entry = input;
      if (!entry?.promptText || !entry?.selectedAgent) {
        return sendJson(res, 400, { error: "promptText and selectedAgent are required", code: "VALIDATION_ERROR" });
      }
      const store = getRouterKnowledgeStore();
      store.store(entry);
      return sendJson(res, 202, { data: { queued: true } });
    }

    if (method === "GET" && url === "/v1/router/knowledge/health") {
      const store = getRouterKnowledgeStore();
      return sendJson(res, 200, { data: store.healthStatus() });
    }

    const pathname = String(url).split("?")[0];

    // ── Workflow Jobs routes ──────────────────────────────────────────
    if (method === "GET" && pathname === "/v1/jobs") {
      const jobs = await runtime.workflowEngine.listJobs();
      return sendJson(res, 200, { data: jobs });
    }

    if (method === "POST" && pathname.startsWith("/v1/jobs/") && pathname.endsWith("/resume")) {
      const jobId = pathname.split("/")[3];
      const job = await runtime.workflowEngine.getJob(jobId);
      if (!job) {
        return sendJson(res, 404, { error: `Job ${jobId} not found`, code: "JOB_NOT_FOUND" });
      }
      job.status = "pending";
      job.error = null;
      await runtime.workflowEngine.enqueueJob(job);
      return sendJson(res, 202, { data: { resumed: true, jobId } });
    }

    if (method === "GET" && pathname.startsWith("/v1/jobs/")) {
      const jobId = pathname.split("/")[3];
      const job = await runtime.workflowEngine.getJob(jobId);
      if (!job) {
        return sendJson(res, 404, { error: `Job ${jobId} not found`, code: "JOB_NOT_FOUND" });
      }
      return sendJson(res, 200, { data: job });
    }

    return sendJson(res, 404, {
      error: "Not found",
      code: "NOT_FOUND"
    });
  });

  return {
    server,
    stateFilePath,
    close: () => new Promise(async (resolve, reject) => {
      try {
        for (const runtime of tenantRuntimes.values()) {
          if (runtime.workflowEngine) {
            await runtime.workflowEngine.stop();
          }
        }
      } catch (err) {
        console.error("[OrchestrationServer] Failed to stop workflow engines:", err);
      }
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    })
  };
}

export function startOrchestrationServer(options = {}) {
  const host = options.host || "127.0.0.1";
  const port = Number(options.port || process.env.ORCHESTRATION_PORT || 8787);
  const runtime = createOrchestrationServer(options);

  return new Promise((resolve, reject) => {
    runtime.server.listen(port, host, () => {
      resolve({
        host,
        port,
        stateFilePath: runtime.stateFilePath,
        close: runtime.close,
        server: runtime.server
      });
    });
    runtime.server.on("error", reject);
  });
}
