import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class MemoryService {
  constructor(options = {}) {
    this.memoryDir = options.memoryDir || path.join(process.cwd(), "data", "memory");
    this.snapshotsDir = path.join(this.memoryDir, "snapshots");
    this.reportsDir = path.join(this.memoryDir, "reports");
    this.weaviateClient = options.weaviateClient || null;

    // Ensure directories exist
    fs.mkdirSync(this.snapshotsDir, { recursive: true });
    fs.mkdirSync(this.reportsDir, { recursive: true });
  }

  async saveSnapshot(sessionId, snapshot) {
    const filePath = path.join(this.snapshotsDir, `${sessionId}.json`);
    await this._writeWithRetry(filePath, JSON.stringify(snapshot, null, 2));
  }

  async appendContextReport(sessionId, report) {
    const filePath = path.join(this.reportsDir, `${sessionId}.jsonl`);
    const line = JSON.stringify(report) + "\n";
    await this._appendWithRetry(filePath, line);
  }

  async getSnapshot(sessionId) {
    const filePath = path.join(this.snapshotsDir, `${sessionId}.json`);
    if (!fs.existsSync(filePath)) {
      return {
        session_id: sessionId,
        active_goal: "",
        current_topic: "",
        user_intent: "",
        open_tasks: [],
        decisions: [],
        summary: ""
      };
    }
    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  }

  async getContextReports(sessionId) {
    const filePath = path.join(this.reportsDir, `${sessionId}.jsonl`);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = await fs.promises.readFile(filePath, "utf8");
    return raw.split("\n").filter(Boolean).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  recordInteraction(sessionId, task, result, executionEvidence) {
    this._recordInteractionAsync(sessionId, task, result, executionEvidence).catch(err => {
      console.error(`[MemoryService] Background interaction recording failed for session ${sessionId}:`, err);
    });
  }

  async _recordInteractionAsync(sessionId, task, result, executionEvidence) {
    const timestamp = new Date().toISOString();
    const interactionId = crypto.randomUUID();

    const snapshot = await this.getSnapshot(sessionId);
    const reports = await this.getContextReports(sessionId);
    const interactionIndex = reports.length + 1;

    const userIntent = task?.description || task?.objective || "Unknown intent";
    const assistantAction = result?.selectedSpecialist || (result?.ok ? "Delegated request" : "Blocked request");

    const decisions = [];
    if (result?.selectedSpecialist) {
      decisions.push(`Selected specialist agent: ${result.selectedSpecialist}`);
    }
    if (result?.classification?.primaryDomain) {
      decisions.push(`Classified task domain as: ${result.classification.primaryDomain}`);
    }
    if (result?.budgetDecision?.effectiveTier) {
      decisions.push(`Allocated token budget tier: ${result.budgetDecision.effectiveTier}`);
    }
    if (result?.error) {
      decisions.push(`Execution outcome failed with error: ${result.error}`);
    }

    const tasksCreated = [];
    if (result?.selectedSpecialist) {
      tasksCreated.push(`Execute ${result.selectedSpecialist} task`);
    }

    let importanceScore = 5;
    const risk = String(task?.risk || "MEDIUM").toUpperCase();
    if (risk === "CRITICAL" || risk === "HIGH") {
      importanceScore = 8 + Math.floor(Math.random() * 3);
    } else if (risk === "LOW") {
      importanceScore = 1 + Math.floor(Math.random() * 4);
    }

    const summary = result?.ok
      ? `Successfully routed and executed '${userIntent.slice(0, 50)}...' task using ${assistantAction}.`
      : `Failed executing task: ${result?.error || "unknown error"}`;

    const report = {
      id: interactionId,
      session_id: sessionId,
      timestamp,
      interaction_index: interactionIndex,
      summary,
      user_intent: userIntent,
      assistant_action: assistantAction,
      decisions,
      new_facts: result?.newFacts || [],
      tasks_created: tasksCreated,
      importance_score: importanceScore,
      metadata: {
        requestId: result?.requestId || task?.requestId || null,
        qualityScore: executionEvidence?.qualityScore || null,
        tokenUsage: executionEvidence?.tokenUsage || null,
        latencyMs: executionEvidence?.latencyMs || null
      }
    };

    snapshot.active_goal = task?.objective || task?.description || snapshot.active_goal;
    snapshot.current_topic = result?.classification?.primaryDomain || snapshot.current_topic;
    snapshot.user_intent = userIntent;
    snapshot.summary = summary;

    if (result?.ok) {
      snapshot.open_tasks = (snapshot.open_tasks || []).filter(t => t !== userIntent);
    } else {
      if (!snapshot.open_tasks) snapshot.open_tasks = [];
      if (!snapshot.open_tasks.includes(userIntent)) {
        snapshot.open_tasks.push(userIntent);
      }
    }

    snapshot.decisions = [...(snapshot.decisions || []), ...decisions].slice(-10);

    await Promise.all([
      this.saveSnapshot(sessionId, snapshot),
      this.appendContextReport(sessionId, report)
    ]);

    if (this.weaviateClient && typeof this.weaviateClient.index === "function") {
      try {
        await this.weaviateClient.index("ContextReport", interactionId, {
          sessionId,
          summary,
          userIntent,
          assistantAction,
          timestamp
        });
      } catch (err) {
        console.warn(`[MemoryService] Optional Weaviate indexing failed: ${err.message}`);
      }
    }
  }

  async _writeWithRetry(filePath, content, retries = 3, delay = 100) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await fs.promises.writeFile(filePath, content, "utf8");
        return;
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise(res => setTimeout(res, delay * attempt));
      }
    }
  }

  async _appendWithRetry(filePath, content, retries = 3, delay = 100) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await fs.promises.appendFile(filePath, content, "utf8");
        return;
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise(res => setTimeout(res, delay * attempt));
      }
    }
  }
}
