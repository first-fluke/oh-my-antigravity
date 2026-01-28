# Antigravity Multi-Agent Skills

Professional agent skills for Google Antigravity IDE featuring specialized PM, Frontend, Backend, Mobile, QA, and Debug agents that work together seamlessly through Antigravity's Agent Manager.

## What Is This?

This is a **collection of specialized Antigravity Skills** that enable collaborative multi-agent development workflows. Instead of a single AI doing everything, work is distributed across expert agents:

- **Workflow Guide**: Coordinates complex multi-agent projects
- **PM Agent**: Requirements analysis, task decomposition, architecture planning
- **Frontend Agent**: React/Next.js UI implementation, TypeScript, Tailwind CSS
- **Backend Agent**: FastAPI APIs, database design, JWT authentication
- **Mobile Agent**: Flutter cross-platform mobile development
- **QA Agent**: Security audits (OWASP Top 10), performance testing, accessibility (WCAG 2.1 AA)
- **Debug Agent**: Bug diagnosis, root cause analysis, fixes with regression tests

## How It Works

### Progressive Disclosure (Automatic Skill Loading)

You **don't** manually select skills. Antigravity automatically:
1. Scans your chat request
2. Matches it against skill descriptions in `.agent/skills/`
3. Loads the relevant skill into context **only when needed**
4. Saves tokens by loading just the skill metadata until required

### Agent Manager UI (Parallel Execution)

For complex projects, use Antigravity's **Agent Manager** (Mission Control dashboard):
1. Spawn multiple agents working on different tasks
2. Assign each agent its own workspace
3. Monitor progress via inbox notifications
4. Coordinate integration using Knowledge Base outputs

### SubAgent Orchestrator (CLI-based Parallel Execution)

For programmatic sub-agent execution, use the **orchestrator** skill with CLI tools:

```bash
# Single agent
./scripts/spawn-agent.sh backend "Implement auth API" ./backend

# Parallel agents
./scripts/parallel-run.sh --inline \
  "backend:Implement auth API" \
  "frontend:Create login form"
```

Supports multiple CLI vendors: **Gemini**, **Claude**, **Codex**, **Qwen**

## Quick Start

### 1. Installation

```bash
# Clone this repository
git clone <repository-url>
cd subagent-orchestrator

# Open in Antigravity IDE
antigravity open .
```

That's it! Antigravity automatically detects skills in `.agent/skills/`.

### 2. Usage

Just **chat in Antigravity IDE**:

**Simple request** (single skill):
```
"Create a login form component with Tailwind CSS and form validation"
```
→ frontend-agent automatically activates

**Complex request** (multiple skills):
```
"Build a TODO app with user authentication"
```
→ workflow-guide activates and guides you through multi-agent orchestration

### 3. For Complex Projects: Use Agent Manager

The workflow-guide will instruct you:

1. **PM Agent plans** → Creates task breakdown
2. **You spawn agents in Agent Manager**:
   - Backend Agent (auth API)
   - Frontend Agent (login UI)
   - Mobile Agent (if needed)
3. **Agents work in parallel** → Save outputs to Knowledge Base
4. **You coordinate** → Review `.gemini/antigravity/brain/` for integration
5. **QA Agent reviews** → Final security/performance audit

See [USAGE.md](./USAGE.md) for detailed examples and workflows.

## Architecture

```
User in Antigravity IDE Chat
       ↓
[Progressive Disclosure matches request to skills]
       ↓
Simple task? → Single Agent (Frontend/Backend/Mobile/QA)
       ↓
Complex task? → Workflow Guide activated
       ↓
┌─────────────────────────────────────┐
│     Workflow Guide (coordinates)    │
└─────────────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│  PM Agent (creates plan)            │
│  Output: .agent/plan.json           │
└─────────────────────────────────────┘
       ↓
User spawns agents in Agent Manager UI:
       ↓
┌──────────┬──────────┬──────────┐
│ Backend  │ Frontend │  Mobile  │  ← Work in parallel
│  Agent   │  Agent   │  Agent   │
└──────────┴──────────┴──────────┘
       ↓
All outputs → .gemini/antigravity/brain/
       ↓
┌─────────────────────────────────────┐
│  QA Agent (final review)            │
│  Output: qa-report.md               │
└─────────────────────────────────────┘
       ↓
User fixes critical issues → Re-spawn agents
```

## Project Structure

```
.
├── .agent/
│   ├── skills/                     # Antigravity Skills (auto-detected)
│   │   ├── workflow-guide/         # Multi-agent coordination guide
│   │   │   └── SKILL.md
│   │   ├── pm-agent/               # Product manager
│   │   │   ├── SKILL.md
│   │   │   └── resources/task-template.json
│   │   ├── frontend-agent/         # React/Next.js specialist
│   │   │   ├── SKILL.md
│   │   │   └── resources/
│   │   ├── backend-agent/          # FastAPI specialist
│   │   │   ├── SKILL.md
│   │   │   └── resources/
│   │   ├── mobile-agent/           # Flutter specialist
│   │   │   ├── SKILL.md
│   │   │   └── resources/
│   │   ├── qa-agent/               # Security & QA specialist
│   │   │   ├── SKILL.md
│   │   │   └── resources/checklist.md
│   │   ├── debug-agent/            # Bug fixing specialist
│   │   │   ├── SKILL.md
│   │   │   └── resources/
│   │   │       ├── debugging-checklist.md
│   │   │       ├── bug-report-template.md
│   │   │       └── common-patterns.md
│   │   └── orchestrator/           # SubAgent spawner (CLI-based)
│   │       ├── SKILL.md
│   │       ├── scripts/
│   │       │   ├── spawn-agent.sh      # Single agent execution
│   │       │   └── parallel-run.sh     # Parallel execution
│   │       ├── config/
│   │       │   └── cli-config.yaml     # CLI vendor settings
│   │       └── templates/              # Task templates per agent
│   ├── results/                    # SubAgent execution results
│   ├── mcp.json                    # Serena MCP config (optional)
│   └── plan.json                   # Generated by PM Agent (runtime)
├── .gemini/
│   └── antigravity/
│       └── brain/                  # Knowledge Base (agent outputs)
├── .gitignore
├── package.json
├── README.md                       # This file
└── USAGE.md                        # Detailed usage guide
```

## Skills Overview

### workflow-guide
**Activates when**: Complex multi-domain requests
**Purpose**: Guides you through coordinating PM, Frontend, Backend, Mobile, and QA agents using Agent Manager
**Output**: Step-by-step instructions for spawning and coordinating agents

### pm-agent
**Activates when**: "plan this project", "break down", "what should we build"
**Tech expertise**: Architecture, tech stack selection, task decomposition
**Output**: JSON plan with tasks, priorities, dependencies, API contracts

### frontend-agent
**Activates when**: UI/UX work, components, styling
**Tech stack**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, React Query
**Output**: React components, tests, Storybook stories

### backend-agent
**Activates when**: APIs, databases, authentication, server logic
**Tech stack**: FastAPI, SQLAlchemy, PostgreSQL, Redis, JWT
**Output**: API endpoints, database models, tests, OpenAPI documentation

### mobile-agent
**Activates when**: Mobile apps, iOS/Android
**Tech stack**: Flutter 3.19+, Dart, Riverpod
**Output**: Screens, navigation, state management, platform-specific code

### qa-agent
**Activates when**: "review security", "check performance", "audit"
**Checks**: OWASP Top 10, performance (Lighthouse, API latency), WCAG 2.1 AA, code quality
**Output**: Comprehensive QA report with prioritized fixes

### debug-agent
**Activates when**: Bug reports, error messages, crashes, unexpected behavior
**Expertise**: Bug diagnosis, root cause analysis, memory leaks, race conditions, performance bugs
**Output**: Fixed code with explanation, regression tests, bug documentation

### orchestrator
**Activates when**: Need programmatic sub-agent execution via CLI
**Supported CLIs**: Gemini, Claude, Codex, Qwen (configurable)
**Scripts**: `spawn-agent.sh` (single), `parallel-run.sh` (parallel)
**Output**: Results in `.agent/results/`

## Usage Examples

### Example 1: Simple Component (Single Agent)

**You**: "Create a user profile card component with avatar, name, and bio using Tailwind"

**What happens**:
- frontend-agent activates automatically
- You get a complete React component with TypeScript and Tailwind
- ✅ Done in < 1 minute

### Example 2: Full-Stack App (Multi-Agent)

**You**: "Build a TODO app with user authentication"

**What happens**:

1. **workflow-guide activates**: "Let me help you orchestrate this..."
2. **PM Agent consulted**: Creates plan with 5 tasks (auth API, login UI, TODO API, TODO UI, QA)
3. **You're guided to Agent Manager**: "Spawn Backend Agent with this task: 'Implement JWT auth API...'"
4. **You spawn 2 agents in parallel** (Backend, Frontend)
5. **Agents work independently**: Save outputs to Knowledge Base
6. **You review & coordinate**: Check `.gemini/antigravity/brain/` for API alignment
7. **QA Agent spawned**: Reviews everything, finds 2 security issues
8. **You fix issues**: Re-spawn Backend Agent with corrections
9. **✅ Done**: Complete, tested, secure application

**Time**: 30-60 minutes | **Agents used**: 5

### Example 3: Bug Fixing (Debug Agent)

**You**: "There's a bug - when I click the login button, I get 'Cannot read property map of undefined'"

**What happens**:

1. **debug-agent activates**: "Let me investigate this error..."
2. **Root cause identified**: TodoList component tries to map over `todos` before data loads
3. **Fix provided**:
   ```typescript
   // Added null checks and loading states
   if (isLoading) return <LoadingSpinner />;
   if (!todos) return <EmptyState />;
   ```
4. **Regression test written**: Ensures bug doesn't return
5. **Similar patterns checked**: Found 3 other components with same issue, fixed proactively
6. **✅ Done**: Bug fixed, tested, documented

**Time**: 10-30 minutes | **Agent used**: debug-agent

### Example 4: SubAgent Orchestrator (CLI-based)

**Scenario**: Run multiple agents in parallel via command line

**Single Agent**:
```bash
cd .agent/skills/orchestrator
./scripts/spawn-agent.sh backend "Implement JWT auth API" ./backend
```

**Parallel Agents**:
```bash
./scripts/parallel-run.sh --inline \
  "backend:Implement auth API" \
  "frontend:Create login form" \
  "mobile:Build auth screens"
```

**With Different CLI Vendor**:
```bash
# Use Claude instead of Gemini
./scripts/spawn-agent.sh backend "Task" ./backend --vendor claude

# Configure default vendor
vim .agent/skills/orchestrator/config/cli-config.yaml
# Change: active_vendor: claude
```

**Results**: Check `.agent/results/` for outputs

## Key Features

### ✅ Native Antigravity Integration
- Uses `.agent/skills/` directory structure (Antigravity standard)
- Progressive Disclosure for efficient token usage
- Agent Manager UI for parallel execution
- Knowledge Base for persistence

### ✅ Production-Ready Code
- **Frontend**: TypeScript strict mode, Tailwind CSS (no inline styles), WCAG 2.1 AA
- **Backend**: JWT auth, bcrypt hashing, rate limiting, input validation (Pydantic)
- **Mobile**: Material Design 3, iOS + Android, clean architecture
- **QA**: OWASP Top 10 audits, Lighthouse scores, security checklists

### ✅ Comprehensive Documentation
- Each skill has detailed SKILL.md with examples
- Resource templates (API template, component template, etc.)
- Best practices and anti-patterns documented
- Troubleshooting guides included

### ✅ Serena MCP Support (Optional)
- Efficient code analysis and modification
- Symbol search and refactoring
- Pattern detection for security audits
- Configured in `.agent/mcp.json`

## Prerequisites

- **Google Antigravity** (2026+) - Download from [antigravity.google/download](https://antigravity.google/download)
- **Antigravity account** - Free tier includes generous Gemini 3 Pro quota
- **Serena MCP** (optional) - For advanced code analysis

### For SubAgent Orchestrator (CLI-based execution)

At least one CLI tool installed and authenticated:

| CLI | Install | Auth |
|-----|---------|------|
| Gemini | `npm i -g @anthropic-ai/gemini-cli` | `gemini auth` |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude auth` |
| Codex | `npm i -g @openai/codex` | `codex auth` |
| Qwen | `pip install qwen-cli` | `qwen auth` |

Configure your preferred CLI in `.agent/skills/orchestrator/config/cli-config.yaml`

## Advanced Usage

### Customizing Skills

Edit any `.agent/skills/*/SKILL.md` to customize behavior:

```markdown
---
name: frontend-agent
description: Your custom description here
---

# Custom instructions
1. Always use Material-UI instead of Tailwind
2. Write tests in Jest, not Vitest
...
```

Antigravity will automatically pick up changes.

### Adding New Skills

Create a new folder in `.agent/skills/`:

```bash
mkdir -p .agent/skills/devops-agent
cat > .agent/skills/devops-agent/SKILL.md << 'EOF'
---
name: devops-agent
description: DevOps specialist for Docker, Kubernetes, CI/CD
---

# DevOps Agent
[Your instructions here]
EOF
```

### Using with Existing Projects

Copy `.agent/` folder to any project:

```bash
cp -r .agent /path/to/your-project/
cd /path/to/your-project
antigravity open .
```

Now your project has access to all these skills!

## Quota & Costs

### Antigravity Free Tier
- Limited Gemini API calls per month
- Skills use Progressive Disclosure to minimize token usage
- Simple tasks (single agent) use minimal quota
- Complex projects (multi-agent) use more but are within free tier for reasonable use

### Antigravity Paid Tier
- Higher monthly quota
- Run larger multi-agent projects
- Faster models available (Gemini 3 Flash for quick tasks)

**Cost Optimization Tips**:
- Be specific in requests to avoid unnecessary skill loading
- Follow PM Agent's plan (don't spawn unnecessary agents)
- Review agent outputs before re-spawning
- Use Gemini 3 Flash for simple tasks, Pro for complex ones

## Troubleshooting

### Skills Not Loading

**Problem**: Antigravity doesn't detect skills

**Solution**:
1. Ensure you opened the project: `antigravity open .`
2. Check `.agent/skills/` folder exists
3. Verify each skill has `SKILL.md` with YAML frontmatter
4. Restart Antigravity IDE

### Agent Manager Not Found

**Problem**: Can't find Agent Manager UI

**Solution**:
- Look for "Mission Control" or "Agent Manager" panel in Antigravity
- Try `View → Agent Manager` menu
- Ensure Antigravity 2026+ (Agent Manager was added in 2026)

### Agents Producing Incompatible Code

**Problem**: Frontend and Backend don't match

**Solution**:
1. Review both outputs in `.gemini/antigravity/brain/`
2. Identify mismatch (e.g., API endpoint differs)
3. Re-spawn one agent with corrected spec
4. Reference other agent's work: "The Backend created POST /api/auth/login, use that exact path"

See [USAGE.md](./USAGE.md) for more troubleshooting tips.

## Contributing

Contributions welcome! Ideas:

- **New agent skills**: Data Science Agent, DevOps Agent, Design Agent
- **Enhanced templates**: More code examples, Storybook stories
- **Better coordination**: Improved workflow-guide instructions
- **Documentation**: More examples, video tutorials

## License

MIT License - see LICENSE file

## Resources

**Official Antigravity**:
- [Antigravity Documentation](https://antigravity.google/docs/skills)
- [Antigravity Skills Codelab](https://codelabs.developers.google.com/getting-started-with-antigravity-skills)
- [Agent Manager Guide](https://antigravity.google/docs/agent-manager)
- [Antigravity Blog: Skills Announcement](https://blog.devgenius.io/google-antigravity-adds-skills-04ab11d8497c)

**This Project**:
- [USAGE.md](./USAGE.md) - Detailed usage guide with examples
- [Skill Documentation](./.agent/skills/) - Individual skill SKILL.md files

**Related**:
- [Serena MCP](https://github.com/oraios/serena) - Code analysis tool
- [Agent Skills Standard](https://laurentkempe.com/2026/01/27/Agent-Skills-From-Claude-to-Open-Standard/) - Open standard adopted by Antigravity

## Support

- **This project**: Open an issue in this repository
- **Antigravity**: Check [antigravity.google/help](https://antigravity.google/help)
- **Serena**: [GitHub Issues](https://github.com/oraios/serena/issues)

---

**Built for Google Antigravity 2026** | Last updated: January 2026

**Note**: This is a skill pack for Antigravity IDE, not a standalone application. Use it by opening this project in Antigravity and chatting in the IDE.
