#!/bin/bash
# spawn-agent.sh - Spawn a sub-agent using configured CLI vendor
# Usage: ./spawn-agent.sh <agent-type> <task-description> [workspace] [--vendor <vendor>]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/cli-config.yaml"
RESULTS_DIR=".agent/results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
AGENT_TYPE=""
TASK=""
WORKSPACE="."
VENDOR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --vendor|-v)
            VENDOR="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: spawn-agent.sh <agent-type> <task> [workspace] [--vendor <vendor>]"
            echo ""
            echo "Arguments:"
            echo "  agent-type    Type of agent (backend, frontend, mobile, qa, debug)"
            echo "  task          Task description or path to task file"
            echo "  workspace     Working directory for the agent (default: current)"
            echo ""
            echo "Options:"
            echo "  --vendor, -v  CLI vendor (gemini, claude, codex, qwen)"
            echo "  --help, -h    Show this help message"
            exit 0
            ;;
        *)
            if [[ -z "$AGENT_TYPE" ]]; then
                AGENT_TYPE="$1"
            elif [[ -z "$TASK" ]]; then
                TASK="$1"
            else
                WORKSPACE="$1"
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$AGENT_TYPE" ]] || [[ -z "$TASK" ]]; then
    echo -e "${RED}Error: agent-type and task are required${NC}"
    echo "Usage: spawn-agent.sh <agent-type> <task> [workspace] [--vendor <vendor>]"
    exit 1
fi

# Read config using grep/sed (no yq dependency)
get_config() {
    local key="$1"
    grep -E "^${key}:" "$CONFIG_FILE" 2>/dev/null | sed 's/^[^:]*: *//' | tr -d '"'
}

get_vendor_config() {
    local vendor="$1"
    local key="$2"
    # Simple YAML parsing for nested values
    awk -v vendor="$vendor" -v key="$key" '
        /^  [a-z]+:$/ { current_vendor = $1; gsub(/:/, "", current_vendor) }
        current_vendor == vendor && $1 == key":" { gsub(/^[^:]*: */, ""); gsub(/"/, ""); print }
    ' "$CONFIG_FILE"
}

# Get active vendor from config or argument
if [[ -z "$VENDOR" ]]; then
    VENDOR=$(get_config "active_vendor")
fi

if [[ -z "$VENDOR" ]]; then
    VENDOR="gemini"
fi

echo -e "${BLUE}[SubAgent]${NC} Spawning ${YELLOW}${AGENT_TYPE}${NC} agent with ${GREEN}${VENDOR}${NC} CLI"

# Get vendor-specific configuration
CLI_CMD=$(get_vendor_config "$VENDOR" "command")
PROMPT_FLAG=$(get_vendor_config "$VENDOR" "prompt_flag")
OUTPUT_FLAG=$(get_vendor_config "$VENDOR" "output_format_flag")
OUTPUT_FORMAT=$(get_vendor_config "$VENDOR" "output_format")
AUTO_FLAG=$(get_vendor_config "$VENDOR" "auto_approve_flag")
RESPONSE_JQ=$(get_vendor_config "$VENDOR" "response_jq")

# Fallback defaults
CLI_CMD="${CLI_CMD:-$VENDOR}"
PROMPT_FLAG="${PROMPT_FLAG:--p}"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-json}"
RESPONSE_JQ="${RESPONSE_JQ:-.response}"

# Check if CLI is available
if ! command -v "$CLI_CMD" &> /dev/null; then
    echo -e "${RED}Error: ${CLI_CMD} CLI not found in PATH${NC}"
    echo "Please install ${VENDOR} CLI and ensure it's authenticated"
    exit 1
fi

# Create results directory
mkdir -p "$RESULTS_DIR"

# Generate unique result filename
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULT_FILE="${RESULTS_DIR}/${AGENT_TYPE}-${TIMESTAMP}.json"
OUTPUT_FILE="${RESULTS_DIR}/${AGENT_TYPE}-${TIMESTAMP}.md"

# If task is a file path, read its contents
if [[ -f "$TASK" ]]; then
    TASK_CONTENT=$(cat "$TASK")
else
    TASK_CONTENT="$TASK"
fi

# Load agent-specific template if exists
TEMPLATE_FILE="${SCRIPT_DIR}/../templates/${AGENT_TYPE}-task.md"
if [[ -f "$TEMPLATE_FILE" ]]; then
    TEMPLATE=$(cat "$TEMPLATE_FILE")
    TASK_CONTENT="${TEMPLATE}

## Current Task
${TASK_CONTENT}"
fi

# Build command based on vendor
build_command() {
    local cmd="$CLI_CMD"

    case "$VENDOR" in
        gemini)
            cmd="$cmd $PROMPT_FLAG \"$TASK_CONTENT\""
            [[ -n "$OUTPUT_FLAG" ]] && cmd="$cmd $OUTPUT_FLAG $OUTPUT_FORMAT"
            [[ -n "$AUTO_FLAG" ]] && cmd="$cmd $AUTO_FLAG"
            ;;
        claude)
            cmd="$cmd $PROMPT_FLAG \"$TASK_CONTENT\""
            [[ -n "$OUTPUT_FLAG" ]] && cmd="$cmd $OUTPUT_FLAG $OUTPUT_FORMAT"
            [[ -n "$AUTO_FLAG" ]] && cmd="$cmd $AUTO_FLAG"
            # Isolation flags
            cmd="$cmd --setting-sources \"\""
            ;;
        codex)
            # Set isolation environment
            export CODEX_HOME="/tmp/codex-subagent-$$"
            mkdir -p "$CODEX_HOME"
            cmd="$cmd $PROMPT_FLAG \"$TASK_CONTENT\""
            [[ -n "$AUTO_FLAG" ]] && cmd="$cmd $AUTO_FLAG"
            ;;
        qwen)
            cmd="$cmd $PROMPT_FLAG \"$TASK_CONTENT\""
            [[ -n "$OUTPUT_FLAG" ]] && cmd="$cmd $OUTPUT_FLAG $OUTPUT_FORMAT"
            [[ -n "$AUTO_FLAG" ]] && cmd="$cmd $AUTO_FLAG"
            ;;
        *)
            # Generic fallback
            cmd="$cmd $PROMPT_FLAG \"$TASK_CONTENT\""
            ;;
    esac

    echo "$cmd"
}

# Execute in workspace
echo -e "${BLUE}[SubAgent]${NC} Working directory: ${WORKSPACE}"
echo -e "${BLUE}[SubAgent]${NC} Task: ${TASK_CONTENT:0:100}..."

cd "$WORKSPACE"

# Build and execute command
CMD=$(build_command)
echo -e "${BLUE}[SubAgent]${NC} Executing: ${CLI_CMD} ..."

# Execute and capture output
set +e
if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    eval "$CMD" > "$RESULT_FILE" 2>&1
    EXIT_CODE=$?

    if [[ $EXIT_CODE -eq 0 ]] && [[ -s "$RESULT_FILE" ]]; then
        # Extract response from JSON
        if command -v jq &> /dev/null; then
            jq -r "$RESPONSE_JQ" "$RESULT_FILE" > "$OUTPUT_FILE" 2>/dev/null || \
                cat "$RESULT_FILE" > "$OUTPUT_FILE"
        else
            cat "$RESULT_FILE" > "$OUTPUT_FILE"
        fi
        echo -e "${GREEN}[SubAgent]${NC} Completed successfully"
        echo -e "${GREEN}[SubAgent]${NC} Result: ${OUTPUT_FILE}"
    else
        echo -e "${RED}[SubAgent]${NC} Failed with exit code: ${EXIT_CODE}"
        cat "$RESULT_FILE"
        exit $EXIT_CODE
    fi
else
    eval "$CMD" > "$OUTPUT_FILE" 2>&1
    EXIT_CODE=$?

    if [[ $EXIT_CODE -eq 0 ]]; then
        echo -e "${GREEN}[SubAgent]${NC} Completed successfully"
        echo -e "${GREEN}[SubAgent]${NC} Result: ${OUTPUT_FILE}"
    else
        echo -e "${RED}[SubAgent]${NC} Failed with exit code: ${EXIT_CODE}"
        exit $EXIT_CODE
    fi
fi
set -e

# Output summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}SubAgent Execution Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Agent Type: ${YELLOW}${AGENT_TYPE}${NC}"
echo -e "Vendor:     ${GREEN}${VENDOR}${NC}"
echo -e "Workspace:  ${WORKSPACE}"
echo -e "Result:     ${OUTPUT_FILE}"
echo -e "${BLUE}========================================${NC}"

# Return the output file path
echo "$OUTPUT_FILE"
