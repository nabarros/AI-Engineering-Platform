import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IndexedSharedStateStore, TenantStateStore } from "../../src/orchestration/persistence/indexed-shared-state-store.js";

test("should isolate tenant state in shared indexed store", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiep-shared-"));
  const shared = new IndexedSharedStateStore(path.join(tempDir, "shared-state.json"));

  const tenantA = new TenantStateStore(shared, "tenant-a");
  const tenantB = new TenantStateStore(shared, "tenant-b");

  tenantA.save({ memory: { session: [["k", { value: 1 }]] }, learning: [] });
  tenantB.save({ memory: { session: [["k", { value: 2 }]] }, learning: [] });

  const stateA = tenantA.load();
  const stateB = tenantB.load();

  assert.notDeepEqual(stateA, stateB);
  assert.deepEqual(shared.listNamespaces().sort(), ["tenant-a", "tenant-b"]);

  const summary = shared.getIndexSummary();
  assert.ok(summary.tenants["tenant-a"]);
  assert.ok(summary.tenants["tenant-b"]);
});
