---
description: Full QA review pipeline — security audit (OWASP Top 10), performance analysis, accessibility check (WCAG 2.1 AA), and code quality review
---

# MANDATORY RULES — VIOLATION IS FORBIDDEN

- **All responses MUST be written in Korean (한국어).** Do NOT respond in English.
- **NEVER skip steps.** Execute from Step 1 in order.
- **You MUST use Serena MCP tools throughout the workflow.**
  - Use `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `search_for_pattern` for code analysis and review.
  - Use `write_memory` to record review results in `.serena/memories/`.
  - Do NOT use raw file reads or grep as substitutes.

---

## Step 1: Identify Review Scope

Ask the user what to review: specific files, a feature branch, or the entire project.
If a PR or branch is provided, diff against the base branch to scope the review.

---

## Step 2: Run Automated Security Checks

// turbo
Run available security tools: `npm audit` (Node.js), `bandit` (Python), or equivalent.
Check for known vulnerabilities in dependencies. Flag any CRITICAL or HIGH findings.

---

## Step 3: Manual Security Review (OWASP Top 10)

Use Serena MCP `search_for_pattern` and `find_symbol` to review code for:
- Injection (SQL, XSS, command)
- Broken auth, sensitive data exposure
- Broken access control, security misconfig
- Insecure deserialization
- Known vulnerable components
- Insufficient logging

---

## Step 4: Performance Analysis

Use Serena MCP tools to check for:
- N+1 queries, missing indexes
- Unbounded pagination, memory leaks
- Unnecessary re-renders (React)
- Missing lazy loading
- Large bundle sizes, unoptimized images

---

## Step 5: Accessibility Review (WCAG 2.1 AA)

Check for:
- Semantic HTML, ARIA labels
- Keyboard navigation, color contrast
- Focus management, screen reader compatibility
- Image alt text

---

## Step 6: Code Quality Review

Use Serena MCP `get_symbols_overview` and `find_referencing_symbols` to check for:
- Consistent naming, proper error handling
- Test coverage, TypeScript strict mode compliance
- Unused imports/variables
- Proper async/await usage
- Public API documentation

---

## Step 7: Generate QA Report

Compile all findings into a prioritized report:
- **CRITICAL**: Security breaches, data loss risks
- **HIGH**: Blocks launch
- **MEDIUM**: Fix this sprint
- **LOW**: Backlog

Each finding must include: `file:line`, description, and remediation code.
Use `write_memory` to record the final report in Serena Memory.
