import { startSharedStateService } from "../src/api/shared-state-service.js";

const portArg = process.argv[2] ? Number(process.argv[2]) : undefined;
const hostArg = process.argv[3] || process.env.ORCHESTRATION_STATE_HOST || "0.0.0.0";

const runtime = await startSharedStateService({ port: portArg, host: hostArg });

console.log(`Shared state service listening on http://${runtime.host}:${runtime.port}`);
console.log(`State file: ${runtime.stateFilePath}`);

process.on("SIGINT", async () => {
  await runtime.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await runtime.close();
  process.exit(0);
});
