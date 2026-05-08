import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSharedStateService } from "../../src/api/shared-state-service.js";
import { HttpSharedStateStore } from "../../src/orchestration/persistence/http-shared-state-store.js";

async function startServer(runtime) {
  await new Promise((resolve, reject) => {
    runtime.server.listen(0, "127.0.0.1", (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const address = runtime.server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("should persist and read state through shared state HTTP service", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiep-state-http-"));
  const runtime = createSharedStateService({
    stateFilePath: path.join(tempDir, "shared-state.json")
  });

  const baseUrl = await startServer(runtime);

  try {
    const client = new HttpSharedStateStore({ baseUrl });

    await client.saveNamespace("tenant-http", {
      memory: { session: [["key", { value: "ok" }]] },
      learning: []
    });

    const state = await client.loadNamespace("tenant-http");
    assert.ok(state);
    assert.equal(state.memory.session[0][0], "key");

    const index = await client.getIndexSummary();
    assert.ok(index.tenants["tenant-http"]);
  } finally {
    await runtime.close();
  }
});
