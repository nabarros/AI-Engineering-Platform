import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "redis";
import { MemoryService } from "./memory-service.js";
import { classifyTask, routeTask, routeCompoundTask } from "./router.js";
import { enforcePolicy } from "./policy-engine.js";
import { createExecutionPlan } from "./planner.js";
import { resolveModelTierForStep } from "./model-tiering-policy.js";
import { verifyExecution } from "./verifier.js";
import { optimizeCostQuality } from "./cost-quality-optimizer.js";
import { runSkillSubsetDryRun } from "./skill-manifests.js";

const BUDGET_TIER_LEVELS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });

function normalizeBudgetTier(value, fallback = "MEDIUM") {
  const tier = String(value || fallback).toUpperCase();
  return Object.hasOwn(BUDGET_TIER_LEVELS, tier) ? tier : fallback;
}

function minBudgetTier(left, right) {
  const normalizedLeft = normalizeBudgetTier(left);
  const normalizedRight = normalizeBudgetTier(right);
  return (BUDGET_TIER_LEVELS[normalizedLeft] || BUDGET_TIER_LEVELS.MEDIUM) <= (BUDGET_TIER_LEVELS[normalizedRight] || BUDGET_TIER_LEVELS.MEDIUM)
    ? normalizedLeft
    : normalizedRight;
}

function resolveRoutingBudget({ budget, budgetDecision, downgradeDecision }) {
  const strategy = String(budget?.creditMode || budget?.budgetStrategy || "MAX_EFFICIENCY").toUpperCase();
  const explicitTokenTier = normalizeBudgetTier(budget?.tokenBudgetTier || null, "LOW");
  const allocatorTier = normalizeBudgetTier(budgetDecision?.effectiveTier || "LOW", "LOW");
  const downgradeTier = normalizeBudgetTier(downgradeDecision?.recommendedTier || allocatorTier, allocatorTier);

  let tokenBudgetTier = strategy === "QUALITY_FIRST"
    ? explicitTokenTier
    : minBudgetTier(explicitTokenTier, allocatorTier);

  if (budgetDecision?.action === "DOWNGRADE_MODEL") {
    tokenBudgetTier = minBudgetTier(tokenBudgetTier, allocatorTier);
  }

  if (downgradeDecision?.applied === true) {
    tokenBudgetTier = minBudgetTier(tokenBudgetTier, downgradeTier);
  }

  return {
    strategy,
    tokenBudgetTier,
    latencyBudgetTier: normalizeBudgetTier(budget?.latencyBudgetTier || "LOW", "LOW")
  };
}

function capTokenForecastToAllocation(tokenForecast, budgetDecision) {
  const action = String(budgetDecision?.action || "ALLOW").toUpperCase();
  if (action !== "TRUNCATE_CONTEXT") {
    return tokenForecast;
  }

  const cap = Math.max(0, Number(budgetDecision?.allocatedTokens) || 0);
  const predictedTokens = Math.max(0, Number(tokenForecast?.predictedTokens) || 0);
  return {
    ...tokenForecast,
    predictedTokens: Math.min(predictedTokens, cap),
    allocationCap: cap,
    source: `${String(tokenForecast?.source || "baseline")}:allocation_cap`
  };
}

export class WorkflowEngine {
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.jobsDir = options.jobsDir || path.join(process.cwd(), "data", "jobs");
    this.stateDir = path.join(this.jobsDir, "state");
    this.queueDir = path.join(this.jobsDir, "queue");
    this.memoryService = options.memoryService || new MemoryService({ memoryDir: options.memoryDir });

    // Ensure directories exist
    fs.mkdirSync(this.stateDir, { recursive: true });
    fs.mkdirSync(this.queueDir, { recursive: true });

    this.redisUrl = options.redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
    this.redisClient = null;
    this.redisAvailable = false;
    this.isWorkerRunning = false;
    this.jobPromises = new Map();
  }

  async start() {
    try {
      this.redisClient = createClient({
        url: this.redisUrl,
        socket: {
          connectTimeout: 1000,
          reconnectStrategy: () => {
            return new Error("Redis connection failed");
          }
        }
      });
      this.redisClient.on("error", () => {
        this.redisAvailable = false;
      });
      await this.redisClient.connect();
      this.redisAvailable = true;
      console.log(`[WorkflowEngine] Resiliently connected to Redis at ${this.redisUrl}`);
    } catch (err) {
      this.redisAvailable = false;
      console.warn(`[WorkflowEngine] Redis connection failed, falling back to File System queueing: ${err.message}`);
    }

    this.isWorkerRunning = true;
    this._runWorkerLoop().catch(err => {
      console.error("[WorkflowEngine] Worker loop crashed:", err);
    });

    await this.recoverJobs();
  }

  async stop() {
    this.isWorkerRunning = false;
    if (this.redisClient && this.redisAvailable) {
      try {
        await this.redisClient.disconnect();
      } catch (err) {
        // ignore
      }
    }
  }

  async createJob(tenantId, requestPayload) {
    const jobId = requestPayload.requestId || crypto.randomUUID();
    const job = {
      job_id: jobId,
      status: "pending",
      current_step: "PARSE_REQUEST",
      checkpoint_data: {
        tenantId,
        requestId: jobId,
        task: requestPayload.task,
        budget: requestPayload.budget || {},
        executionEvidence: requestPayload.executionEvidence || null,
        runtimeEnvironment: requestPayload.runtimeEnvironment || "development"
      },
      retry_count: 0,
      error: null
    };

    await this.saveJobState(job);
    return job;
  }

  async saveJobState(job) {
    const filePath = path.join(this.stateDir, `${job.job_id}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(job, null, 2), "utf8");
  }

  async getJob(jobId) {
    const filePath = path.join(this.stateDir, `${jobId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  }

  async listJobs() {
    if (!fs.existsSync(this.stateDir)) return [];
    const files = await fs.promises.readdir(this.stateDir);
    const jobs = [];
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const raw = await fs.promises.readFile(path.join(this.stateDir, file), "utf8");
          jobs.push(JSON.parse(raw));
        } catch {
          // ignore
        }
      }
    }
    return jobs;
  }

  async enqueueJob(job) {
    job.status = "pending";
    await this.saveJobState(job);

    if (this.redisAvailable) {
      try {
        await this.redisClient.lPush("aiep_jobs_queue", job.job_id);
        return;
      } catch (err) {
        this.redisAvailable = false;
        console.warn(`[WorkflowEngine] Failed to enqueue to Redis, falling back to FS: ${err.message}`);
      }
    }

    const queuePath = path.join(this.queueDir, `${job.job_id}.json`);
    await fs.promises.writeFile(queuePath, JSON.stringify({ jobId: job.job_id }), "utf8");
  }

  async recoverJobs() {
    console.log("[WorkflowEngine] Recovering unfinished jobs...");
    const jobs = await this.listJobs();
    let recoveredCount = 0;
    for (const job of jobs) {
      if (job.status === "running" || job.status === "pending") {
        console.log(`[WorkflowEngine] Resuming job ${job.job_id} from step ${job.current_step}`);
        recoveredCount++;
        await this.enqueueJob(job);
      }
    }
    if (recoveredCount > 0) {
      console.log(`[WorkflowEngine] Successfully recovered and re-queued ${recoveredCount} jobs.`);
    }
  }

  async _runWorkerLoop() {
    while (this.isWorkerRunning) {
      let jobId = null;

      if (this.redisAvailable) {
        try {
          const res = await this.redisClient.bRPop("aiep_jobs_queue", 1);
          if (res) {
            jobId = res.element;
          }
        } catch (err) {
          this.redisAvailable = false;
          console.warn(`[WorkflowEngine] Redis worker pull failed, switching to FS mode: ${err.message}`);
        }
      }

      if (!this.redisAvailable && this.isWorkerRunning) {
        try {
          const files = await fs.promises.readdir(this.queueDir);
          const jsonFiles = files.filter(f => f.endsWith(".json"));
          if (jsonFiles.length > 0) {
            const nextFile = jsonFiles[0];
            const filePath = path.join(this.queueDir, nextFile);
            const content = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
            jobId = content.jobId;
            await fs.promises.unlink(filePath);
          }
        } catch (err) {
          console.error("[WorkflowEngine] File queue polling failed:", err);
        }

        if (!jobId) {
          await new Promise(res => setTimeout(res, 100));
        }
      }

      if (jobId) {
        const job = await this.getJob(jobId);
        if (job && (job.status === "pending" || job.status === "running")) {
          await this._executeJobSteps(job);
        }
      }
    }
  }

  async _executeJobSteps(job) {
    job.status = "running";
    await this.saveJobState(job);

    try {
      while (job.status === "running") {
        switch (job.current_step) {
          case "PARSE_REQUEST":
            await this.stepParseRequest(job);
            break;
          case "PLAN_EXECUTION":
            await this.stepPlanExecution(job);
            break;
          case "EXECUTE_TOOL_CALLS":
            await this.stepExecuteToolCalls(job);
            break;
          case "GENERATE_RESPONSE":
            await this.stepGenerateResponse(job);
            break;
          case "PERSIST_MEMORY":
            await this.stepPersistMemory(job);
            break;
          case "COMPLETED":
            job.status = "completed";
            await this.saveJobState(job);
            break;
          default:
            throw new Error(`Unknown step ${job.current_step}`);
        }
      }
    } catch (err) {
      console.error(`[WorkflowEngine] Error running job ${job.job_id}:`, err);
      job.retry_count = (job.retry_count || 0) + 1;

      if (job.retry_count <= 3) {
        console.log(`[WorkflowEngine] Retrying job ${job.job_id} asynchronously (attempt ${job.retry_count}/3)`);
        job.status = "pending";
        job.error = err.message;
        await this.saveJobState(job);
        setTimeout(() => this.enqueueJob(job), 1000 * job.retry_count);
      } else {
        job.status = "failed";
        job.error = err.message;
        await this.saveJobState(job);
        this._notifyDeferred(job.job_id, job);
      }
    }
  }

  async stepParseRequest(job) {
    const { task } = job.checkpoint_data;
    if (!task) {
      throw new Error("Invalid request payload: task is required");
    }
    job.current_step = "PLAN_EXECUTION";
    await this.saveJobState(job);
  }

  async stepPlanExecution(job) {
    const { task, requestId } = job.checkpoint_data;

    await this.orchestrator.ready();

    const classification = classifyTask(task);
    const policy = enforcePolicy(task, { confirmed: job.checkpoint_data.budget?.confirmation === true });

    if (!policy.allowed) {
      job.status = "failed";
      job.error = "POLICY_BLOCKED";
      job.checkpoint_data.result = {
        ok: false,
        error: "POLICY_BLOCKED",
        policy,
        classification
      };
      await this.saveJobState(job);
      this._notifyDeferred(job.job_id, job);
      return;
    }

    const plan = createExecutionPlan(task);
    this.orchestrator.memory.indexTaskMetadata(requestId, {
      requestId,
      domain: String(task.domain || "general").toLowerCase(),
      risk: String(task.risk || "MEDIUM").toUpperCase(),
      description: String(task.description || ""),
      planSteps: plan.length
    });

    const taskClass = String(task?.taskClass || task?.class || task?.domain || "general").toLowerCase();
    const workflowId = String(task?.workflowId || `workflow:${taskClass}`);
    const objectiveId = String(task?.objectiveId || `objective:${taskClass}`);
    const recentVolume = Number(this.orchestrator.taskClassCounts.get(taskClass) || 0) + 1;
    this.orchestrator.taskClassCounts.set(taskClass, recentVolume);

    const modelTierDecision = resolveModelTierForStep({
      stepType: "routing",
      risk: task?.risk,
      confidenceScore: task?.confidenceScore
    });

    const tokenForecast = this.orchestrator.tokenForecaster.forecast({
      stepType: "routing",
      risk: task?.risk,
      modelTier: modelTierDecision.tier,
      objective: objectiveId
    });

    const budgetDecision = this.orchestrator.tokenBudgetAllocator.allocate({
      tier: modelTierDecision.tier,
      requestId,
      workflowId,
      objectiveId,
      requestedTokens: tokenForecast.predictedTokens
    });

    const downgradeDecision = this.orchestrator.downgradePolicy.evaluate({
      taskClass,
      risk: task?.risk,
      currentTier: budgetDecision.effectiveTier,
      recentVolume
    });

    job.checkpoint_data.classification = classification;
    job.checkpoint_data.policy = policy;
    job.checkpoint_data.plan = plan;
    job.checkpoint_data.budgetDecision = budgetDecision;
    job.checkpoint_data.modelTierDecision = modelTierDecision;
    job.checkpoint_data.tokenForecast = tokenForecast;
    job.checkpoint_data.downgradeDecision = downgradeDecision;
    job.checkpoint_data.taskClass = taskClass;
    job.checkpoint_data.recentVolume = recentVolume;

    job.current_step = "EXECUTE_TOOL_CALLS";
    await this.saveJobState(job);
  }

  async stepExecuteToolCalls(job) {
    const { task, budget, classification, budgetDecision, downgradeDecision } = job.checkpoint_data;

    const learningSnapshot = this.orchestrator.learning.getSnapshot();
    const activeWeights = this.orchestrator.weightTuner ? this.orchestrator.weightTuner.getWeights() : this.orchestrator.scoringWeights;

    const routingBudget = resolveRoutingBudget({
      budget,
      budgetDecision,
      downgradeDecision
    });

    const effectiveBudget = {
      ...(budget || {}),
      tokenBudgetTier: routingBudget.tokenBudgetTier,
      latencyBudgetTier: routingBudget.latencyBudgetTier,
      budgetStrategyApplied: routingBudget.strategy
    };

    let route;
    if (classification.isCompound) {
      const compoundRoute = routeCompoundTask({
        task: { ...task, domain: task.domain || classification.primaryDomain },
        registry: this.orchestrator.capabilityRegistry,
        budget: effectiveBudget,
        learningStats: learningSnapshot,
        scoringWeights: activeWeights
      });
      route = compoundRoute.routes[0]?.route || routeTask({
        task: { ...task, domain: classification.primaryDomain },
        registry: this.orchestrator.capabilityRegistry,
        budget: effectiveBudget,
        learningStats: learningSnapshot,
        scoringWeights: activeWeights
      });
    } else {
      route = routeTask({
        task: { ...task, domain: task.domain || classification.primaryDomain },
        registry: this.orchestrator.capabilityRegistry,
        budget: effectiveBudget,
        learningStats: learningSnapshot,
        scoringWeights: activeWeights
      });
    }

    if (!route.selected) {
      job.status = "failed";
      job.error = "NO_ELIGIBLE_AGENT";
      job.checkpoint_data.result = {
        ok: false,
        error: "NO_ELIGIBLE_AGENT",
        route,
        classification
      };
      await this.saveJobState(job);
      this._notifyDeferred(job.job_id, job);
      return;
    }

    const subsetDryRun = runSkillSubsetDryRun({
      agentId: route.selected.id,
      task,
      exceptionRegistry: this.orchestrator.exceptionRegistry,
      nowMs: Date.now()
    });

    if (!subsetDryRun.allowed) {
      job.status = "failed";
      job.error = "SKILL_POLICY_BLOCKED";
      job.checkpoint_data.result = {
        ok: false,
        error: "SKILL_POLICY_BLOCKED",
        route,
        classification,
        policy: subsetDryRun.policy
      };
      await this.saveJobState(job);
      this._notifyDeferred(job.job_id, job);
      return;
    }

    job.checkpoint_data.route = route;
    job.checkpoint_data.subsetDryRun = subsetDryRun;

    job.current_step = "GENERATE_RESPONSE";
    await this.saveJobState(job);
  }

  async stepGenerateResponse(job) {
    const { task, route, executionEvidence, budgetDecision, downgradeDecision } = job.checkpoint_data;

    let verification = null;
    const hasEvidence = !!executionEvidence;

    if (!hasEvidence) {
      verification = {
        pass: true,
        findings: [],
        gateResults: { blockingCount: 0, advisoryCount: 0, totalFindings: 0 },
        routingOnly: true
      };
    } else {
      verification = verifyExecution(executionEvidence);
    }

    if (hasEvidence) {
      this.orchestrator.learning.recordOutcome(route.selected.id, {
        success: verification.pass,
        latencyMs: executionEvidence?.latencyMs || 0,
        tokenUsage: executionEvidence?.tokenUsage || 0
      });

      if (this.orchestrator.weightTuner) {
        this.orchestrator.weightTuner.observe({
          success: verification.pass,
          latencyMs: executionEvidence?.latencyMs || 0,
          tokenUsage: executionEvidence?.tokenUsage || 0
        });
      }
    }

    await this.orchestrator.persistState();

    const qualityScore = (hasEvidence && typeof executionEvidence?.qualityScore === "number") ? executionEvidence.qualityScore : 1.0;
    const costQualityDecision = optimizeCostQuality({
      risk: task?.risk,
      qualityScore,
      verificationPass: verification.pass,
      currentTier: budgetDecision.effectiveTier,
      predictedTokens: job.checkpoint_data.tokenForecast?.predictedTokens || 1000,
      downgradeDecision
    });

    const premiumFallback = {
      trigger: false,
      reason: "none",
      recommendedBudgetTier: costQualityDecision.recommendedTier || route.appliedBudget?.tokenBudgetTier || "MEDIUM"
    };

    if (hasEvidence) {
      if (!verification.pass) {
        premiumFallback.trigger = true;
        premiumFallback.reason = "verification_failed";
        premiumFallback.recommendedBudgetTier = "HIGH";
      } else if (qualityScore < 0.85) {
        premiumFallback.trigger = true;
        premiumFallback.reason = "low_quality";
        premiumFallback.recommendedBudgetTier = "MEDIUM";
      } else if (costQualityDecision.escalationTriggered) {
        premiumFallback.trigger = true;
        premiumFallback.reason = "risk_escalation";
        premiumFallback.recommendedBudgetTier = "HIGH";
      }
    }

    const result = {
      selectedSpecialist: route.selected.id,
      fallbackChain: route.fallbackChain || [],
      routeScores: route.scores || [],
      routingConfidence: route.routingConfidence ?? 1.0,
      needsClarification: route.needsClarification ?? false,
      classification: job.checkpoint_data.classification || null,
      compoundRoute: null,
      verification: verification || null,
      lifecycleState: "COMPLETED",
      trace: [],
      plan: job.checkpoint_data.plan || [],
      recoveryPlan: null,
      fallbackSelection: { specialistId: null, reason: "none" },
      orientedContext: [],
      premiumFallback,
      relationshipShadowSummary: this.orchestrator.relationshipShadowTracker ? this.orchestrator.relationshipShadowTracker.summary() : {
        totalSamples: 0,
        mismatches: 0,
        mismatchRate: 0,
        byMismatchType: {}
      },
      modelTierDecision: job.checkpoint_data.modelTierDecision || null,
      tokenForecast: job.checkpoint_data.tokenForecast || null,
      budgetDecision: job.checkpoint_data.budgetDecision || null,
      downgradeDecision: job.checkpoint_data.downgradeDecision || null,
      costQualityDecision: costQualityDecision || null,
      responseCacheContextHash: null,
      spendAttribution: null,
      activeWeights: this.orchestrator.weightTuner ? this.orchestrator.weightTuner.getWeights() : this.orchestrator.scoringWeights,
      rollingMetrics: this.orchestrator.weightTuner ? this.orchestrator.weightTuner.getRollingMetrics() : null,
      localDeployment: null,
      ok: verification.pass,
      error: verification.pass ? null : "VERIFICATION_FAILED"
    };

    job.checkpoint_data.result = result;
    job.current_step = "PERSIST_MEMORY";
    await this.saveJobState(job);
  }

  async stepPersistMemory(job) {
    const { task, result, executionEvidence } = job.checkpoint_data;

    this.memoryService.recordInteraction(job.job_id, task, result, executionEvidence);

    job.current_step = "COMPLETED";
    job.status = "completed";
    await this.saveJobState(job);

    this._notifyDeferred(job.job_id, job);
  }

  waitForJob(jobId, timeoutMs = 5000) {
    const existing = this.jobPromises.get(jobId);
    if (existing) return existing.promise;

    let resolveFn, rejectFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    const timeout = setTimeout(() => {
      this.jobPromises.delete(jobId);
      resolveFn({ job_id: jobId, status: "running", timeout: true });
    }, timeoutMs);

    this.jobPromises.set(jobId, { promise, resolveFn, rejectFn, timeout });
    return promise;
  }

  _notifyDeferred(jobId, job) {
    const deferred = this.jobPromises.get(jobId);
    if (deferred) {
      clearTimeout(deferred.timeout);
      this.jobPromises.delete(jobId);
      deferred.resolveFn(job);
    }
  }
}
