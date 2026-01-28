# Antigravity Multi-Agent Skills

Professional agent skills for Google Antigravity IDE featuring specialized PM, Frontend, Backend, Mobile, QA, and Debug agents — coordinated through Antigravity's Agent Manager, CLI-based SubAgent Orchestrator, and real-time Serena Memory dashboards.

## What Is This?

A collection of **Antigravity Skills** enabling collaborative multi-agent development. Work is distributed across expert agents:

| Agent | Specialization |
|-------|---------------|
| **Workflow Guide** | Coordinates complex multi-agent projects |
| **PM Agent** | Requirements analysis, task decomposition, architecture |
| **Frontend Agent** | React/Next.js, TypeScript, Tailwind CSS |
| **Backend Agent** | FastAPI, PostgreSQL, JWT authentication |
| **Mobile Agent** | Flutter cross-platform development |
| **QA Agent** | OWASP Top 10 security, performance, accessibility |
| **Debug Agent** | Bug diagnosis, root cause analysis, regression tests |
| **Orchestrator** | CLI-based parallel agent execution with Serena Memory |

## Quick Start

### 1. Clone & Open

```bash
git clone <repository-url>
cd subagent-orchestrator
antigravity open .
```

Antigravity automatically detects skills in `.agent/skills/`.

### Using with Existing Projects

If you already have an Antigravity project, just copy the skills:

```bash
# Option 1: Skills only
cp -r subagent-orchestrator/.agent/skills /path/to/your-project/.agent/

# Option 2: Skills + dashboards
cp -r subagent-orchestrator/.agent/skills /path/to/your-project/.agent/
cp -r subagent-orchestrator/scripts/dashboard* /path/to/your-project/scripts/
cp subagent-orchestrator/package.json /path/to/your-project/  # merge dependencies

# Option 3: Specific skills only
cp -r subagent-orchestrator/.agent/skills/backend-agent /path/to/your-project/.agent/skills/
cp -r subagent-orchestrator/.agent/skills/frontend-agent /path/to/your-project/.agent/skills/
```

Then in your project:
```bash
cd /path/to/your-project
npm install  # if using dashboards
antigravity open .
```

All skills are now available in your project!

### 2. Chat

**Simple task** (single agent auto-activates):
```
"Create a login form with Tailwind CSS and form validation"
→ frontend-agent activates
```

**Complex project** (workflow-guide coordinates):
```
"Build a TODO app with user authentication"
→ workflow-guide → PM Agent plans → agents spawned in Agent Manager
```

**Explicit coordination** (user-triggered workflow):
```
/coordinate
→ Step-by-step: PM planning → agent spawning → QA review
```

### 3. Monitor with Dashboards

```bash
# Terminal dashboard (real-time)
npm run dashboard

# Web dashboard (browser UI)
npm run dashboard:web
# → http://localhost:9847
```

## How It Works

### Progressive Disclosure

You don't manually select skills. Antigravity automatically:
1. Scans your chat request
2. Matches against skill descriptions in `.agent/skills/`
3. Loads the relevant skill only when needed
4. Saves tokens via lazy loading

### Agent Manager UI

For complex projects, use Antigravity's **Agent Manager** (Mission Control):
1. PM Agent creates a plan
2. You spawn agents in the Agent Manager UI
3. Agents work in parallel with separate workspaces
4. Monitor progress via inbox notifications
5. QA Agent reviews the final output

### SubAgent Orchestrator (CLI)

For programmatic parallel execution:

```bash
# Single agent
./scripts/spawn-subagent.sh backend "Implement auth API" ./backend

# Parallel agents via orchestrator skill
./scripts/spawn-subagent.sh backend "Implement auth API" ./backend &
./scripts/spawn-subagent.sh frontend "Create login form" ./frontend &
wait
```

Supports multiple CLI vendors: **Gemini**, **Claude**, **Codex**, **Qwen**

### Serena Memory Coordination

The Orchestrator writes structured state to `.serena/memories/`:

| File | Purpose |
|------|---------|
| `orchestrator-session.md` | Session ID, status, phase |
| `task-board.md` | Agent assignments and status table |
| `progress-{agent}.md` | Per-agent turn-by-turn progress |
| `result-{agent}.md` | Completion results per agent |

Both dashboards watch these files for real-time monitoring.

## Real-time Dashboards

### Terminal Dashboard

```bash
npm run dashboard
# or directly:
scripts/dashboard.sh
```

Uses `fswatch` (macOS) / `inotifywait` (Linux) to watch `.serena/memories/` and render a live status table:

```
╔════════════════════════════════════════════════════════╗
║  Serena Memory Dashboard                              ║
║  Session: session-20260128-143022 [RUNNING]           ║
╠════════════════════════════════════════════════════════╣
║  Agent        Status        Turn   Task               ║
║  ──────────   ──────────    ────   ──────────         ║
║  backend      ● running      12   JWT Auth API        ║
║  frontend     ✓ completed    18   Login UI            ║
║  qa           ○ blocked       -   Security Review     ║
╠════════════════════════════════════════════════════════╣
║  Latest Activity:                                     ║
║  [backend] Turn 12 - Added tests and rate limit       ║
║  [frontend] Completed - All criteria met              ║
╠════════════════════════════════════════════════════════╣
║  Updated: 2026-01-28 14:32:05  |  Ctrl+C to exit     ║
╚════════════════════════════════════════════════════════╝
```

### Web Dashboard

```bash
npm install        # first time only (installs chokidar, ws)
npm run dashboard:web
# → http://localhost:9847
```

Features:
- Real-time WebSocket push (no polling)
- Auto-reconnect on disconnection
- Purple Serena-themed UI
- Session status, agent table, activity log
- Event-driven file watching via chokidar (cross-platform)

## Project Structure

```
.
├── .agent/
│   ├── workflows/
│   │   └── coordinate.md           # /coordinate command (multi-agent orchestration)
│   └── skills/
│       ├── _shared/                    # Common resources (not a skill)
│       │   ├── serena-memory-protocol.md
│       │   ├── common-checklist.md
│       │   ├── skill-routing.md
│       │   ├── context-loading.md
│       │   ├── context-budget.md
│       │   ├── reasoning-templates.md
│       │   ├── clarification-protocol.md
│       │   ├── difficulty-guide.md
│       │   ├── lessons-learned.md
│       │   ├── verify.sh
│       │   └── api-contracts/
│       ├── workflow-guide/             # Multi-agent coordination
│       ├── pm-agent/                   # Product manager
│       ├── frontend-agent/             # React/Next.js
│       ├── backend-agent/              # FastAPI
│       ├── mobile-agent/               # Flutter
│       ├── qa-agent/                   # Security & QA
│       ├── debug-agent/                # Bug fixing
│       └── orchestrator/               # CLI-based sub-agent spawner
│       # Each skill has:
│       #   SKILL.md              (~40 lines, token-optimized)
│       #   resources/
│       #     ├── execution-protocol.md  (chain-of-thought steps)
│       #     ├── examples.md            (few-shot input/output)
│       #     ├── checklist.md           (self-verification)
│       #     ├── error-playbook.md      (failure recovery)
│       #     ├── tech-stack.md          (detailed tech specs)
│       #     └── snippets.md           (copy-paste patterns)
├── .serena/
│   └── memories/                   # Runtime state (gitignored)
├── scripts/
│   ├── dashboard.sh                # Terminal dashboard
│   ├── dashboard-web/
│   │   ├── server.js               # Web dashboard server
│   │   └── public/index.html       # Web dashboard UI
│   ├── spawn-subagent.sh           # Sub-agent spawner
│   └── poll-status.sh              # Status polling
├── package.json
├── README.md                       # This file (English)
├── README-ko.md                    # Korean guide
└── USAGE.md                        # Detailed usage guide
```

## Skill Architecture

Each skill uses a **token-optimized two-layer design**:

- **SKILL.md** (~40 lines): Loaded immediately by Antigravity. Contains only identity, routing conditions, and core rules.
- **resources/**: Loaded on-demand. Contains execution protocols, few-shot examples, checklists, error playbooks, code snippets, and tech stack details.

This achieves **~75% token savings** on initial skill loading (3-7KB → ~800B per skill).

### Shared Resources (`_shared/`)

Common resources deduplicated across all skills:

| Resource | Purpose |
|----------|---------|
| `reasoning-templates.md` | Structured fill-in-the-blank templates for multi-step reasoning |
| `clarification-protocol.md` | When to ask vs. assume, ambiguity levels |
| `context-budget.md` | Token-efficient file reading strategies per model tier |
| `context-loading.md` | Task-type to resource mapping for orchestrator prompt construction |
| `skill-routing.md` | Keyword-to-skill mapping and parallel execution rules |
| `difficulty-guide.md` | Simple/Medium/Complex assessment with protocol branching |
| `lessons-learned.md` | Cross-session accumulated domain gotchas |
| `verify.sh` | Automated verification script run after agent completion |
| `api-contracts/` | PM creates contracts, backend implements, frontend/mobile consumes |
| `serena-memory-protocol.md` | CLI mode memory read/write protocol |
| `common-checklist.md` | Universal code quality checks |

### Per-Skill Resources

Each skill provides domain-specific resources:

| Resource | Purpose |
|----------|---------|
| `execution-protocol.md` | 4-step chain-of-thought workflow (Analyze → Plan → Implement → Verify) |
| `examples.md` | 2-3 few-shot input/output examples |
| `checklist.md` | Domain-specific self-verification checklist |
| `error-playbook.md` | Failure recovery with "3 strikes" escalation rule |
| `tech-stack.md` | Detailed technology specifications |
| `snippets.md` | Copy-paste ready code patterns |

## Skills Overview

### workflow-guide
**Triggers**: Complex multi-domain requests
**Does**: Guides coordination of PM, Frontend, Backend, Mobile, QA agents

### pm-agent
**Triggers**: "plan this", "break down", "what should we build"
**Output**: `.agent/plan.json` with tasks, priorities, dependencies

### frontend-agent
**Triggers**: UI, components, styling, client-side logic
**Stack**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui

### backend-agent
**Triggers**: APIs, databases, authentication
**Stack**: FastAPI, SQLAlchemy, PostgreSQL, Redis, JWT

### mobile-agent
**Triggers**: Mobile apps, iOS/Android
**Stack**: Flutter 3.19+, Dart, Riverpod

### qa-agent
**Triggers**: "review security", "check performance", "audit"
**Checks**: OWASP Top 10, Lighthouse, WCAG 2.1 AA

### debug-agent
**Triggers**: Bug reports, error messages, crashes
**Output**: Fixed code, regression tests, bug documentation

### orchestrator
**Triggers**: Programmatic sub-agent execution
**CLIs**: Gemini, Claude, Codex, Qwen (configurable)

## Prerequisites

- **Google Antigravity** (2026+)
- **Node.js** (for web dashboard)
- **fswatch** (macOS) or **inotify-tools** (Linux) for terminal dashboard

For SubAgent Orchestrator, at least one CLI tool:

| CLI | Install | Auth |
|-----|---------|------|
| Gemini | `npm i -g @anthropic-ai/gemini-cli` | `gemini auth` |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude auth` |
| Codex | `npm i -g @openai/codex` | `codex auth` |
| Qwen | `pip install qwen-cli` | `qwen auth` |

## npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dashboard` | `bash scripts/dashboard.sh` | Terminal real-time dashboard |
| `npm run dashboard:web` | `node scripts/dashboard-web/server.js` | Web dashboard on port 9847 |
| `npm run validate` | `node scripts/validate-skills.js` | Validate skill files |
| `npm run info` | `cat USAGE.md` | Show usage guide |

## Troubleshooting

### Dashboard shows "No agents detected"
Memory files haven't been created yet. Run the orchestrator or manually create files in `.serena/memories/`.

### Web dashboard won't start
Run `npm install` first to install `chokidar` and `ws` dependencies.

### Terminal dashboard: "fswatch not found"
macOS: `brew install fswatch`
Linux: `apt install inotify-tools`

### Skills not loading in Antigravity
1. Open project with `antigravity open .`
2. Verify `.agent/skills/` folder and `SKILL.md` files exist
3. Restart Antigravity IDE

### Agents producing incompatible code
1. Review outputs in `.gemini/antigravity/brain/`
2. Re-spawn one agent referencing the other's output
3. Use QA Agent for final consistency check

## License

MIT

## Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [README.md](./README.md) | Users | Project overview (English) |
| [README-ko.md](./README-ko.md) | Users | Project overview (Korean) |
| [USAGE.md](./USAGE.md) | Users | How to use the skills (English) |
| [USAGE-ko.md](./USAGE-ko.md) | Users | How to use the skills (Korean) |
| [AGENT_GUIDE.md](./AGENT_GUIDE.md) | Developers | **How to integrate into your existing project** |

---

**Built for Google Antigravity 2026** | **New to this project?** Start with [AGENT_GUIDE.md](./AGENT_GUIDE.md) to integrate into your existing project
