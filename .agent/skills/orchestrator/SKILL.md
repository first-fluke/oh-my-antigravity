---
name: orchestrator
description: Spawn and coordinate sub-agents using CLI tools (Gemini, Claude, Codex, Qwen) for parallel task execution
---

# SubAgent Orchestrator

Spawn isolated sub-agents using headless CLI tools for parallel task execution.

## Use this skill when

- Complex task requires multiple specialized agents
- Need parallel execution across domains (backend + frontend + mobile)
- Want to delegate focused tasks to isolated sub-agents

## Supported CLI Vendors

| Vendor | Command | Auto-Approve | Output |
|--------|---------|--------------|--------|
| Gemini | `gemini -p` | `--yolo` | JSON |
| Claude | `claude -p` | `--dangerously-skip-permissions` | JSON |
| Codex | `codex -p` | `--full-auto` | JSON |
| Qwen | `qwen -p` | `--auto` | JSON |

Configure in `config/cli-config.yaml`:
```yaml
active_vendor: gemini  # Change to: claude, codex, qwen
```

## Quick Start

### Single Agent
```bash
./scripts/spawn-agent.sh backend "Implement auth API" ./backend
./scripts/spawn-agent.sh frontend "Create login form" ./frontend --vendor claude
```

### Parallel Agents (Inline)
```bash
./scripts/parallel-run.sh --inline \
  "backend:Implement auth API" \
  "frontend:Create login form" \
  "mobile:Build auth screens"
```

### Parallel Agents (YAML)
```bash
./scripts/parallel-run.sh templates/tasks-example.yaml
```

## Scripts

### spawn-agent.sh
```
Usage: spawn-agent.sh <agent-type> <task> [workspace] [--vendor <vendor>]

Arguments:
  agent-type    backend, frontend, mobile, qa, debug
  task          Task description or path to task file
  workspace     Working directory (default: current)

Options:
  --vendor, -v  CLI vendor override
```

### parallel-run.sh
```
Usage: parallel-run.sh [options] <tasks-file.yaml>
       parallel-run.sh --inline "agent:task" ...

Options:
  --vendor, -v   CLI vendor for all agents
  --inline, -i   Specify tasks as arguments
  --no-wait      Run in background mode
```

## Task File Format

```yaml
tasks:
  - agent: backend
    task: "Implement JWT authentication"
    workspace: ./backend

  - agent: frontend
    task: "Create login UI with validation"
    workspace: ./frontend
```

## Results

Results are saved to `.agent/results/`:
```
.agent/results/
  backend-20260128-143022.json   # Raw JSON output
  backend-20260128-143022.md     # Extracted response
  parallel-20260128-143022/      # Parallel run logs
```

## Workflow Example

1. Plan with PM Agent
2. Spawn parallel agents:
```bash
./scripts/parallel-run.sh --inline \
  "backend:$(cat .agent/plan.json | jq -r '.tasks[0].description')" \
  "frontend:$(cat .agent/plan.json | jq -r '.tasks[1].description')"
```
3. Review results in `.agent/results/`
4. Spawn QA Agent for review

## CLI Configuration

Edit `config/cli-config.yaml`:

```yaml
active_vendor: gemini

vendors:
  gemini:
    command: gemini
    prompt_flag: "-p"
    auto_approve_flag: "--yolo"
    output_format: "json"

execution:
  timeout: 600
  results_dir: ".agent/results"
```

## Isolation

Each sub-agent runs in isolation:
- **Gemini**: Separate directory context
- **Claude**: `--setting-sources ""` flag
- **Codex**: Separate `CODEX_HOME` environment
- **Qwen**: Separate directory context

Sub-agents receive only their task, no chat history.
