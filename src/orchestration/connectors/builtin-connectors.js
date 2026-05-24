import { createConnectorDefinition } from "./connector-contract.js";

export const BUILTIN_CONNECTORS = Object.freeze([
  createConnectorDefinition({
    id: "github",
    name: "GitHub",
    version: "1.0.0",
    auth: { type: "oauth2", scopes: ["repo", "read:org"] },
    quotas: { rateLimitPerMinute: 600 },
    health: { timeoutMs: 3000 },
    cost: { unitCostUsd: 0.0012, billingUnit: "call" },
    audit: { fields: ["tenantId", "repo", "action", "actor"] },
    actions: {
      getRepo: { mode: "read", requiresApproval: false },
      getWorkflowStatus: { mode: "read", requiresApproval: false },
      triggerWorkflow: { mode: "write", requiresApproval: true }
    }
  }),
  createConnectorDefinition({
    id: "jira",
    name: "Jira",
    version: "1.0.0",
    auth: { type: "oauth2", scopes: ["read:jira-work", "write:jira-work"] },
    quotas: { rateLimitPerMinute: 300 },
    health: { timeoutMs: 3000 },
    cost: { unitCostUsd: 0.0009, billingUnit: "call" },
    audit: { fields: ["tenantId", "project", "issue", "action"] },
    actions: {
      getIssue: { mode: "read", requiresApproval: false },
      transitionIssue: { mode: "write", requiresApproval: true },
      addComment: { mode: "write", requiresApproval: true }
    }
  }),
  createConnectorDefinition({
    id: "slack",
    name: "Slack",
    version: "1.0.0",
    auth: { type: "oauth2", scopes: ["chat:write", "channels:read"] },
    quotas: { rateLimitPerMinute: 240 },
    health: { timeoutMs: 3000 },
    cost: { unitCostUsd: 0.0004, billingUnit: "call" },
    audit: { fields: ["tenantId", "channel", "action", "messageId"] },
    actions: {
      postMessage: { mode: "write", requiresApproval: true },
      createApprovalRequest: { mode: "write", requiresApproval: true },
      getChannelInfo: { mode: "read", requiresApproval: false }
    }
  }),
  createConnectorDefinition({
    id: "kubernetes",
    name: "Kubernetes",
    version: "1.0.0",
    auth: { type: "service-account", scopes: ["cluster:read", "cluster:write"] },
    quotas: { rateLimitPerMinute: 200 },
    health: { timeoutMs: 5000 },
    cost: { unitCostUsd: 0.0015, billingUnit: "call" },
    audit: { fields: ["tenantId", "cluster", "namespace", "action"] },
    actions: {
      getRolloutStatus: { mode: "read", requiresApproval: false },
      getHealth: { mode: "read", requiresApproval: false },
      restartDeployment: { mode: "write", requiresApproval: true }
    }
  }),
  createConnectorDefinition({
    id: "cloud-cost",
    name: "Cloud Cost",
    version: "1.0.0",
    auth: { type: "api-key", scopes: ["billing:read"] },
    quotas: { rateLimitPerMinute: 120 },
    health: { timeoutMs: 4000 },
    cost: { unitCostUsd: 0.0003, billingUnit: "query" },
    audit: { fields: ["tenantId", "provider", "timeWindow", "action"] },
    actions: {
      getAwsCostSlice: { mode: "read", requiresApproval: false },
      getAzureCostSlice: { mode: "read", requiresApproval: false }
    }
  })
]);
