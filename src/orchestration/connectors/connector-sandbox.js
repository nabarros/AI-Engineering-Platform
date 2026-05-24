function stableHash(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

export class ConnectorSandbox {
  constructor() {
    this.scenarios = new Map();
  }

  registerScenario(connectorId, action, handler) {
    const key = `${connectorId}:${action}`;
    this.scenarios.set(key, handler);
  }

  async simulate({ connectorId, action, payload = {} }) {
    const key = `${connectorId}:${action}`;
    if (this.scenarios.has(key)) {
      const result = await this.scenarios.get(key)(payload);
      return {
        simulated: true,
        connectorId,
        action,
        latencyMs: 5,
        result
      };
    }

    const seed = stableHash(`${connectorId}:${action}:${JSON.stringify(payload)}`);
    return {
      simulated: true,
      connectorId,
      action,
      latencyMs: 5 + (seed % 7),
      result: {
        status: "ok",
        seed,
        sample: {
          action,
          payloadShape: Object.keys(payload).sort()
        }
      }
    };
  }
}
