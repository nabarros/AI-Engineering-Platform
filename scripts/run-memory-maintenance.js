#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { runMemoryMaintenance } from "../src/orchestration/index.js";

function loadMaintenanceInput(inputArg) {
  if (!inputArg) {
    return null;
  }

  const absolutePath = path.resolve(process.cwd(), inputArg);
  let raw = null;

  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
    raw = fs.readFileSync(absolutePath, "utf8");
  } else {
    raw = inputArg;
  }

  return JSON.parse(raw);
}

function main() {
  const inputPath = process.argv[2];
  const input = loadMaintenanceInput(inputPath);
  const summary = runMemoryMaintenance(input);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();