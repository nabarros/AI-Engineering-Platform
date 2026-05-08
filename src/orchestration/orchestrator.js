import { validateCapabilityRegistry } from "./capability-registry.js";
import { createExecutionPlan } from "./planner.js";
import { routeTask } from "./router.js";
import { enforcePolicy } from "./policy-engine.js";
import { verifyExecution } from "./verifier.js";
import { OrchestrationMemory } from "./memory-store.js";
import { TraceCollector } from "./tracer.js";
import { LearningLoop } from "./learning-loop.js";

export class AgentOrchestrator {
  constructor({ capabilityRegistry, stateStore = null, scoringWeights, weightTuner = null }) {
    validateCapabilityRegistry(capabilityRegistry);
    this.capabilityRegistry = capabilityRegistry;
    this.memory = new OrchestrationMemory();
    this.learning = new LearningLoop();
    this.stateStore = stateStore;
    this.scoringWeights = scoringWeights;
    this.weightTuner = weightTuner;
    this.initializationPromise = this.stateStore ? this.restoreState() : Promise.resolve();

  }

  async restoreState() {
    const state = await Promise.resolve(this.stateStore.load());
    if (!state) return;

    this.memory.importState(state.memory || {});
    this.learning.importState(state.learning || []);
    if (this.weightTuner && state.weightTuner) {
      this.weightTuner.importState(state.weightTuner);
    }
  }

  async ready() {
    await this.initializationPromise;
  }

  async persistState() {
    if (!this.stateStore) return;
    await Promise.resolve(this.stateStore.save({
      memory: this.memory.exportState(),
      learning: this.learning.exportState(),
      weightTuner: this.weightTuner ? this.weightTuner.exportState() : null,
      updatedAt: Date.now()
    }));
  }

  async processRequest({ requestId, task, budget, confirmation = false, executionEvidence }) {
    await this.initializationPromise;

    const tracer = new TraceCollector(requestId);
    tracer.addEvent("request.received", { domain: task.domain, risk: task.risk });

    const policy = enforcePolicy(task, { confirmed: confirmation });
    tracer.addEvent("policy.checked", { allowed: policy.allowed, risk: policy.risk, violations: policy.violations });

    if (!policy.allowed) {
      return {
        ok: false,
        error: "POLICY_BLOCKED",
        policy,
        trace: tracer.summary()
      };
    }

    const plan = createExecutionPlan(task);
    tracer.addEvent("plan.created", { steps: plan.length });

    const learningSnapshot = this.learning.getSnapshot();
    const activeWeights = this.weightTuner ? this.weightTuner.getWeights() : this.scoringWeights;
    const route = routeTask({
      task,
      registry: this.capabilityRegistry,
      budget,
      learningStats: learningSnapshot,
      scoringWeights: activeWeights
    });

    if (!route.selected) {
      return {
        ok: false,
        error: "NO_ELIGIBLE_AGENT",
        route,
        trace: tracer.summary()
      };
    }

    tracer.addEvent("route.selected", {
      selectedAgent: route.selected.id,
      fallbackUsed: false,
      fallbackChain: route.fallbackChain
    });

    this.memory.write("session", `${requestId}:plan`, plan, { ttlMs: 30 * 60 * 1000 });
    this.memory.write("patterns", `${task.domain}:last-selected-agent`, { agentId: route.selected.id }, { ttlMs: 24 * 60 * 60 * 1000 });

    const verification = verifyExecution(executionEvidence);
    tracer.addEvent("verification.completed", { pass: verification.pass, findingCount: verification.findings.length });

    this.learning.recordOutcome(route.selected.id, {
      success: verification.pass,
      latencyMs: executionEvidence?.latencyMs || 0,
      tokenUsage: executionEvidence?.tokenUsage || 0
    });

    if (this.weightTuner) {
      this.weightTuner.observe({
        success: verification.pass,
        latencyMs: executionEvidence?.latencyMs || 0,
        tokenUsage: executionEvidence?.tokenUsage || 0
      });
    }

    await this.persistState();

    return {
      ok: verification.pass,
      selectedAgent: route.selected.id,
      fallbackChain: route.fallbackChain,
      routeScores: route.scores,
      plan,
      verification,
      activeWeights,
      rollingMetrics: this.weightTuner ? this.weightTuner.getRollingMetrics() : null,
      learningSnapshot: this.learning.getSnapshot(),
      trace: tracer.summary()
    };
  }
}
