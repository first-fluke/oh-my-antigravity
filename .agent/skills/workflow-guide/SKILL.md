---
name: multi-agent-workflow
description: Guide for coordinating PM, Frontend, Backend, Mobile, and QA agents on complex projects using Antigravity's Agent Manager UI
---

# Multi-Agent Workflow Guide

## When to use
- Complex feature spanning multiple domains (full-stack, mobile)
- Coordination needed between frontend, backend, mobile, and QA
- User wants to manually manage agents via Agent Manager UI

## When NOT to use
- Simple single-domain task -> use the specific agent directly
- User wants automated execution -> use orchestrator
- Quick bug fixes or minor changes

## Core Rules
1. Always start with PM Agent for task decomposition
2. Spawn independent tasks in parallel (same priority tier)
3. Define API contracts before frontend/mobile tasks
4. QA review is always the final step
5. Assign separate workspaces to avoid file conflicts
6. Always use Serena MCP tools as the primary method for code exploration and modification
7. Never skip steps in the workflow — follow each step sequentially without omission

## Workflow

### Step 1: Plan with PM Agent
PM Agent analyzes requirements, selects tech stack, creates task breakdown with priorities.

### Step 2: Spawn Agents by Priority
Guide user to Agent Manager:
1. Open Agent Manager panel (Mission Control)
2. Click 'New Agent', select skill, paste task description
3. Spawn all same-priority tasks in parallel

### Step 3: Monitor & Coordinate
- Watch Agent Manager inbox for questions
- Verify API contracts align between agents
- Ensure shared data models are consistent

### Step 4: QA Review
Spawn QA Agent last to review all deliverables. Address CRITICAL issues by re-spawning agents.

## Automated Alternative
For fully automated execution without manual spawning, use the **orchestrator** skill instead.

## References
- Workflow examples: `resources/examples.md`
