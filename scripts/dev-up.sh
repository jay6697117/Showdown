#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run/showdown"
SERVER_PID_FILE="$RUN_DIR/server.pid"
CLIENT_PID_FILE="$RUN_DIR/client.pid"
SERVER_LOG="$RUN_DIR/server.log"
CLIENT_LOG="$RUN_DIR/client.log"
SERVER_PORT="${SHOWDOWN_SERVER_PORT:-3000}"
CLIENT_PORT="${SHOWDOWN_CLIENT_PORT:-5173}"
CLIENT_HOST="${SHOWDOWN_CLIENT_HOST:-127.0.0.1}"

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

read_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    cat "$pid_file" 2>/dev/null || true
  fi
}

start_process() {
  local name="$1"
  local cmd="$2"
  local pid_file="$3"
  local log_file="$4"
  local pid

  pid="$(read_pid "$pid_file")"
  if [[ -n "$pid" ]] && is_running "$pid"; then
    printf "%s is already running (pid=%s)\n" "$name" "$pid"
    return 0
  fi

  rm -f "$pid_file"
  nohup bash -lc "$cmd" >"$log_file" 2>&1 &
  pid="$!"
  echo "$pid" >"$pid_file"

  sleep 1
  if ! is_running "$pid"; then
    printf "Failed to start %s, check %s\n" "$name" "$log_file"
    return 1
  fi

  printf "%s started (pid=%s)\n" "$name" "$pid"
}

mkdir -p "$RUN_DIR"

server_cmd="cd '$ROOT_DIR' && PORT=$SERVER_PORT npm run dev:server"
client_cmd="cd '$ROOT_DIR' && npm run dev:client -- --host $CLIENT_HOST --port $CLIENT_PORT"

if ! start_process "server" "$server_cmd" "$SERVER_PID_FILE" "$SERVER_LOG"; then
  exit 1
fi

if ! start_process "client" "$client_cmd" "$CLIENT_PID_FILE" "$CLIENT_LOG"; then
  bash "$ROOT_DIR/scripts/dev-down.sh" >/dev/null 2>&1 || true
  exit 1
fi

printf "\n%s\n" "Showdown started."
printf "%s\n" "- Client: http://$CLIENT_HOST:$CLIENT_PORT"
printf "%s\n" "- Server: ws://localhost:$SERVER_PORT"
printf "%s\n" "- Logs: $RUN_DIR"
