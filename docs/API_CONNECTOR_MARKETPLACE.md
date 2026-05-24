# Connector Marketplace (Mitigation Baseline)

This catalog defines the initial production-grade connector baseline for AIEP orchestration.

## Support Tiers

| Tier | Description | Operational Requirement |
|---|---|---|
| Tier 1 | Production connector with policy enforcement | Health checks, audit fields, tenant policy, retries |
| Tier 2 | Pilot connector | Read-only paths and sandbox coverage |
| Tier 3 | Experimental | Local development use only |

## Production Connectors

| Connector ID | Domain | Default Mode | Key Actions | Auth | Notes |
|---|---|---|---|---|---|
| github | DevEx | mixed | getRepo, getWorkflowStatus, triggerWorkflow | OAuth2 | Write action requires approval |
| jira | DevEx | mixed | getIssue, transitionIssue, addComment | OAuth2 | Retry and circuit-breaker ready |
| slack | Communications | mixed | postMessage, createApprovalRequest, getChannelInfo | OAuth2 | Supports approval ack workflows |
| kubernetes | Operations | read-first | getRolloutStatus, getHealth, restartDeployment | Service Account | Controlled write path |
| cloud-cost | FinOps | read | getAwsCostSlice, getAzureCostSlice | API Key | Spend normalization source |

## Contract and Runtime References

- Contract: src/orchestration/connectors/connector-contract.js
- Registry: src/orchestration/connectors/connector-registry.js
- Policy engine: src/orchestration/connectors/connector-policy-engine.js
- Sandbox: src/orchestration/connectors/connector-sandbox.js
- Built-ins: src/orchestration/connectors/builtin-connectors.js

## KPI Baseline Targets

- Registry lookup p95 under 50ms in local benchmark.
- Zero unauthorized connector actions in staging policy audits.
- Connector integration test flakiness under 2%.
- Time-to-first-connector under 30 minutes.
