#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureSessionStorage } from "./session-storage.ts";
import { withSessionWriteLock } from "./state-index-lock.ts";
import { sessionDir } from "./state-marker.ts";
import type { MemoryFact } from "./vendor-renderer.ts";

/**
 * Per-boundary inject audit log (D52) with privacy guards (D57).
 *
 * Every boundary inject writes
 * `~/.oma/u/<profile>/sessions/{sid}/inject-log/{ISO-ts}.md` (or an existing
 * legacy project session directory) containing the rendered
 * markdown, the recall query, and the facts returned — a forensic trail for
 * debugging "resume context looks wrong" issues.
 *
 * Privacy (D57): logs are local-debug artifacts. They are created with
 * user-only permissions where supported, secret patterns are redacted before
 * write, and they live under `.agents/state/` (gitignored) and are never copied
 * into Serena mirrors (the mirror reads `events.jsonl` only).
 */

// Default secret shapes. Extend at runtime via OMA_REDACT_PATTERNS (comma-
// separated regex sources). Hooks cannot import cli/, so this list is
// self-contained.
const DEFAULT_SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{16,}/g, // OpenAI-style keys
  /xox[baprs]-[A-Za-z0-9-]{10,}/g, // Slack tokens
  /gh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub tokens
  /AKIA[0-9A-Z]{16}/g, // AWS access key id
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /\bBearer\s+[A-Za-z0-9._-]{12,}/gi, // bearer tokens
  /(api[_-]?key|secret|token|password|passwd|access[_-]?key)(["']?\s*[:=]\s*["']?)[A-Za-z0-9._\-/+]{8,}/gi,
];

const REDACTION = "[REDACTED]";

function extraPatternsFromEnv(): RegExp[] {
  const raw = process.env.OMA_REDACT_PATTERNS;
  if (!raw) return [];
  const patterns: RegExp[] = [];
  for (const source of raw.split(",")) {
    const trimmed = source.trim();
    if (!trimmed) continue;
    try {
      patterns.push(new RegExp(trimmed, "g"));
    } catch {
      // Ignore invalid user-supplied patterns rather than crashing the hook.
    }
  }
  return patterns;
}

export function redactSecrets(text: string, extra: RegExp[] = []): string {
  let out = text;
  for (const pattern of [
    ...DEFAULT_SECRET_PATTERNS,
    ...extraPatternsFromEnv(),
    ...extra,
  ]) {
    // String.replace passes (match, ...groups, offset, fullString). Keyed
    // patterns capture (key, separator) as strings so the log still shows WHICH
    // secret was redacted; ungrouped patterns get a number offset in arg 1, so
    // type-check before treating args as capture groups.
    out = out.replace(pattern, (...args: unknown[]) => {
      const key = args[1];
      const sep = args[2];
      if (typeof key === "string" && typeof sep === "string") {
        return `${key}${sep}${REDACTION}`;
      }
      return REDACTION;
    });
  }
  return out;
}

export interface InjectLogEntry {
  boundaryAt: string;
  fromVendor: string | null;
  fromVendorSid: string | null;
  toVendor: string;
  toVendorSid: string;
  recallQuery: string | null;
  facts: MemoryFact[];
  rendered: string;
}

export function injectLogDir(projectDir: string, sid: string): string {
  return join(sessionDir(projectDir, sid), "inject-log");
}

/** Filesystem-safe filename from an ISO timestamp (`:`/`.` are unsafe on win32). */
export function injectLogFilename(boundaryAt: string): string {
  return `${boundaryAt.replace(/[:.]/g, "-")}.md`;
}

function renderInjectLog(entry: InjectLogEntry): string {
  const facts =
    entry.facts.length === 0
      ? "- (none)"
      : entry.facts
          .map((fact) => {
            const source = fact.source ? ` (${fact.source})` : "";
            const score =
              typeof fact.score === "number" ? ` [${fact.score}]` : "";
            return `- ${redactSecrets(fact.text)}${source}${score}`;
          })
          .join("\n");

  return [
    `# OMA Inject Log ${entry.boundaryAt}`,
    "",
    `- from: ${entry.fromVendor ?? "(new)"} / ${entry.fromVendorSid ?? "(none)"}`,
    `- to: ${entry.toVendor} / ${entry.toVendorSid}`,
    `- recall query: ${entry.recallQuery ? redactSecrets(entry.recallQuery) : "(none)"}`,
    `- facts: ${entry.facts.length}`,
    "",
    "## Facts",
    facts,
    "",
    "## Rendered",
    "```",
    redactSecrets(entry.rendered),
    "```",
    "",
  ].join("\n");
}

/**
 * Write a boundary inject log. Best-effort: a failure here is debug-only and
 * must never break the hook, so errors are swallowed and `null` is returned.
 */
export function writeInjectLog(
  projectDir: string,
  sid: string,
  entry: InjectLogEntry,
): string | null {
  try {
    return withSessionWriteLock(projectDir, sid, () => {
      ensureSessionStorage(projectDir, sid);
      const dir = injectLogDir(projectDir, sid);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const path = join(dir, injectLogFilename(entry.boundaryAt));
      writeFileSync(path, renderInjectLog(entry), {
        encoding: "utf-8",
        mode: 0o600,
      });
      return path;
    });
  } catch {
    return null;
  }
}
