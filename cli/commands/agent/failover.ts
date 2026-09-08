import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { ALL_CLI_VENDORS } from "../../constants/vendors.js";
import type { CliConfig } from "../../platform/agent-config.js";

const MAX_FALLBACK_VENDORS = 3;
const MAX_HANDOFF_BYTES = 32 * 1024;
const SAFE_HANDOFF_HEADER = "FAILOVER_HANDOFF: safe-to-resume";

export type FailoverTerminalReason =
  | "quota"
  | "rate-limit"
  | "transient-infrastructure";

export type FailoverCandidateResult = {
  vendors: string[];
  rejected: string[];
};

export type SafeFailoverHandoff = {
  path: string;
  vendor: string;
  runId: string;
};

/**
 * Parses an explicit fallback chain. Every fallback must have an explicit
 * cli-config vendor entry: this avoids silently selecting an API/provider
 * route that the user did not configure for this machine.
 */
export function resolveFailoverCandidates(
  value: string | string[] | undefined,
  primaryVendor: string,
  config: CliConfig | null,
  _runtimeVendor: string,
): FailoverCandidateResult {
  const requested = (Array.isArray(value) ? value : (value?.split(",") ?? []))
    .map((vendor) => vendor.trim().toLowerCase())
    .filter(Boolean);
  const vendors: string[] = [];
  const rejected: string[] = [];

  for (const vendor of requested) {
    if (vendors.length >= MAX_FALLBACK_VENDORS) {
      rejected.push(`${vendor}: chain limit is ${MAX_FALLBACK_VENDORS}`);
      continue;
    }
    if (vendor === primaryVendor || vendors.includes(vendor)) {
      rejected.push(`${vendor}: duplicate or primary vendor`);
      continue;
    }
    // pi is a multi-provider proxy. A direct fallback to it could silently
    // choose another provider/model, which is beyond the account-sharing MVP.
    if (vendor === "pi") {
      rejected.push("pi: multi-provider proxy fallback is not supported");
      continue;
    }
    if (!ALL_CLI_VENDORS.includes(vendor as (typeof ALL_CLI_VENDORS)[number])) {
      rejected.push(`${vendor}: unknown vendor`);
      continue;
    }
    if (!config || !Object.hasOwn(config.vendors, vendor)) {
      rejected.push(`${vendor}: no explicit cli-config vendor entry`);
      continue;
    }
    vendors.push(vendor);
  }

  return { vendors, rejected };
}

/**
 * Classifies only a terminal provider/transport error envelope collected from
 * stderr. stdout is intentionally excluded because task output can echo an
 * arbitrary string such as "429" or "quota exceeded".
 */
export function classifyFailoverTerminal(
  exitCode: number | null,
  stderr: string,
): FailoverTerminalReason | null {
  if (exitCode === null || exitCode === 0 || [130, 137, 143].includes(exitCode))
    return null;
  const terminalLine = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (
    !terminalLine ||
    !/^(error|fatal|request failed|api error|http error)\b/i.test(terminalLine)
  )
    return null;
  if (/\b(quota|usage limit|insufficient[_ -]?quota)\b/i.test(terminalLine))
    return "quota";
  if (/\b(429|rate[ -]?limit(?:ed|ing)?)\b/i.test(terminalLine))
    return "rate-limit";
  if (
    /\b(502|503|504|temporar(?:y|ily)|service unavailable|connection reset|econnreset|etimedout)\b/i.test(
      terminalLine,
    )
  )
    return "transient-infrastructure";
  return null;
}

export function failoverHandoffPath(root: string, runId: string): string {
  return path.join(root, ".agents", "results", `failover-handoff-${runId}.md`);
}

/** A checkpoint is deliberately tied to the exact completed attempt. */
export function findSafeFailoverHandoff(args: {
  root: string;
  runId: string;
  sessionId: string;
  agentId: string;
  vendor: string;
  startedAtMs: number;
}): SafeFailoverHandoff | null {
  const handoffPath = failoverHandoffPath(args.root, args.runId);
  try {
    if (!existsSync(handoffPath)) return null;
    const metadata = lstatSync(handoffPath);
    if (
      metadata.isSymbolicLink() ||
      metadata.size > MAX_HANDOFF_BYTES ||
      metadata.mtimeMs < args.startedAtMs
    )
      return null;
    const content = readFileSync(handoffPath, "utf8");
    const lines = new Set(content.split(/\r?\n/));
    const required = [
      SAFE_HANDOFF_HEADER,
      `Run: ${args.runId}`,
      `Session: ${args.sessionId}`,
      `Agent: ${args.agentId}`,
      `Vendor: ${args.vendor}`,
    ];
    if (!required.every((line) => lines.has(line))) return null;
    return { path: handoffPath, vendor: args.vendor, runId: args.runId };
  } catch {
    return null;
  }
}

export function failoverCheckpointInstructions(args: {
  root: string;
  runId: string;
  sessionId: string;
  agentId: string;
  vendor: string;
}): string {
  const handoffPath = failoverHandoffPath(args.root, args.runId);
  return `## Failover checkpoint\nAt safe task boundaries before a provider request, update ${JSON.stringify(handoffPath)} when another agent may safely continue from the workspace without repeating any external side effect. If a quota, rate-limit, or temporary provider failure prevents completion, leave that checkpoint in place only when it still accurately describes state. It must start with:\n${SAFE_HANDOFF_HEADER}\nRun: ${args.runId}\nSession: ${args.sessionId}\nAgent: ${args.agentId}\nVendor: ${args.vendor}\nThen record completed work, evidence paths, and remaining work. Include this file in the result claim artifacts. Do not create or retain this checkpoint when side-effect state is unknown.\n`;
}

export function buildFailoverPrompt(args: {
  originalPrompt: string;
  handoff: SafeFailoverHandoff;
  reason: FailoverTerminalReason;
}): string {
  return `## Vendor failover handoff\nThe prior vendor stopped because of ${args.reason}. Its agent wrote a checkpoint at ${JSON.stringify(args.handoff.path)}. Read that checkpoint and inspect the workspace before acting. Continue only the remaining work. Do not repeat network, billing, publishing, deletion, or other external side effects unless their prior state is verified.\n\n## Original task\n${args.originalPrompt}`;
}
