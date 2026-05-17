/**
 * Starts the AIEP Router Knowledge MCP server standalone.
 * Usage: node scripts/start-mcp-server.js
 */
import { createMcpServer } from "../src/mcp/router-knowledge-mcp-server.js";

const mcp = createMcpServer();

process.on("SIGINT", async () => {
  console.log("\n[MCP] Shutting down...");
  await mcp.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await mcp.stop();
  process.exit(0);
});

await mcp.start();
