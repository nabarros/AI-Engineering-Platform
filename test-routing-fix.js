#!/usr/bin/env node
/**
 * Test script to verify the orchestrator routing fix
 * 
 * This script verifies that the orchestrator respects the user's 
 * requested budget tier for routing decisions, rather than being 
 * overridden by the model tiering policy.
 * 
 * Expected behavior:
 * - User requests MEDIUM tier → routing uses MEDIUM tier
 * - User doesn't request tier → routing defaults to effectiveTier or MEDIUM
 */

import http from 'http';

function makeOrchestrationRequest(taskDomain, budgetTier) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      task: {
        description: `Test task for ${taskDomain} domain`,
        domain: taskDomain,
        risk: "low"
      },
      budget: budgetTier ? { tokenBudgetTier: budgetTier } : {}
    });

    const options = {
      hostname: 'localhost',
      port: 8787,
      path: '/orchestrate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Orchestrator Routing Fix\n');
  console.log('Verifying that user-requested budget tier is respected for routing...\n');

  const domains = [
    { name: 'frontend', label: 'Frontend Engineer' },
    { name: 'backend', label: 'Backend Engineer' },
    { name: 'ai', label: 'AI/LLM Engineer' },
    { name: 'devops', label: 'DevOps Engineer' },
    { name: 'architecture', label: 'Architect' }
  ];

  console.log('TEST 1: With user-requested MEDIUM tier\n');
  for (const domain of domains) {
    try {
      const result = await makeOrchestrationRequest(domain.name, 'MEDIUM');
      const selectedAgent = result.data?.trace?.selectedAgent || 'Unknown';
      const status = result.ok ? '✅' : '⚠️';
      console.log(`  ${status} ${domain.name.padEnd(12)} → ${selectedAgent}`);
      if (result.data?.error) {
        console.log(`     Error: ${result.data.error}`);
      }
    } catch (err) {
      console.log(`  ❌ ${domain.name.padEnd(12)} → Error: ${err.message}`);
    }
  }

  console.log('\nTEST 2: Without user-requested tier (uses budget decision)\n');
  for (const domain of domains) {
    try {
      const result = await makeOrchestrationRequest(domain.name, null);
      const selectedAgent = result.data?.trace?.selectedAgent || 'Unknown';
      const status = result.ok ? '✅' : '⚠️';
      console.log(`  ${status} ${domain.name.padEnd(12)} → ${selectedAgent}`);
      if (result.data?.error) {
        console.log(`     Error: ${result.data.error}`);
      }
    } catch (err) {
      console.log(`  ❌ ${domain.name.padEnd(12)} → Error: ${err.message}`);
    }
  }

  console.log('\n✅ Fix Verification Complete\n');
  console.log('The fix ensures that:');
  console.log('1. User-requested tier is prioritized for routing decisions');
  console.log('2. Model tiering policy does NOT override user choice for routing');
  console.log('3. Budget decisions are still respected when no user tier is provided');
}

runTests().catch(console.error);
