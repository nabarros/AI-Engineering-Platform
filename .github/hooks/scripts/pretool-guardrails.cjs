#!/usr/bin/env node

const fs = require('node:fs');

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function flattenStrings(value, out) {
  if (value == null) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, out);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) flattenStrings(v, out);
  }
}

function getToolName(payload) {
  return (
    payload?.toolName ||
    payload?.tool?.name ||
    payload?.toolInvocation?.name ||
    payload?.hookInput?.toolName ||
    ''
  );
}

function getToolInput(payload) {
  return (
    payload?.toolInput ||
    payload?.tool?.input ||
    payload?.toolInvocation?.input ||
    payload?.hookInput?.toolInput ||
    {}
  );
}

function decisionAllow() {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'No guardrail violation detected.'
    }
  };
}

function decisionAsk(reason, message) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason
    },
    systemMessage: message
  };
}

function decisionDeny(reason, message) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    },
    systemMessage: message
  };
}

const raw = readStdin();
const payload = safeParseJson(raw);
const toolName = String(getToolName(payload));
const toolInput = getToolInput(payload);

const textValues = [];
flattenStrings(toolInput, textValues);
const haystack = textValues.join('\n').toLowerCase();

const writeToolHints = ['edit', 'create', 'apply_patch', 'rename', 'delete', 'write'];
const isPotentialWriteTool = writeToolHints.some((hint) => toolName.toLowerCase().includes(hint));

const restrictedTargets = [
  '/.ai/instructions/',
  '/.ai/security/',
  '/.github/workflows/',
  '/infra/',
  '/docs/security_rules.md',
  '/docs/ai_agent_rules.md'
];

const hitsRestricted = restrictedTargets.some((target) => haystack.includes(target));
if (isPotentialWriteTool && hitsRestricted) {
  process.stdout.write(
    JSON.stringify(
      decisionDeny(
        'Attempted write against restricted path.',
        'Blocked by AIEP guardrails: write operations to restricted governance/security/infra paths are not allowed.'
      )
    )
  );
  process.exit(0);
}

const memoryTarget = '/.ai/memory/';
if (isPotentialWriteTool && haystack.includes(memoryTarget)) {
  process.stdout.write(
    JSON.stringify(
      decisionAsk(
        'Memory file write requires explicit human confirmation.',
        'AIEP memory guardrail: confirm this .ai/memory write before continuing.'
      )
    )
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify(decisionAllow()));
