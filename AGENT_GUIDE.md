# Agent Integration Instructions

**READ THIS IF**: You are an agent tasked with integrating Antigravity Multi-Agent Skills into an existing project.

---

## Your Task

Integrate the Antigravity Multi-Agent Skills repository into the user's existing project **safely and non-destructively**.

Result: The user can use all 8 skills in their Antigravity IDE, with optional real-time dashboards.

---

## Pre-Execution Checklist

Before you start, verify:

- [ ] User has an existing Antigravity project
- [ ] User has git initialized in their project
- [ ] User has Node.js installed (for optional dashboards)
- [ ] You have read-access to this repository
- [ ] You understand: do NOT overwrite existing files without permission

---

## Step 1: Prepare

**1.1 Ask the user:**
```
"I'll integrate Antigravity Multi-Agent Skills into your project.
- Do you want ONLY the skills? (recommended if you have existing skills)
- Or skills + real-time dashboards?
- Any existing skills I should know about?"
```

**1.2 If they don't answer, default to:**
- Skills only (safer)
- No dashboards (can add later)

**1.3 Create a backup:**
```bash
cd /path/to/user-project
git status  # verify repo is clean
git commit -am "backup: before integrating Antigravity Multi-Agent Skills"
```

If commit fails (dirty working directory):
```
STOP. Ask user to commit/stash changes first.
```

---

## Step 2: Copy Skills (Safe Method)

Navigate to project:
```bash
cd /path/to/user-project
mkdir -p .agent/skills
```

Copy workflows, shared resources, and each skill individually (this prevents overwriting):
```bash
REPO="/tmp/mimic-skills"  # temp clone location

# Copy workflows (user-triggered /commands)
mkdir -p .agent/workflows
if [ -d ".agent/workflows" ] && [ "$(ls -A .agent/workflows 2>/dev/null)" ]; then
  echo "⚠️  workflows/ already has files. Keeping existing."
else
  cp -r "$REPO/.agent/workflows/"* ".agent/workflows/"
  echo "✅ Copied workflows (/coordinate, /orchestrate, /plan, /review, /debug)"
fi

# Copy shared resources first (required by all skills)
if [ -d ".agent/skills/_shared" ]; then
  echo "⚠️  _shared/ already exists. Keeping existing."
else
  cp -r "$REPO/.agent/skills/_shared" ".agent/skills/_shared"
  echo "✅ Copied _shared/ (common resources)"
fi

# Copy 8 core skills
for skill in workflow-guide pm-agent frontend-agent backend-agent mobile-agent qa-agent debug-agent orchestrator; do
  if [ -d ".agent/skills/$skill" ]; then
    echo "⚠️  Skill '$skill' already exists. Keeping existing."
  else
    cp -r "$REPO/.agent/skills/$skill" ".agent/skills/$skill"
    echo "✅ Copied $skill"
  fi
done
```

**Verification:**
```bash
ls -1 .agent/skills/
# Should show: _shared, backend-agent, debug-agent, frontend-agent, mobile-agent,
#              orchestrator, pm-agent, qa-agent, workflow-guide
```

If any skill is missing, inform user:
```
"Could not copy skill {name}. Check if repository is accessible."
```

---

## Step 3: Update .gitignore

Check if `.serena/memories/` rules exist:
```bash
grep -q ".serena/memories" .gitignore
```

If NOT present, add them:
```bash
cat >> .gitignore << 'EOF'

# Serena Memory (runtime orchestrator state)
.serena/memories/*
!.serena/memories/.gitkeep
EOF
```

Create the directory:
```bash
mkdir -p .serena/memories
touch .serena/memories/.gitkeep
```

---

## Step 4: Update package.json (If User Wants Dashboards)

Ask user:
```
"Do you want real-time monitoring dashboards? (optional, requires npm install)"
```

If YES, proceed. If NO, skip to Step 5.

**4.1 Add dependencies:**
```bash
npm install chokidar@^4.0.0 ws@^8.18.0
```

**4.2 Update `package.json` scripts:**

Read current package.json:
```bash
cat package.json | grep -A 5 '"scripts"'
```

If `dashboard` or `dashboard:web` scripts already exist, skip to Step 5.

Otherwise, add to `scripts` section:
```json
"dashboard": "bash scripts/dashboard.sh",
"dashboard:web": "node scripts/dashboard-web/server.js"
```

**Verification:**
```bash
npm run dashboard:web --help 2>&1 | head -3
# Should show help output without errors
```

---

## Step 5: Copy Dashboard Scripts (If User Wants Them)

If user chose NO dashboards in Step 4, skip this.

If YES, proceed:

```bash
REPO="/tmp/mimic-skills"
mkdir -p ./scripts

# Copy terminal dashboard
cp "$REPO/scripts/dashboard.sh" "./scripts/dashboard.sh"
chmod +x "./scripts/dashboard.sh"

# Copy web dashboard
cp -r "$REPO/scripts/dashboard-web" "./scripts/"

echo "✅ Dashboard scripts copied"
```

**Verification:**
```bash
test -f ./scripts/dashboard.sh && test -d ./scripts/dashboard-web && echo "✅ Dashboards ready"
```

---

## Step 6: Verify Integration

**6.1 Check skills and shared resources are in place:**
```bash
find .agent/skills -name "SKILL.md" | wc -l
# Should show: 8

test -d .agent/skills/_shared && echo "✅ _shared/ exists" || echo "⚠️  _shared/ missing"
```

If not 8 skills or `_shared/` is missing, inform user which parts are missing.

**6.2 Check .gitignore doesn't hide skills:**
```bash
git check-ignore .agent/skills/backend-agent/SKILL.md
# Should return NOTHING (blank line = not ignored)
```

If it returns a path, inform user:
```
"ERROR: .gitignore is hiding the skills directory. Please fix manually."
```

**6.3 Verify package.json has correct scripts:**
```bash
grep -q '"dashboard":' package.json && echo "✅ dashboard script found" || echo "⚠️  missing"
grep -q '"dashboard:web":' package.json && echo "✅ dashboard:web script found" || echo "⚠️  missing"
```

---

## Step 7: Commit Changes

```bash
git add .agent/skills .serena/memories .gitignore package.json package-lock.json

git commit -m "feat: Integrate Antigravity Multi-Agent Skills (8 agents)

Integrated skills:
- workflow-guide: Multi-agent orchestration
- pm-agent: Project planning
- frontend-agent: React/Next.js UI
- backend-agent: FastAPI APIs
- mobile-agent: Flutter mobile
- qa-agent: Security & QA
- debug-agent: Bug fixing
- orchestrator: CLI-based sub-agent spawning

Dashboards: $([ -d ./scripts/dashboard-web ] && echo 'enabled' || echo 'disabled')"
```

If commit fails:
```
STOP. Ask user to review git status and resolve conflicts.
```

---

## Step 8: Test Integration

Ask user to:

```bash
cd /path/to/project
antigravity open .
```

Then in Antigravity IDE chat, ask user to type:
```
"Create a simple function that adds two numbers"
```

Expected: frontend-agent or backend-agent activates automatically.

Wait 30 seconds for response. If skills load:
```
"✅ Integration successful! All skills are loaded and working."
```

If no response or error:
```
"⚠️  Skills may not have loaded. Check Antigravity IDE for errors."
```

---

## Troubleshooting During Execution

### Problem: "Permission denied" when copying skills
**Solution:**
```bash
chmod -R u+r "$REPO/.agent/skills"
# Retry copy command
```

### Problem: "git commit" fails (dirty working directory)
**Solution:**
```
Ask user to: git status
Then ask them to commit or stash their changes first.
```

### Problem: Skills were accidentally overwritten
**Solution:**
```bash
# Restore
git checkout .agent/skills/

# Then redo Step 2 with the safe method above
```

### Problem: Package.json merge conflict
**Solution:**
```bash
# Let user resolve manually OR:
git checkout --theirs package.json
# Manually re-add the dashboard scripts
```

### Problem: .gitignore is hiding skills
**Solution:**
```bash
# Check what's hiding them:
git check-ignore -v .agent/skills/backend-agent/SKILL.md

# Remove conflicting line from .gitignore
# Then verify again:
git check-ignore .agent/skills/backend-agent/SKILL.md  # should be blank
```

---

## Success Criteria

Integration is complete when:

- ✅ `.agent/workflows/` contains 5 workflows (coordinate, orchestrate, plan, review, debug)
- ✅ `_shared/` common resources exist in `.agent/skills/_shared/`
- ✅ All 8 skills exist in `.agent/skills/`
- ✅ Each skill has `SKILL.md` and `resources/` directory
- ✅ `.serena/memories/` directory created with `.gitkeep`
- ✅ `.gitignore` includes Serena Memory rules
- ✅ `package.json` has `dashboard` and `dashboard:web` scripts (if dashboards enabled)
- ✅ All changes committed to git
- ✅ User can open project in Antigravity IDE
- ✅ At least one skill activates in Antigravity chat

---

## Post-Integration Notes

After successful integration, inform user:

```
✅ Integration Complete!

What's next:
1. Chat in Antigravity IDE to use skills automatically
2. For complex projects, use Agent Manager to spawn multiple agents
3. To monitor CLI execution, run: npm run dashboard:web
4. Edit .agent/skills/*/SKILL.md to customize for your tech stack
5. See README.md for detailed usage and troubleshooting

Skill Architecture:
- Each skill: SKILL.md (~40 lines) + resources/ (on-demand)
- _shared/: Common resources (reasoning templates, verify.sh, lessons-learned, etc.)
- ~75% token savings vs monolithic SKILL.md files

Documentation:
- README.md: Project overview
- USAGE.md: How to use the skills
- AGENT_GUIDE.md: Integration guide (this file)

Your project now has professional multi-agent capabilities!
```

---

## Important Reminders

- **Never overwrite** existing files without confirmation
- **Always backup first** with git commit
- **Test after integration** in Antigravity IDE
- **Copy individually**, not entire directories
- **If something breaks**, git allows easy rollback to the backup commit
