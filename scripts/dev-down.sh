#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run/showdown"
SERVER_PID_FILE="$RUN_DIR/server.pid"
CLIENT_PID_FILE="$RUN_DIR/client.pid"

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

stop_process() {
  local name="$1"
  local pid_file="$2"
  local pid

  if [[ ! -f "$pid_file" ]]; then
    printf "%s is not running (no pid file).\n" "$name"
    return 0
  fi

  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    printf "%s pid file is empty, cleaned.\n" "$name"
    return 0
  fi

  if ! is_running "$pid"; then
    rm -f "$pid_file"
    printf "%s already stopped (stale pid=%s removed).\n" "$name" "$pid"
    return 0
  fi

  kill "$pid" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    if ! is_running "$pid"; then
      break
    fi
    sleep 0.2
  done

  if is_running "$pid"; then
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi

  rm -f "$pid_file"
  printf "%s stopped (pid=%s).\n" "$name" "$pid"
}

stop_process "client" "$CLIENT_PID_FILE"
stop_process "server" "$SERVER_PID_FILE"

if [[ -d "$RUN_DIR" ]]; then
  if [[ -z "$(ls -A "$RUN_DIR" 2>/dev/null || true)" ]]; then
    rmdir "$RUN_DIR" >/dev/null 2>&1 || true
  fi
fi

printf "Showdown services stopped.\n"
