#!/usr/bin/env bash
# Serena Memory Real-time Terminal Dashboard
# Watches .serena/memories/ for changes and displays status table

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MEMORIES_DIR="$PROJECT_ROOT/.serena/memories"

SESSION_FILTER="${1:-}"

# Colors
PURPLE='\033[0;35m'
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
DIM='\033[2m'
RESET='\033[0m'

# Status symbols
SYM_RUNNING="●"
SYM_COMPLETED="✓"
SYM_FAILED="✗"
SYM_BLOCKED="○"
SYM_PENDING="◌"

check_dependencies() {
  if [[ "$(uname)" == "Darwin" ]]; then
    if ! command -v fswatch &>/dev/null; then
      echo "Error: fswatch is required on macOS. Install with: brew install fswatch"
      exit 1
    fi
  else
    if ! command -v inotifywait &>/dev/null; then
      echo "Error: inotifywait is required on Linux. Install with: apt install inotify-tools"
      exit 1
    fi
  fi
}

get_session_info() {
  local session_file="$MEMORIES_DIR/orchestrator-session.md"
  local session_id="N/A"
  local session_status="UNKNOWN"

  if [[ -f "$session_file" ]]; then
    session_id=$(grep -oP '(?<=session-id:\s).*' "$session_file" 2>/dev/null \
      || grep -oE 'session-[0-9]{8}-[0-9]{6}' "$session_file" 2>/dev/null | head -1 \
      || echo "N/A")
    if grep -qi 'status:.*running\|phase:.*executing\|## Active' "$session_file" 2>/dev/null; then
      session_status="RUNNING"
    elif grep -qi 'status:.*completed\|phase:.*completed\|## Completed' "$session_file" 2>/dev/null; then
      session_status="COMPLETED"
    elif grep -qi 'status:.*failed\|phase:.*failed' "$session_file" 2>/dev/null; then
      session_status="FAILED"
    fi
  fi

  echo "$session_id|$session_status"
}

parse_task_board() {
  local task_file="$MEMORIES_DIR/task-board.md"
  if [[ ! -f "$task_file" ]]; then
    return
  fi

  # Parse markdown table rows: | agent | status | task | ...
  grep -E '^\|[^-]' "$task_file" 2>/dev/null | grep -v '^\| *Agent\|^\| *agent\|^\| *---' | while IFS='|' read -r _ agent status task _rest; do
    agent=$(echo "$agent" | xargs 2>/dev/null || echo "$agent")
    status=$(echo "$status" | xargs 2>/dev/null || echo "$status")
    task=$(echo "$task" | xargs 2>/dev/null || echo "$task")
    [[ -n "$agent" ]] && echo "$agent|$status|$task"
  done
}

get_agent_turn() {
  local agent="$1"
  local progress_file
  progress_file=$(ls -t "$MEMORIES_DIR"/progress-"$agent"*.md 2>/dev/null | head -1)
  if [[ -n "$progress_file" && -f "$progress_file" ]]; then
    grep -oP '(?<=turn[:\s]*)\d+' "$progress_file" 2>/dev/null | tail -1 || echo "-"
  else
    echo "-"
  fi
}

get_latest_activity() {
  local lines=()
  local count=0

  # Gather recent progress entries
  for f in $(ls -t "$MEMORIES_DIR"/progress-*.md "$MEMORIES_DIR"/result-*.md 2>/dev/null | head -5); do
    local basename
    basename=$(basename "$f" .md)
    local agent
    agent=$(echo "$basename" | sed 's/^progress-//;s/^result-//')

    local last_line
    if [[ "$basename" == result-* ]]; then
      last_line=$(grep -E '^\*|^-|^#|status|result' "$f" 2>/dev/null | tail -1 | sed 's/^[#*\- ]*//')
      [[ -n "$last_line" ]] && lines+=("[$agent] $last_line")
    else
      last_line=$(grep -E '^\*|^-|^##|turn|Turn' "$f" 2>/dev/null | tail -1 | sed 's/^[#*\- ]*//')
      [[ -n "$last_line" ]] && lines+=("[$agent] $last_line")
    fi

    count=$((count + 1))
    [[ $count -ge 4 ]] && break
  done

  [[ ${#lines[@]} -gt 0 ]] && printf '%s\n' "${lines[@]}"
}

status_symbol() {
  local status="$1"
  case "${status,,}" in
    running|active|in_progress|in-progress)
      echo -e "${GREEN}${SYM_RUNNING}${RESET} running"
      ;;
    completed|done|finished)
      echo -e "${CYAN}${SYM_COMPLETED}${RESET} completed"
      ;;
    failed|error)
      echo -e "${RED}${SYM_FAILED}${RESET} failed"
      ;;
    blocked|waiting)
      echo -e "${YELLOW}${SYM_BLOCKED}${RESET} blocked"
      ;;
    *)
      echo -e "${DIM}${SYM_PENDING}${RESET} pending"
      ;;
  esac
}

render_dashboard() {
  clear

  local session_info
  session_info=$(get_session_info)
  local session_id="${session_info%%|*}"
  local session_status="${session_info##*|}"

  local status_color="$YELLOW"
  case "$session_status" in
    RUNNING)   status_color="$GREEN" ;;
    COMPLETED) status_color="$CYAN" ;;
    FAILED)    status_color="$RED" ;;
  esac

  local W=56
  local border_top border_mid border_bot
  border_top=$(printf '═%.0s' $(seq 1 $W))
  border_mid=$(printf '═%.0s' $(seq 1 $W))
  border_bot=$(printf '═%.0s' $(seq 1 $W))

  echo -e "${PURPLE}╔${border_top}╗${RESET}"
  printf "${PURPLE}║${RESET}  ${BOLD}${PURPLE}Serena Memory Dashboard${RESET}%*s${PURPLE}║${RESET}\n" $((W - 25)) ""
  printf "${PURPLE}║${RESET}  Session: ${BOLD}%-20s${RESET} [${status_color}%s${RESET}]%*s${PURPLE}║${RESET}\n" \
    "$session_id" "$session_status" $((W - 28 - ${#session_id} - ${#session_status})) ""
  echo -e "${PURPLE}╠${border_mid}╣${RESET}"

  # Agent table header
  printf "${PURPLE}║${RESET}  ${BOLD}%-12s %-12s %-6s %-20s${RESET}  ${PURPLE}║${RESET}\n" "Agent" "Status" "Turn" "Task"
  printf "${PURPLE}║${RESET}  ${DIM}%-12s %-12s %-6s %-20s${RESET}  ${PURPLE}║${RESET}\n" "──────────" "──────────" "────" "──────────────────"

  # Parse and display agents
  local has_agents=false
  while IFS='|' read -r agent status task; do
    [[ -z "$agent" ]] && continue
    has_agents=true
    local turn
    turn=$(get_agent_turn "$agent")
    local sym
    sym=$(status_symbol "$status")
    printf "${PURPLE}║${RESET}  %-12s %-22b %-6s %-20s${PURPLE}║${RESET}\n" \
      "$agent" "$sym" "$turn" "${task:0:20}"
  done < <(parse_task_board)

  if [[ "$has_agents" == false ]]; then
    # Try to find agents from progress files
    for f in $(ls -t "$MEMORIES_DIR"/progress-*.md 2>/dev/null); do
      has_agents=true
      local basename agent turn
      basename=$(basename "$f" .md)
      agent=$(echo "$basename" | sed 's/^progress-//')
      turn=$(get_agent_turn "$agent")
      local sym
      sym=$(status_symbol "running")
      printf "${PURPLE}║${RESET}  %-12s %-22b %-6s %-20s${PURPLE}║${RESET}\n" \
        "$agent" "$sym" "$turn" ""
    done
  fi

  if [[ "$has_agents" == false ]]; then
    printf "${PURPLE}║${RESET}  ${DIM}No agents detected yet%-32s${RESET}${PURPLE}║${RESET}\n" ""
  fi

  echo -e "${PURPLE}╠${border_mid}╣${RESET}"

  # Latest activity
  printf "${PURPLE}║${RESET}  ${BOLD}Latest Activity:${RESET}%*s${PURPLE}║${RESET}\n" $((W - 18)) ""
  local activity_count=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    printf "${PURPLE}║${RESET}  ${DIM}%-52s${RESET}${PURPLE}║${RESET}\n" "${line:0:52}"
    activity_count=$((activity_count + 1))
  done < <(get_latest_activity)

  if [[ $activity_count -eq 0 ]]; then
    printf "${PURPLE}║${RESET}  ${DIM}No activity yet%-38s${RESET}${PURPLE}║${RESET}\n" ""
  fi

  echo -e "${PURPLE}╠${border_mid}╣${RESET}"

  local now
  now=$(date '+%Y-%m-%d %H:%M:%S')
  printf "${PURPLE}║${RESET}  Updated: ${DIM}%s${RESET}  |  Ctrl+C to exit%*s${PURPLE}║${RESET}\n" \
    "$now" $((W - 42 - ${#now})) ""
  echo -e "${PURPLE}╚${border_bot}╝${RESET}"
}

main() {
  check_dependencies

  if [[ ! -d "$MEMORIES_DIR" ]]; then
    mkdir -p "$MEMORIES_DIR"
    echo "Created $MEMORIES_DIR — waiting for memory files..."
  fi

  # Initial render
  render_dashboard

  # Watch for changes
  if [[ "$(uname)" == "Darwin" ]]; then
    fswatch -o "$MEMORIES_DIR" | while read -r _; do
      render_dashboard
    done
  else
    while true; do
      inotifywait -qq -r -e modify,create,delete "$MEMORIES_DIR"
      render_dashboard
    done
  fi
}

main "$@"
