import { startOrchestrationServer } from "../src/api/orchestration-server.js";

const portArg = process.argv[2] ? Number(process.argv[2]) : undefined;

const runtime = await startOrchestrationServer({ port: portArg });

console.log(`Orchestration API listening on http://${runtime.host}:${runtime.port}`);
console.log(`State file: ${runtime.stateFilePath}`);

process.on("SIGINT", async () => {
  await runtime.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await runtime.close();
  process.exit(0);
});
