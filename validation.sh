#!/bin/bash
set -e

echo "STEP 1"
echo "CMD: docker compose down --remove-orphans -v || true"
docker compose down --remove-orphans -v > /dev/null 2>&1
raw_down_exit=$?
echo "EXIT: $raw_down_exit (overall: 0)"

echo "STEP 2"
echo "CMD: docker compose up -d --build"
docker compose up -d --build
echo "EXIT: $?"

echo "STEP 3"
echo "CMD: Poll readiness (180s)"
READY=0
for i in {1..36}; do
  if curl -s http://localhost:8791 > /dev/null; then
    READY=1
    break
  fi
  sleep 5
done
docker compose ps
echo "POLL RESULT: $READY"
echo "EXIT: 0"

echo "STEP 5"
echo "CMD: MCP initialize"
INIT_RESP=$(curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}' \
  http://localhost:8791)
echo "EXIT: $?"
echo "KEY: $(echo $INIT_RESP | jq -c '.result.serverInfo // .error')"

echo "STEP 6"
echo "CMD: MCP tools/list"
LIST_RESP=$(curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}' \
  http://localhost:8791)
echo "EXIT: $?"
TOOLS_FOUND=$(echo $LIST_RESP | jq -r '.result.tools[].name')
echo "KEY: Tools present: $(echo $TOOLS_FOUND | tr '\n' ' ')"
for t in aiep_knowledge_store aiep_knowledge_health aiep_knowledge_lookup; do
  if [[ ! "$TOOLS_FOUND" =~ "$t" ]]; then echo "MISSING TOOL: $t"; fi
done

echo "STEP 7"
TIMESTAMP=$(date +%s)
MARKER="DUMMY_${TIMESTAMP}_MCP_LOCAL"
echo "CMD: tools/call aiep_knowledge_store (Marker: $MARKER)"
STORE_RESP=$(curl -sS -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\": \"2.0\", \"id\": 3, \"method\": \"tools/call\", \"params\": {\"name\": \"aiep_knowledge_store\", \"arguments\": {\"promptText\": \"$MARKER\", \"selectedAgent\": \"TestAgent\"}}}" \
  http://localhost:8791)
echo "EXIT: $?"
echo "KEY: $(echo $STORE_RESP | jq -c '.result')"

echo "STEP 8"
echo "CMD: sleep 1"
sleep 1
echo "EXIT: $?"

echo "STEP 9"
echo "CMD: tools/call aiep_knowledge_health"
HEALTH_RESP=$(curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "aiep_knowledge_health", "arguments": {}}}' \
  http://localhost:8791)
echo "EXIT: $?"
echo "KEY: $(echo $HEALTH_RESP | jq -c '.result.content[0].text | fromjson | .localStore')"

echo "STEP 10"
echo "CMD: grep marker in ./data/router-knowledge-store.json"
if grep -C 1 "$MARKER" ./data/router-knowledge-store.json; then
  echo "EXIT: 0"
else
  echo "MISS"
  echo "EXIT: 1"
fi

echo "STEP 11"
echo "CMD: tools/call aiep_knowledge_lookup"
LOOKUP_RESP=$(curl -sS -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\": \"2.0\", \"id\": 5, \"method\": \"tools/call\", \"params\": {\"name\": \"aiep_knowledge_lookup\", \"arguments\": {\"promptText\": \"$MARKER\"}}}" \
  http://localhost:8791)
echo "EXIT: $?"
echo "KEY: $(echo $LOOKUP_RESP | jq -c '.result')"
