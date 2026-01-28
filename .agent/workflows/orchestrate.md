---
description: Automated CLI-based parallel agent execution — spawn subagents via Gemini CLI, coordinate through Serena Memory, monitor progress, and run verification
---

# MANDATORY RULES — VIOLATION IS FORBIDDEN

- **All responses MUST be written in Korean (한국어).** Do NOT respond in English.
- **NEVER skip steps.** Execute from Step 0 in order. Explicitly report completion of each step before proceeding.
- **You MUST use Serena MCP tools throughout the entire workflow.** This is NOT optional.
  - Use `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `search_for_pattern` for code exploration.
  - Use `read_memory`, `write_memory`, `edit_memory` for progress tracking in `.serena/memories/`.
  - Do NOT use raw file reads or grep as substitutes. Serena MCP is the primary interface.
- **Read required documents BEFORE starting.**

---

## Step 0: Preparation (DO NOT SKIP)

1. Read `.agent/skills/workflow-guide/SKILL.md` and confirm Core Rules.
2. Read `.agent/skills/_shared/context-loading.md` for resource loading strategy.
3. Read `.agent/skills/_shared/serena-memory-protocol.md` for memory protocol.

---

## Step 1: Load or Create Plan

Check if `.agent/plan.json` exists.
- If yes: load it and proceed to Step 2.
- If no: ask the user to run `/plan` first, or ask them to describe the tasks to execute.
- **Do NOT proceed without a plan.**

---

## Step 2: Initialize Session

// turbo
1. Generate a session ID (format: `session-YYYYMMDD-HHMMSS`).
2. Use `write_memory` to create `orchestrator-session.md` and `task-board.md` in `.serena/memories/`.
3. Set session status to RUNNING.

---

## Step 3: Spawn Agents by Priority Tier

// turbo
For each priority tier (P0 first, then P1, etc.):
- Spawn agents using `gemini -p "{prompt}" --yolo` (max 3 parallel).
- Each agent gets: task description, API contracts, relevant context from `_shared/context-loading.md`.
- Use `edit_memory` to update `task-board.md` with agent status.

---

## Step 4: Monitor Progress

Use `read_memory` to poll `progress-{agent}.md` every 30 seconds.
- Use `edit_memory` to update `task-board.md` with turn counts and status changes.
- Watch for: completion, failures, crashes (no update for 5 minutes).

---

## Step 5: Verify Completed Agents

// turbo
For each completed agent, run automated verification:
```
bash .agent/skills/_shared/verify.sh {agent-type} {workspace}
```
- PASS (exit 0): accept result.
- FAIL (exit 1): re-spawn with error context (max 2 retries).

---

## Step 6: Collect Results

// turbo
After all agents complete, use `read_memory` to read all `result-{agent}.md` files.
Compile summary: completed tasks, failed tasks, files changed, remaining issues.

---

## Step 7: Final Report

Present session summary to the user.
- If any tasks failed after retries, list them with error details.
- Suggest next steps: manual fix, re-run specific agents, or run `/review` for QA.
- Use `write_memory` to record final results in Serena Memory.
