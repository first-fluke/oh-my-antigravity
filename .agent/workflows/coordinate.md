---
description: Coordinate multiple agents for a complex multi-domain project using PM planning, parallel agent spawning, and QA review
---

# MANDATORY RULES — VIOLATION IS FORBIDDEN

- **All responses MUST be written in Korean (한국어).** Do NOT respond in English.
- **NEVER skip steps.** Execute from Step 0 in order. Explicitly report completion of each step to the user before proceeding to the next.
- **You MUST use Serena MCP tools throughout the entire workflow.** This is NOT optional.
  - Use `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `search_for_pattern` for code exploration.
  - Use `read_memory`, `write_memory`, `edit_memory` for progress tracking in `.serena/memories/`.
  - Do NOT use raw file reads or grep as substitutes. Serena MCP is the primary interface for code and memory operations.
- **Read the workflow-guide BEFORE starting.** Read `.agent/skills/workflow-guide/SKILL.md` and follow its Core Rules.
- **Follow the context-loading guide.** Read `.agent/skills/_shared/context-loading.md` and load only task-relevant resources.

---

## Step 0: Preparation (DO NOT SKIP)

1. Read `.agent/skills/workflow-guide/SKILL.md` and confirm Core Rules.
2. Read `.agent/skills/_shared/context-loading.md` for resource loading strategy.
3. Read `.agent/skills/_shared/serena-memory-protocol.md` for memory protocol.
4. Record session start in Serena Memory:
   - Use `write_memory` to create `session-coordinate.md` in `.serena/memories/`
   - Include: session start time, user request summary.

---

## Step 1: Analyze Requirements

Analyze the user's request and identify involved domains (frontend, backend, mobile, QA).
- Single domain: suggest using the specific agent directly.
- Multiple domains: proceed to Step 2.
- Use Serena MCP `get_symbols_overview` or `search_for_pattern` to understand the existing codebase structure relevant to the request.
- Report analysis results to the user.

---

## Step 2: Run PM Agent for Task Decomposition

// turbo
Activate PM Agent to:
1. Analyze requirements.
2. Define API contracts.
3. Create a prioritized task breakdown.
4. Save plan to `.agent/plan.json`.
5. Use `write_memory` to record plan completion in Serena Memory.

---

## Step 3: Review Plan with User

Present the PM Agent's task breakdown to the user:
- Priorities (P0, P1, P2)
- Agent assignments
- Dependencies
- **You MUST get user confirmation before proceeding to Step 4.** Do NOT proceed without confirmation.

---

## Step 4: Spawn Agents by Priority Tier

Guide the user to Agent Manager (Mission Control):
1. Open Agent Manager panel.
2. Click 'New Agent' for each task.
3. Select the matching skill and paste the task description.
4. Spawn all same-priority tasks in parallel.
5. Assign separate workspaces to avoid file conflicts.

---

## Step 5: Monitor Agent Progress

- Watch Agent Manager inbox for questions.
- Use Serena MCP `find_symbol` and `search_for_pattern` to verify API contract alignment between agents.
- Use `edit_memory` to record monitoring results in Serena Memory.

---

## Step 6: Run QA Agent Review

After all implementation agents complete, spawn QA Agent to review all deliverables:
- Security (OWASP Top 10)
- Performance
- Accessibility (WCAG 2.1 AA)
- Code quality

---

## Step 7: Address Issues and Iterate

If QA finds CRITICAL or HIGH issues:
1. Re-spawn the responsible agent with QA findings.
2. Repeat Steps 5-7.
3. Continue until all critical issues are resolved.
4. Use `write_memory` to record final results in Serena Memory.
