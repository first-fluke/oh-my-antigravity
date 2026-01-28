# Agent Execution Guide

**This guide is for the agents themselves.** When you (an agent) are spawned by the Orchestrator or Agent Manager, read this to understand how to collaborate, track progress, and store results.

---

## Your Role

You are one of these agents:

| Agent | Role | Domain |
|-------|------|--------|
| **PM Agent** | Plan tasks, prioritize, break down complexity | Requirements, architecture, estimation |
| **Frontend Agent** | Build UI, components, styling, client logic | React/Next.js, TypeScript, Tailwind CSS |
| **Backend Agent** | Implement APIs, databases, auth, server logic | FastAPI, SQLAlchemy, PostgreSQL, JWT |
| **Mobile Agent** | Develop cross-platform apps | Flutter, Dart, iOS/Android |
| **QA Agent** | Security audit, performance test, accessibility | OWASP, Lighthouse, WCAG 2.1 AA |
| **Debug Agent** | Diagnose bugs, find root causes, provide fixes | Error analysis, regression tests |

---

## Before You Start

### 1. Read Your Task

Your task will be passed as input. It should include:
- **What to do** — clear objective
- **Context** — what others have already done (check `.gemini/antigravity/brain/`)
- **Workspace** — your assigned directory (e.g., `./backend`, `./frontend`)
- **Session ID** — session identifier (e.g., `session-20260128-143022`)

### 2. Set Up Your Workspace

```bash
# Your work directory
cd ./your-assigned-workspace
# e.g., ./backend or ./frontend
```

All your code, tests, and artifacts go here.

### 3. Record Session Metadata

Create a progress file with your starting timestamp:

```bash
touch .serena/memories/progress-{your-agent}.md
```

Replace `{your-agent}` with your name (e.g., `progress-backend.md`).

---

## During Execution

### Track Progress

**Write turn-by-turn progress** to your progress file. Format:

```markdown
## {Agent Name} Progress

turn: 1
- Starting task: {brief description}
- Initial analysis: {what you found}

turn: 2
- Completed: {what you did}
- Next step: {what's coming}

turn: N
- Final status: {completed/blocked/error}
- Key changes: {summary}
```

**Update after each major step** (ideally each turn/iteration). This helps:
- Other agents understand your progress
- The dashboard shows real-time status
- The orchestrator can monitor and intervene if needed

### Collaborate with Other Agents

1. **Check Knowledge Base** — Look at `.gemini/antigravity/brain/` to see what others have done
2. **Align on interfaces** — If you're backend, make sure frontend knows your API paths/contracts
3. **Reference other work** — "Based on Frontend Agent's component structure, I've designed the API to match"
4. **Update others if you change plan** — If you discover the task needs changes, communicate this

### Handle Errors

If you encounter a blocker:

1. **Document the error** in your progress file:
   ```markdown
   turn: X
   - ERROR: {error message}
   - Cause: {why it happened}
   - Action: {what I'm doing about it}
   - Recommendation: {for the orchestrator}
   ```

2. **Try alternatives** if possible before giving up

3. **Don't silently fail** — Always report status in the progress file

### Code Quality Rules

Follow these standards:

| Domain | Standard |
|--------|----------|
| **Frontend** | TypeScript strict mode, Tailwind CSS (no inline styles), WCAG 2.1 AA |
| **Backend** | JWT auth, bcrypt hashing, rate limiting, Pydantic validation |
| **Mobile** | Material Design 3, iOS + Android support, clean architecture |
| **Tests** | Unit + integration tests for new code, >80% coverage |
| **Security** | No hardcoded secrets, input validation, SQL injection prevention |

---

## When You're Done

### 1. Create Result File

Write your final result to a result file:

```bash
# Create result file
cat > .serena/memories/result-{your-agent}.md << 'EOF'
## {Agent Name} Result

status: completed
turn: {final turn number}

### Summary
- Task: {what was assigned}
- Completed: {what you did}
- Tests: {pass/fail}
- Files: {main deliverables}

### Key Changes
- {change 1}
- {change 2}

### Known Issues
- {issue 1 if any}

### Next Steps (for other agents)
- {recommendation}
EOF
```

### 2. Location of Artifacts

- **Code** → Your workspace directory (e.g., `./backend/`)
- **Tests** → Same directory as code
- **Documentation** → `.md` files in your workspace
- **Knowledge Base** → Push important outputs to `.gemini/antigravity/brain/` if coordinating with others

### 3. Update Progress File

Mark completion:

```markdown
turn: {final turn}
status: completed
- Final deliverables in {workspace}/
- All tests passing: ✓
- Ready for next stage or QA review
```

### 4. Summary Output

Provide a brief summary to stdout:
```
✅ Backend Agent completed
- Implemented 5 API endpoints
- Added JWT authentication
- 12 tests passing
- Results in ./backend/
```

---

## Special Roles

### PM Agent

When you plan:

```bash
# Save plan to standard location
cat > .agent/plan.json << 'EOF'
{
  "session": "session-20260128-143022",
  "plan": {
    "tasks": [
      {
        "id": "task-1",
        "title": "Backend Authentication API",
        "agent": "backend-agent",
        "priority": 1,
        "dependencies": [],
        "estimatedTurns": 5
      }
    ]
  }
}
EOF
```

Also create a human-readable version:
```bash
cat > .gemini/antigravity/brain/plan.md << 'EOF'
# Project Plan

## Phase 1: Foundation (Backend + Frontend Setup)
- Task 1.1: Backend authentication API (backend-agent, priority 1)
- Task 1.2: Frontend login UI (frontend-agent, priority 1)

## Phase 2: Features
- ...
EOF
```

### QA Agent

When you audit:

```bash
# Save comprehensive report
cat > .gemini/antigravity/brain/qa-report.md << 'EOF'
# QA Audit Report

## Security (OWASP Top 10)
- ✅ Injection: No SQL injection found, Pydantic validates all inputs
- ✅ Authentication: JWT properly implemented with refresh tokens
- ⚠️  CORS: Overly permissive, recommend restricting to specific domains

## Performance
- Lighthouse score: 88/100
- API latency: avg 145ms, p99 320ms

## Accessibility (WCAG 2.1 AA)
- ✅ Color contrast: Pass
- ⚠️  Missing alt text on 3 images

## Recommendations
1. CRITICAL: Restrict CORS
2. HIGH: Add missing alt texts
3. MEDIUM: Optimize image loading
EOF
```

### Debug Agent

When you fix bugs:

```bash
# Save bug analysis and fix
cat > .serena/memories/result-debug.md << 'EOF'
## Debug Agent Result

status: completed

### Bug Report
- Error: Cannot read property 'map' of undefined
- Location: TodoList.tsx:42
- Symptom: Click "Add Todo" → crash

### Root Cause Analysis
- Component tries to map `todos` before data loads
- Missing null/loading checks
- Race condition between state init and render

### Fix Applied
- Added `if (isLoading) return <LoadingSpinner />`
- Added `if (!todos) return <EmptyState />`
- Added optional chaining in list render

### Regression Test
- Test: "renders empty state when todos is null"
- Test: "shows loading spinner while fetching"
- Status: ✅ Passing

### Similar Patterns Found
- TodoForm.tsx:78 - similar issue, fixed proactively
- TodoFilters.tsx:15 - similar issue, fixed proactively
EOF
```

---

## Serena Memory Files

The orchestrator watches these files. Update them to communicate status:

| File | Purpose | You Create? |
|------|---------|------------|
| `.serena/memories/orchestrator-session.md` | Session state | Orchestrator only |
| `.serena/memories/task-board.md` | Task assignments | Orchestrator only |
| `.serena/memories/progress-{agent}.md` | Your turn-by-turn progress | **You create** |
| `.serena/memories/result-{agent}.md` | Your final result | **You create** |

### Progress File Format

```markdown
## {Agent Name} Progress

session: session-20260128-143022
assigned-task: {your task}

turn: 1
- Phase: Initial analysis
- Action: Read requirements, reviewed existing code
- Status: OK

turn: 2
- Phase: Implementation
- Action: Created 3 API endpoints
- Status: In progress

turn: 3
- Phase: Testing
- Action: Added unit tests, all passing
- Status: OK

turn: N
- Phase: Complete
- Status: Done
- Files: ./backend/api/, ./backend/tests/
```

The dashboard will read this file and show:
- Turn count
- Current status (running, completed, blocked)
- Latest activity in the activity feed

---

## Environment Variables

Your orchestrator script might pass:

| Variable | Example | Usage |
|----------|---------|-------|
| `AGENT_NAME` | `backend` | Identify yourself |
| `SESSION_ID` | `session-20260128-143022` | Group related work |
| `WORKSPACE` | `./backend` | Where to write files |
| `TASK` | `"Implement JWT auth API"` | What to do |

Access via:
```bash
echo $AGENT_NAME
echo $SESSION_ID
cd $WORKSPACE
```

---

## Communication Protocol

### To Other Agents

Leave messages in `.gemini/antigravity/brain/`:

```bash
# Example: Backend informs Frontend of API contract
cat > .gemini/antigravity/brain/api-contract.md << 'EOF'
# Backend API Contract

## Authentication
- POST /api/auth/login
- Body: {"email": "...", "password": "..."}
- Response: {"token": "jwt...", "user": {...}}

## Frontend should call this endpoint in LoginForm.tsx
EOF
```

### To the Orchestrator

Update your result file when:
- You're **blocked** and need intervention
- You're **done** and ready for next phase
- You've **discovered changes** to the plan

---

## Best Practices

1. **Write code incrementally** — Commit progress files frequently, not just at the end
2. **Reference other agents' work** — Check `.gemini/antigravity/brain/` before starting
3. **Test thoroughly** — Don't deliver untested code
4. **Document your changes** — Help others understand what you did
5. **Handle errors gracefully** — Report them clearly, don't hide them
6. **Follow domain standards** — Use the tech stack and patterns already established
7. **Communicate proactively** — Don't wait for someone to ask; update your progress file regularly

---

## Example: Full Backend Agent Run

```bash
# You're spawned as backend-agent

# 1. Set up
export AGENT_NAME=backend
export SESSION_ID=session-20260128-143022
export WORKSPACE=./backend
cd $WORKSPACE

# 2. Start progress tracking
mkdir -p .serena/memories
cat > .serena/memories/progress-backend.md << 'EOF'
## Backend Agent Progress
session: session-20260128-143022
turn: 1
- Starting: Implement JWT auth API
- Status: In progress
EOF

# 3. Check others' work
cat .gemini/antigravity/brain/plan.md
cat .gemini/antigravity/brain/frontend-contract.md  # if exists

# 4. Implement
# - Create API endpoints
# - Write tests
# - Document changes

# 5. Update progress (each turn)
# ... (continue documenting turns)

# 6. Final result
cat > .serena/memories/result-backend.md << 'EOF'
## Backend Agent Result
status: completed
turn: 5
- Implemented 5 API endpoints
- JWT authentication working
- 12 tests passing (100% coverage)
- Ready for frontend integration
EOF

# 7. Announce completion
echo "✅ Backend Agent completed - JWT auth API ready"
```

---

## Questions?

If something is unclear:
1. Check your task description again
2. Look at `.gemini/antigravity/brain/` for context
3. Review similar task results in `.serena/memories/result-*.md`
4. Update your progress file with the blocker and let the orchestrator know

---

**You are an expert agent. Execute with precision, communicate constantly, and deliver quality.**
