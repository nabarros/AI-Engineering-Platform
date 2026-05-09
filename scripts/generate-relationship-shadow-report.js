#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { buildRelationshipShadowReport } from "../src/orchestration/index.js";

function loadShadowSamples(inputArg) {
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

  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed?.samples)) {
    return parsed.samples;
  }

  throw new Error("Input JSON must be an array or an object containing a samples array.");
}

function getDefaultShadowSamples() {
  const nowMs = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return [
    {
      recordedAt: nowMs - 13 * day,
      task: { domain: "backend", description: "API and SQL feature work" },
      selectedSpecialist: "AIEP Senior Staff Backend Engineer",
      inferredSpecialist: "AIEP Senior Staff Backend Engineer",
      matches: true,
      mismatchType: "none"
    },
    {
      recordedAt: nowMs - 12 * day,
      task: { domain: "frontend", description: "React component implementation" },
      selectedSpecialist: "AIEP Senior Staff Backend Engineer",
      inferredSpecialist: "AIEP Senior Staff Frontend Engineer",
      matches: false,
      mismatchType: "specialist_mismatch"
    },
    {
      recordedAt: nowMs - 10 * day,
      task: { domain: "review", description: "Audit regression and verification" },
      selectedSpecialist: "AIEP Code Reviewer",
      inferredSpecialist: "AIEP Code Reviewer",
      matches: true,
      mismatchType: "none"
    },
    {
      recordedAt: nowMs - 8 * day,
      task: { domain: "sre", description: "Observability and latency incident" },
      selectedSpecialist: "AIEP Senior Staff SRE Engineer",
      inferredSpecialist: "AIEP Senior Staff SRE Engineer",
      matches: true,
      mismatchType: "none"
    },
    {
      recordedAt: nowMs - 6 * day,
      task: { domain: "frontend", description: "Accessibility and usability pass" },
      selectedSpecialist: "AIEP Senior Staff Frontend Engineer",
      inferredSpecialist: "AIEP Senior Staff UI/UX Engineer",
      matches: false,
      mismatchType: "specialist_mismatch"
    },
    {
      recordedAt: nowMs - 4 * day,
      task: { domain: "backend", description: "Service and database hardening" },
      selectedSpecialist: "AIEP Senior Staff Backend Engineer",
      inferredSpecialist: "AIEP Senior Staff Backend Engineer",
      matches: true,
      mismatchType: "none"
    },
    {
      recordedAt: nowMs - 2 * day,
      task: { domain: "review", description: "QA regression check" },
      selectedSpecialist: "AIEP Code Reviewer",
      inferredSpecialist: "AIEP Code Reviewer",
      matches: true,
      mismatchType: "none"
    },
    {
      recordedAt: nowMs - 1 * day,
      task: { domain: "backend", description: "Fastify route update" },
      selectedSpecialist: "AIEP Senior Staff Backend Engineer",
      inferredSpecialist: "AIEP Senior Staff Backend Engineer",
      matches: true,
      mismatchType: "none"
    }
  ];
}

function main() {
  const inputPath = process.argv[2];
  const samples = loadShadowSamples(inputPath) || getDefaultShadowSamples();
  const report = buildRelationshipShadowReport(samples, { windowDays: 14 });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();