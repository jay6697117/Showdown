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

read_ppid() {
  local pid="$1"
  ps -p "$pid" -o ppid= 2>/dev/null | tr -d '[:space:]'
}

is_descendant_of() {
  local pid="$1"
  local ancestor="$2"
  local current="$pid"
  local parent

  while [[ -n "$current" ]]; do
    if [[ "$current" == "$ancestor" ]]; then
      return 0
    fi

    if [[ "$current" == "1" ]]; then
      break
    fi

    parent="$(read_ppid "$current")"
    if [[ -z "$parent" ]]; then
      break
    fi
    current="$parent"
  done

  return 1
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

pid_tree_owns_port() {
  local ancestor_pid="$1"
  local port="$2"
  local listening_pid

  while IFS= read -r listening_pid; do
    [[ -z "$listening_pid" ]] && continue
    if is_descendant_of "$listening_pid" "$ancestor_pid"; then
      return 0
    fi
  done < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)

  return 1
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
  local expected_port="$5"
  local pid

  pid="$(read_pid "$pid_file")"
  if [[ -n "$pid" ]] && is_running "$pid"; then
    if pid_tree_owns_port "$pid" "$expected_port"; then
      printf "%s is already running (pid=%s, port=%s)\n" "$name" "$pid" "$expected_port"
      return 0
    fi

    printf "%s process is running (pid=%s) but not listening on expected port %s.\n" "$name" "$pid" "$expected_port"
    printf "Please run scripts/dev-down.sh first, then retry.\n"
    return 1
  fi

  rm -f "$pid_file"

  if is_port_listening "$expected_port"; then
    printf "Port %s is already in use. Cannot start %s.\n" "$expected_port" "$name"
    return 1
  fi

  nohup bash -lc "$cmd" >"$log_file" 2>&1 &
  pid="$!"
  echo "$pid" >"$pid_file"

  for _ in {1..40}; do
    if ! is_running "$pid"; then
      printf "Failed to start %s, check %s\n" "$name" "$log_file"
      return 1
    fi

    if pid_tree_owns_port "$pid" "$expected_port"; then
      printf "%s started (pid=%s, port=%s)\n" "$name" "$pid" "$expected_port"
      return 0
    fi

    sleep 0.25
  done

  printf "Failed to start %s on port %s, check %s\n" "$name" "$expected_port" "$log_file"
  rm -f "$pid_file"
  return 1
}

mkdir -p "$RUN_DIR"

server_cmd="cd '$ROOT_DIR' && PORT='$SERVER_PORT' npm run dev -w server"
client_cmd="cd '$ROOT_DIR' && npm run dev -w client -- --host '$CLIENT_HOST' --port '$CLIENT_PORT' --strictPort"

if ! start_process "server" "$server_cmd" "$SERVER_PID_FILE" "$SERVER_LOG" "$SERVER_PORT"; then
  exit 1
fi

if ! start_process "client" "$client_cmd" "$CLIENT_PID_FILE" "$CLIENT_LOG" "$CLIENT_PORT"; then
  bash "$ROOT_DIR/scripts/dev-down.sh" >/dev/null 2>&1 || true
  exit 1
fi

printf "\n%s\n" "Showdown started."
printf "%s\n" "- Client: http://$CLIENT_HOST:$CLIENT_PORT"
printf "%s\n" "- Server: ws://localhost:$SERVER_PORT"
printf "%s\n" "- Logs: $RUN_DIR"
