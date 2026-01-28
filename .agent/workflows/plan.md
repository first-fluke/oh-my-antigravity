---
description: PM planning workflow — analyze requirements, select tech stack, decompose into prioritized tasks with dependencies, and define API contracts
---

# MANDATORY RULES — VIOLATION IS FORBIDDEN

- **All responses MUST be written in Korean (한국어).** Do NOT respond in English.
- **NEVER skip steps.** Execute from Step 1 in order.
- **You MUST use Serena MCP tools throughout the workflow.**
  - Use `get_symbols_overview`, `find_symbol`, `search_for_pattern` to analyze the existing codebase.
  - Use `write_memory`, `edit_memory` to record planning results in `.serena/memories/`.
  - Do NOT use raw file reads or grep as substitutes.

---

## Step 1: Gather Requirements

Ask the user to describe what they want to build. Clarify:
- Target users
- Core features (must-have vs nice-to-have)
- Constraints (tech stack, existing codebase)
- Deployment target (web, mobile, both)

---

## Step 2: Analyze Technical Feasibility

// turbo
If an existing codebase exists, use Serena MCP tools to scan:
- `get_symbols_overview` for project structure and architecture patterns.
- `find_symbol` and `search_for_pattern` to identify reusable code and what needs to be built.

---

## Step 3: Define API Contracts

// turbo
Design API contracts between frontend/mobile and backend. Per endpoint:
- Method, path, request/response schemas
- Auth requirements, error responses
- Save to `.agent/skills/_shared/api-contracts/`.

---

## Step 4: Decompose into Tasks

// turbo
Break down the project into actionable tasks. Each task must have:
- Assigned agent (frontend/backend/mobile/qa/debug)
- Title, acceptance criteria
- Priority (P0-P3), dependencies

---

## Step 5: Review Plan with User

Present the full plan: task list, priority tiers, dependency graph, agent assignments.
**You MUST get user confirmation before proceeding to Step 6.**

---

## Step 6: Save Plan

// turbo
Save the approved plan:
1. `.agent/plan.json`
2. Use `write_memory` to record plan summary in Serena Memory.

The plan is now ready for `/coordinate` or `/orchestrate` to execute.
