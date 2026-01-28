---
description: Structured bug diagnosis and fixing workflow — reproduce, diagnose root cause, apply minimal fix, write regression test, and scan for similar patterns
---

# MANDATORY RULES — VIOLATION IS FORBIDDEN

- **All responses MUST be written in Korean (한국어).** Do NOT respond in English.
- **NEVER skip steps.** Execute from Step 1 in order.
- **You MUST use Serena MCP tools throughout the workflow.**
  - Use `find_symbol`, `find_referencing_symbols`, `search_for_pattern` for bug investigation — NOT raw file reads or grep.
  - Use `write_memory` to record debugging results in `.serena/memories/`.
  - Serena MCP is the primary interface for all code exploration.

---

## Step 1: Collect Error Information

Ask the user for:
- Error message, steps to reproduce
- Expected vs actual behavior
- Environment (browser, OS, device)

If an error message is provided, proceed immediately.

---

## Step 2: Reproduce the Bug

// turbo
Use Serena MCP `search_for_pattern` with the error message or stack trace to locate the error in the codebase.
Use `find_symbol` to identify the exact function and file. Do NOT grep or read files manually.

---

## Step 3: Diagnose Root Cause

Use Serena MCP `find_referencing_symbols` to trace the execution path backward from the error point.
Identify the root cause — not just the symptom. Check:
- null/undefined access
- Race conditions
- Missing error handling
- Wrong data types
- Stale state

---

## Step 4: Propose Minimal Fix

Present the root cause and proposed fix to the user.
- The fix should change only what is necessary.
- Explain why this fixes the root cause, not just the symptom.
- **You MUST get user confirmation before proceeding to Step 5.**

---

## Step 5: Apply Fix and Write Regression Test

// turbo
1. Implement the minimal fix.
2. Write a regression test that reproduces the original bug and verifies the fix.
3. The test must fail without the fix and pass with it.

---

## Step 6: Scan for Similar Patterns

// turbo
Use Serena MCP `search_for_pattern` to search the codebase for the same pattern that caused the bug.
Report any other locations that may have the same vulnerability. Fix them if confirmed.

---

## Step 7: Document the Bug

Use `write_memory` to record a bug report in Serena Memory:
- Symptom, root cause
- Fix applied, files changed
- Regression test location
- Similar patterns found
