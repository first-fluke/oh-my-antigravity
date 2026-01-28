# How to Use Antigravity Multi-Agent Skills

## Quick Start

1. **Open in Antigravity IDE**
   ```bash
   antigravity open /path/to/subagent-orchestrator
   ```

2. **Skills are automatically detected.** Antigravity scans `.agent/skills/` and indexes all available skills.

3. **Chat in the IDE.** Describe what you want to build.

---

## Usage Examples

### Example 1: Simple Single-Domain Task

**You type:**
```
"Create a login form component with email and password fields using Tailwind CSS"
```

**What happens:**
- Antigravity detects this matches `frontend-agent`
- The skill loads automatically (Progressive Disclosure)
- You get a React component with TypeScript, Tailwind, form validation

### Example 2: Complex Multi-Domain Project

**You type:**
```
"Build a TODO app with user authentication"
```

**What happens:**

1. **Workflow Guide activates** — detects multi-domain complexity
2. **PM Agent plans** — creates task breakdown with priorities
3. **You spawn agents** in Agent Manager UI:
   - Backend Agent: JWT authentication API
   - Frontend Agent: Login and TODO UI
4. **Agents work in parallel** — save outputs to Knowledge Base
5. **You coordinate** — review `.gemini/antigravity/brain/` for consistency
6. **QA Agent reviews** — security/performance audit
7. **Fix & iterate** — re-spawn agents with corrections

### Example 3: Bug Fixing

**You type:**
```
"There's a bug — clicking login shows 'Cannot read property map of undefined'"
```

**What happens:**

1. **debug-agent activates** — analyzes error
2. **Root cause found** — component maps over `todos` before data loads
3. **Fix provided** — loading states and null checks added
4. **Regression test written** — ensures bug won't return
5. **Similar patterns found** — proactively fixes 3 other components

### Example 4: CLI-based Parallel Execution

```bash
# Single agent
./scripts/spawn-subagent.sh backend "Implement JWT auth API" ./backend

# Parallel agents
./scripts/spawn-subagent.sh backend "Implement auth API" ./backend &
./scripts/spawn-subagent.sh frontend "Create login form" ./frontend &
./scripts/spawn-subagent.sh mobile "Build auth screens" ./mobile &
wait
```

**Monitor in real-time:**
```bash
# Terminal (separate terminal window)
npm run dashboard

# Or browser
npm run dashboard:web
# → http://localhost:9847
```

---

## Real-time Dashboards

### Terminal Dashboard

```bash
npm run dashboard
```

Watches `.serena/memories/` using `fswatch` (macOS) or `inotifywait` (Linux). Displays a live table with session status, agent states, turns, and latest activity. Updates automatically when memory files change.

**Requirements:**
- macOS: `brew install fswatch`
- Linux: `apt install inotify-tools`

### Web Dashboard

```bash
npm install          # first time only
npm run dashboard:web
```

Open `http://localhost:9847` in your browser. Features:

- **Real-time updates** via WebSocket (event-driven, not polling)
- **Auto-reconnect** if the connection drops
- **Serena-themed UI** with purple accent colors
- **Session status** — ID and running/completed/failed state
- **Agent table** — name, status (with colored dots), turn count, task description
- **Activity log** — latest changes from progress and result files

The server watches `.serena/memories/` using chokidar with debounce (100ms). Only changed files trigger reads — no full re-scan.

---

## Key Concepts

### Progressive Disclosure
Antigravity automatically matches requests to skills. You never manually select a skill. Only the needed skill loads into context.

### Token-Optimized Skill Design
Each skill uses a two-layer architecture for maximum token efficiency:
- **SKILL.md** (~40 lines): Identity, routing, core rules — loaded immediately
- **resources/**: Execution protocols, examples, checklists, error playbooks — loaded on-demand

Shared resources live in `_shared/` (not a skill) and are referenced by all agents:
- Chain-of-thought execution protocols with 4-step workflow
- Few-shot input/output examples for mid-tier model guidance
- Error recovery playbooks with "3 strikes" escalation
- Reasoning templates for structured multi-step analysis
- Context budget management for Flash/Pro model tiers
- Automated verification via `verify.sh`
- Cross-session lessons learned accumulation

### Agent Manager UI
Mission Control dashboard in Antigravity IDE. Spawn agents, assign workspaces, monitor via inbox, review artifacts.

### Knowledge Base
Agent outputs stored at `.gemini/antigravity/brain/`. Contains plans, code, reports, and coordination notes.

### Serena Memory
Structured runtime state at `.serena/memories/`. The orchestrator writes session info, task boards, per-agent progress, and results. Dashboards watch these files for monitoring.

### Workspaces
Agents can work in separate directories to avoid conflicts:
```
./backend    → Backend Agent workspace
./frontend   → Frontend Agent workspace
./mobile     → Mobile Agent workspace
```

---

## Available Skills

| Skill | Auto-activates for | Output |
|-------|-------------------|--------|
| workflow-guide | Complex multi-domain projects | Step-by-step agent coordination |
| pm-agent | "plan this", "break down" | `.agent/plan.json` |
| frontend-agent | UI, components, styling | React components, tests |
| backend-agent | APIs, databases, auth | API endpoints, models, tests |
| mobile-agent | Mobile apps, iOS/Android | Flutter screens, state management |
| qa-agent | "review security", "audit" | QA report with prioritized fixes |
| debug-agent | Bug reports, error messages | Fixed code, regression tests |
| orchestrator | CLI sub-agent execution | Results in `.agent/results/` |

---

## Typical Workflows

### Workflow A: Single Skill

```
You: "Create a button component"
  → Antigravity loads frontend-agent
  → Get component immediately
```

### Workflow B: Multi-Agent Project (Auto)

```
You: "Build a TODO app with authentication"
  → workflow-guide activates automatically
  → PM Agent creates plan
  → You spawn agents in Agent Manager
  → Agents work in parallel
  → QA Agent reviews
  → Fix issues, iterate
```

### Workflow B-2: Multi-Agent Project (Explicit)

```
You: /coordinate
  → Step-by-step guided workflow
  → PM planning → plan review → agent spawning → monitoring → QA review
```

### Workflow C: Bug Fixing

```
You: "Login button throws TypeError"
  → debug-agent activates
  → Root cause analysis
  → Fix + regression test
  → Similar patterns checked
```

### Workflow D: CLI Orchestration with Dashboard

```
Terminal 1: npm run dashboard:web
Terminal 2: ./scripts/spawn-subagent.sh backend "task" ./backend &
            ./scripts/spawn-subagent.sh frontend "task" ./frontend &
Browser:    http://localhost:9847 → real-time status
```

---

## Tips

1. **Be specific** — "Build a TODO app with JWT auth, React frontend, FastAPI backend" is better than "make an app"
2. **Use Agent Manager** for multi-domain projects — don't try to do everything in one chat
3. **Review Knowledge Base** — check `.gemini/antigravity/brain/` for API consistency
4. **Iterate with re-spawns** — refine instructions, don't start over
5. **Use dashboards** — `npm run dashboard` or `npm run dashboard:web` to monitor orchestrator sessions
6. **Separate workspaces** — assign each agent its own directory

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Skills not loading | `antigravity open .`, check `.agent/skills/`, restart IDE |
| Agent Manager not found | View → Agent Manager menu, requires Antigravity 2026+ |
| Incompatible agent outputs | Review both in Knowledge Base, re-spawn with corrections |
| Dashboard: "No agents" | Memory files not created yet, run orchestrator first |
| Web dashboard won't start | Run `npm install` to install chokidar and ws |
| fswatch not found | macOS: `brew install fswatch`, Linux: `apt install inotify-tools` |
| QA report has 50+ issues | Focus on CRITICAL/HIGH first, document rest for later |

---

## npm Scripts

```bash
npm run dashboard       # Terminal real-time dashboard
npm run dashboard:web   # Web dashboard → http://localhost:9847
npm run validate        # Validate skill files
npm run info            # Show this usage guide
```

---

## For Developers (Integration Guide)

If you want to integrate these skills into your existing Antigravity project, see [AGENT_GUIDE.md](./AGENT_GUIDE.md) for:
- Quick 3-step integration
- Full dashboard integration
- Customizing skills for your tech stack
- Troubleshooting and best practices

---

**Just chat in Antigravity IDE.** For monitoring, use the dashboards. For CLI execution, use the orchestrator scripts. To integrate into your existing project, see [AGENT_GUIDE.md](./AGENT_GUIDE.md).
