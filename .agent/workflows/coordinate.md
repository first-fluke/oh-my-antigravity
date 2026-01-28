---
description: Coordinate multiple agents for a complex multi-domain project using PM planning, parallel agent spawning, and QA review
---

1. Analyze Requirements
   Read the user's request and identify which domains are involved (frontend, backend, mobile, QA). If only one domain, suggest using the specific agent directly instead of this workflow.

2. Run PM Agent for Task Decomposition
   // turbo
   Activate PM Agent to analyze requirements, define API contracts, and create a prioritized task breakdown. Save plan to `.agent/plan.json`.

3. Review Plan with User
   Present the PM Agent's task breakdown to the user. Confirm priorities, agent assignments, and dependencies before spawning agents.

4. Spawn Agents by Priority Tier
   Guide the user to Agent Manager (Mission Control):
   - Open Agent Manager panel
   - Click 'New Agent' for each task
   - Select the matching skill and paste the task description
   - Spawn all same-priority-tier tasks in parallel
   - Assign separate workspaces to avoid file conflicts

5. Monitor Agent Progress
   Watch Agent Manager inbox for questions. Verify API contracts align between agents. Check `.gemini/antigravity/brain/` for consistency across outputs.

6. Run QA Agent Review
   After all implementation agents complete, spawn QA Agent to review all deliverables. QA checks: security (OWASP Top 10), performance, accessibility (WCAG 2.1 AA), code quality.

7. Address Issues and Iterate
   If QA finds CRITICAL or HIGH issues, re-spawn the responsible agent with the QA findings. Repeat steps 5-7 until all critical issues are resolved.
