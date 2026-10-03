#!/usr/bin/env bash
# One chat flow through the shell: register, sign in, create a chat, send a message and read
# the streamed answer. Used to check the compose profiles of the mock server (AICHAT-144):
#   profile llm           the answer comes from conversation-service, whose provider is the mock
#   profile frontend-only the answer comes from the backend mock
# Usage: scripts/ci/mock-chat-smoke.sh [scenario]   (default: ok; env BASE=http://localhost:8000)
set -euo pipefail

BASE="${BASE:-http://localhost:8000}"
SCENARIO="${1:-ok}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
EMAIL="smoke.$(date +%s)@mock.test"
PASSWORD="Smoke1234pass"
json=(-H 'content-type: application/json')

echo "== register and sign in as $EMAIL"
curl -fsS "${json[@]}" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE/auth/register" >/dev/null || true
curl -fsS -c "$JAR" "${json[@]}" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE/auth/login"; echo

echo "== create a chat (model claude-sonnet-4-5@$SCENARIO)"
CHAT="$(curl -fsS -b "$JAR" "${json[@]}" -d "{\"title\":\"Smoke\",\"provider\":\"anthropic\",\"model\":\"claude-sonnet-4-5@$SCENARIO\"}" "$BASE/api/chats")"
echo "$CHAT"
ID="$(printf '%s' "$CHAT" | sed -E 's/.*"chat":\{"id":"([^"]+)".*/\1/')"

echo "== open the stream and send a message"
STREAM="$(mktemp)"
curl -sS -N -m 8 -b "$JAR" "$BASE/api/chats/$ID/stream" >"$STREAM" 2>/dev/null &
sleep 1
curl -fsS -b "$JAR" "${json[@]}" -H 'X-Llm-Api-Key: mock-key' -H "X-Mock-Scenario: $SCENARIO" \
  -d '{"content":"Say hello"}' "$BASE/api/chats/$ID/messages"; echo
wait || true

echo "== stream events"
grep '^data:' "$STREAM" | cut -c1-160 | head -12
echo "..."
grep -c '"type":"token"' "$STREAM" | sed 's/^/token events: /'
grep -q '"type":"done"' "$STREAM" && echo "done event received"
rm -f "$STREAM"
