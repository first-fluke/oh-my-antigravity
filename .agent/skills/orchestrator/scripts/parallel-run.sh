#!/bin/bash
# parallel-run.sh - Run multiple sub-agents in parallel
# Usage: ./parallel-run.sh <tasks-file.yaml> [--vendor <vendor>]
#        ./parallel-run.sh --inline "backend:task1" "frontend:task2" ...

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPAWN_SCRIPT="${SCRIPT_DIR}/spawn-agent.sh"
RESULTS_DIR=".agent/results"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
TASKS_FILE=""
VENDOR=""
INLINE_MODE=false
INLINE_TASKS=()
WAIT_MODE=true

show_help() {
    echo "Usage: parallel-run.sh [options] <tasks-file.yaml>"
    echo "       parallel-run.sh --inline \"agent:task\" \"agent:task\" ..."
    echo ""
    echo "Options:"
    echo "  --vendor, -v     CLI vendor (gemini, claude, codex, qwen)"
    echo "  --inline, -i     Inline mode: specify tasks as arguments"
    echo "  --no-wait        Don't wait for completion (background mode)"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Tasks file format (YAML):"
    echo "  tasks:"
    echo "    - agent: backend"
    echo "      task: \"Implement auth API\""
    echo "      workspace: ./backend"
    echo "    - agent: frontend"
    echo "      task: \"Create login UI\""
    echo "      workspace: ./frontend"
    echo ""
    echo "Inline format:"
    echo "  parallel-run.sh --inline \"backend:Implement auth\" \"frontend:Create login\""
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --vendor|-v)
            VENDOR="$2"
            shift 2
            ;;
        --inline|-i)
            INLINE_MODE=true
            shift
            ;;
        --no-wait)
            WAIT_MODE=false
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            if [[ "$INLINE_MODE" == true ]]; then
                INLINE_TASKS+=("$1")
            else
                TASKS_FILE="$1"
            fi
            shift
            ;;
    esac
done

# Create results directory
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="${RESULTS_DIR}/parallel-${TIMESTAMP}"
mkdir -p "$RUN_DIR"

# Track PIDs and results
declare -A PIDS
declare -A AGENT_NAMES

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  Parallel SubAgent Execution${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Parse inline tasks
parse_inline_tasks() {
    local idx=0
    for task_spec in "${INLINE_TASKS[@]}"; do
        # Format: "agent:task" or "agent:task:workspace"
        IFS=':' read -r agent task workspace <<< "$task_spec"
        workspace="${workspace:-.}"

        echo -e "${BLUE}[${idx}]${NC} Spawning ${YELLOW}${agent}${NC} agent..."

        # Build vendor flag
        VENDOR_FLAG=""
        [[ -n "$VENDOR" ]] && VENDOR_FLAG="--vendor $VENDOR"

        # Spawn in background
        (
            "$SPAWN_SCRIPT" "$agent" "$task" "$workspace" $VENDOR_FLAG \
                > "${RUN_DIR}/${agent}-${idx}.log" 2>&1
        ) &

        PIDS[$!]=$idx
        AGENT_NAMES[$!]=$agent
        ((idx++))
    done
}

# Parse YAML tasks file
parse_yaml_tasks() {
    if [[ ! -f "$TASKS_FILE" ]]; then
        echo -e "${RED}Error: Tasks file not found: ${TASKS_FILE}${NC}"
        exit 1
    fi

    local idx=0
    local current_agent=""
    local current_task=""
    local current_workspace="."

    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^[[:space:]]*# ]] && continue

        # Parse agent
        if [[ "$line" =~ agent:[[:space:]]*(.+) ]]; then
            current_agent="${BASH_REMATCH[1]}"
            current_agent=$(echo "$current_agent" | tr -d '"' | xargs)
        fi

        # Parse task
        if [[ "$line" =~ task:[[:space:]]*(.+) ]]; then
            current_task="${BASH_REMATCH[1]}"
            current_task=$(echo "$current_task" | tr -d '"' | xargs)
        fi

        # Parse workspace
        if [[ "$line" =~ workspace:[[:space:]]*(.+) ]]; then
            current_workspace="${BASH_REMATCH[1]}"
            current_workspace=$(echo "$current_workspace" | tr -d '"' | xargs)
        fi

        # Start of new task block (next - agent:)
        if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*agent: ]] && [[ -n "$current_task" ]] && [[ $idx -gt 0 ]]; then
            # Spawn previous task
            spawn_task "$idx" "$current_agent" "$current_task" "$current_workspace"
            current_workspace="."
            current_task=""
        fi

        # Check if we have a complete task
        if [[ -n "$current_agent" ]] && [[ -n "$current_task" ]]; then
            if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*agent: ]]; then
                ((idx++))
            fi
        fi
    done < "$TASKS_FILE"

    # Spawn last task
    if [[ -n "$current_agent" ]] && [[ -n "$current_task" ]]; then
        spawn_task "$idx" "$current_agent" "$current_task" "$current_workspace"
    fi
}

spawn_task() {
    local idx=$1
    local agent=$2
    local task=$3
    local workspace=$4

    echo -e "${BLUE}[${idx}]${NC} Spawning ${YELLOW}${agent}${NC} agent..."
    echo -e "    Task: ${task:0:60}..."
    echo -e "    Workspace: ${workspace}"

    VENDOR_FLAG=""
    [[ -n "$VENDOR" ]] && VENDOR_FLAG="--vendor $VENDOR"

    (
        "$SPAWN_SCRIPT" "$agent" "$task" "$workspace" $VENDOR_FLAG \
            > "${RUN_DIR}/${agent}-${idx}.log" 2>&1
    ) &

    PIDS[$!]=$idx
    AGENT_NAMES[$!]=$agent
}

# Alternative simpler YAML parsing for common format
parse_yaml_simple() {
    if [[ ! -f "$TASKS_FILE" ]]; then
        echo -e "${RED}Error: Tasks file not found: ${TASKS_FILE}${NC}"
        exit 1
    fi

    local idx=0

    # Use grep to find task blocks
    while IFS= read -r block; do
        local agent=$(echo "$block" | grep -oP 'agent:\s*\K[^\s]+' | tr -d '"')
        local task=$(echo "$block" | grep -oP 'task:\s*"\K[^"]+')
        local workspace=$(echo "$block" | grep -oP 'workspace:\s*\K[^\s]+' | tr -d '"')

        [[ -z "$workspace" ]] && workspace="."

        if [[ -n "$agent" ]] && [[ -n "$task" ]]; then
            echo -e "${BLUE}[${idx}]${NC} Spawning ${YELLOW}${agent}${NC} agent..."
            echo -e "    Task: ${task:0:60}..."

            VENDOR_FLAG=""
            [[ -n "$VENDOR" ]] && VENDOR_FLAG="--vendor $VENDOR"

            (
                "$SPAWN_SCRIPT" "$agent" "$task" "$workspace" $VENDOR_FLAG \
                    > "${RUN_DIR}/${agent}-${idx}.log" 2>&1
            ) &

            PIDS[$!]=$idx
            AGENT_NAMES[$!]=$agent
            ((idx++))
        fi
    done < <(awk '/^[[:space:]]*-[[:space:]]*agent:/{if(block)print block; block=$0; next} {block=block" "$0} END{print block}' "$TASKS_FILE")
}

# Execute tasks
echo -e "${BLUE}Starting parallel execution...${NC}"
echo ""

if [[ "$INLINE_MODE" == true ]]; then
    if [[ ${#INLINE_TASKS[@]} -eq 0 ]]; then
        echo -e "${RED}Error: No tasks specified${NC}"
        show_help
        exit 1
    fi
    parse_inline_tasks
else
    if [[ -z "$TASKS_FILE" ]]; then
        echo -e "${RED}Error: No tasks file specified${NC}"
        show_help
        exit 1
    fi
    parse_yaml_simple
fi

TOTAL_TASKS=${#PIDS[@]}
echo ""
echo -e "${BLUE}[Parallel]${NC} Started ${YELLOW}${TOTAL_TASKS}${NC} agents"

if [[ "$WAIT_MODE" == false ]]; then
    echo -e "${BLUE}[Parallel]${NC} Running in background mode"
    echo -e "${BLUE}[Parallel]${NC} Results will be in: ${RUN_DIR}"
    exit 0
fi

# Wait for all tasks and collect results
echo -e "${BLUE}[Parallel]${NC} Waiting for completion..."
echo ""

COMPLETED=0
FAILED=0

for pid in "${!PIDS[@]}"; do
    idx=${PIDS[$pid]}
    agent=${AGENT_NAMES[$pid]}

    if wait $pid; then
        echo -e "${GREEN}[DONE]${NC} ${agent} agent (${idx}) completed"
        ((COMPLETED++))
    else
        echo -e "${RED}[FAIL]${NC} ${agent} agent (${idx}) failed"
        ((FAILED++))
    fi
done

# Summary
echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  Execution Summary${NC}"
echo -e "${CYAN}======================================${NC}"
echo -e "Total:     ${TOTAL_TASKS}"
echo -e "Completed: ${GREEN}${COMPLETED}${NC}"
echo -e "Failed:    ${RED}${FAILED}${NC}"
echo -e "Results:   ${RUN_DIR}"
echo -e "${CYAN}======================================${NC}"

# List result files
echo ""
echo -e "${BLUE}Result files:${NC}"
for f in "${RUN_DIR}"/*.log; do
    [[ -f "$f" ]] && echo "  - $f"
done

# Exit with error if any failed
[[ $FAILED -gt 0 ]] && exit 1
exit 0
