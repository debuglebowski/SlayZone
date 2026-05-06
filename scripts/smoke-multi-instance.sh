#!/usr/bin/env bash
# Phase 0 smoke test: spawn two `pnpm dev` instances side-by-side with distinct
# SLAYZONE_STORE_DIR + SLAYZONE_MCP_PORT, then assert zero data crossover.
#
# Usage: scripts/smoke-multi-instance.sh
#
# Requires: pnpm dev to be runnable, lsof, sqlite3.

set -euo pipefail

WARMUP_SECS="${WARMUP_SECS:-45}"
DIR_A="${DIR_A:-/tmp/slayzone-smoke-a}"
DIR_B="${DIR_B:-/tmp/slayzone-smoke-b}"
PORT_A="${PORT_A:-4848}"
PORT_B="${PORT_B:-4849}"

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
log_a="$(mktemp -t slay-smoke-a.XXXXXX.log)"
log_b="$(mktemp -t slay-smoke-b.XXXXXX.log)"

cleanup() {
  echo
  echo "[smoke] cleaning up…"
  if [[ -n "${PID_A:-}" ]]; then
    pkill -P "$PID_A" 2>/dev/null || true
    kill "$PID_A" 2>/dev/null || true
  fi
  if [[ -n "${PID_B:-}" ]]; then
    pkill -P "$PID_B" 2>/dev/null || true
    kill "$PID_B" 2>/dev/null || true
  fi
  echo "[smoke] logs: $log_a / $log_b"
}
trap cleanup EXIT

rm -rf "$DIR_A" "$DIR_B"
mkdir -p "$DIR_A" "$DIR_B"

echo "[smoke] booting instance A → $DIR_A on :$PORT_A"
( cd "$repo_root" && SLAYZONE_STORE_DIR="$DIR_A" SLAYZONE_MCP_PORT="$PORT_A" pnpm dev >"$log_a" 2>&1 ) &
PID_A=$!

echo "[smoke] booting instance B → $DIR_B on :$PORT_B"
( cd "$repo_root" && SLAYZONE_STORE_DIR="$DIR_B" SLAYZONE_MCP_PORT="$PORT_B" pnpm dev >"$log_b" 2>&1 ) &
PID_B=$!

echo "[smoke] warmup ${WARMUP_SECS}s…"
sleep "$WARMUP_SECS"

fail=0

echo "[smoke] checking DBs…"
for d in "$DIR_A" "$DIR_B"; do
  db="$d/slayzone.dev.sqlite"
  if [[ ! -f "$db" ]]; then
    echo "  FAIL: $db not created"
    fail=1
  else
    echo "  ok: $db ($(stat -f%z "$db" 2>/dev/null || stat -c%s "$db") bytes)"
  fi
done

echo "[smoke] checking ports…"
for p in "$PORT_A" "$PORT_B"; do
  if ! lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  FAIL: nothing listening on :$p"
    fail=1
  else
    echo "  ok: :$p bound"
  fi
done

echo "[smoke] checking Extensions dir isolation…"
ls "$DIR_A/Extensions" >/dev/null 2>&1 && echo "  ok: A has Extensions/" || echo "  note: A has no Extensions/ yet (browser not loaded)"
ls "$DIR_B/Extensions" >/dev/null 2>&1 && echo "  ok: B has Extensions/" || echo "  note: B has no Extensions/ yet (browser not loaded)"

echo "[smoke] checking no shared files…"
if diff -q "$DIR_A/slayzone.dev.sqlite" "$DIR_B/slayzone.dev.sqlite" >/dev/null 2>&1; then
  echo "  FAIL: DBs identical — likely sharing a file"
  fail=1
else
  echo "  ok: DBs differ"
fi

if [[ $fail -ne 0 ]]; then
  echo "[smoke] FAILED — see logs at $log_a and $log_b"
  exit 1
fi

echo "[smoke] PASS"
