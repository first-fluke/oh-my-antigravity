# Execution Protocol (Codex)

When running as a CLI subagent, follow this protocol for shared state coordination.

## User questions

Follow the [Clarification Protocol](../../core/clarification-protocol.md). Prefer `request_user_input_async` when exposed and permitted by the current session. If unavailable, use a permitted question tool or a concise plain-text question. Respect mode restrictions: do not call a Plan-only tool in another mode or use a tool for approval when its contract forbids it. Subagents report missing information to their coordinator under the shared result contract; the coordinator asks the user when needed.

## State Management

Use native file tools for coordination notes under `.agents/state/memories/` at the project root. Human-facing reports may live under `.agents/results/`. Completion follows [the shared result contract](../result-contract.md); neither location alone proves completion.

### Path Resolution (CRITICAL)

All result, progress, and state files MUST be written to the **project root** `.agents/state/memories/` directory, never to a subdirectory's `.agents/state/memories/`.

- **Project root** = the git repository root (where `.git` exists)
- **Session-scoped naming**: when running under an orchestration session, append session ID as suffix:
  - `result-{agent-id}-{sessionId}.md` (e.g., `result-frontend-session-20260405-100835.md`)
  - `progress-{agent-id}-{sessionId}.md`
- **Manual (non-orchestrated) runs**: no suffix, `result-{agent-id}.md`

## Lifecycle and results

Follow [Execution Policy](../../core/execution-policy.md) and [Agent Result Contract](../result-contract.md). The task-specific injected run ID and result path are authoritative for this dispatch. Keep coordination notes in the project-root memory store; the structured receipt determines completion.

Read an existing task board when assigned one. Report progress for long tasks. Include unresolved work even on failure. For read-only dispatch, return the injected stdout JSON contract instead of writing files.
