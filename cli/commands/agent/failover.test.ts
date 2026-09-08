import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildFailoverPrompt,
  classifyFailoverTerminal,
  failoverHandoffPath,
  findSafeFailoverHandoff,
  resolveFailoverCandidates,
} from "./failover.js";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("agent failover", () => {
  it("accepts only configured, external, bounded fallback vendors", () => {
    expect(
      resolveFailoverCandidates(
        " codex,pi,codex,unknown,cursor,opencode,qwen ",
        "claude",
        { vendors: { codex: {}, cursor: {}, opencode: {}, qwen: {} } },
        "claude",
      ),
    ).toEqual({
      vendors: ["codex", "cursor", "opencode"],
      rejected: [
        "pi: multi-provider proxy fallback is not supported",
        "codex: duplicate or primary vendor",
        "unknown: unknown vendor",
        "qwen: chain limit is 3",
      ],
    });
  });

  it("allows an oma-owned subprocess to fall back into the host vendor", () => {
    expect(
      resolveFailoverCandidates(
        "codex",
        "claude",
        { vendors: { codex: {} } },
        "codex",
      ),
    ).toEqual({ vendors: ["codex"], rejected: [] });
  });

  it("does not classify arbitrary stdout-like text as a terminal provider error", () => {
    expect(
      classifyFailoverTerminal(1, "agent wrote: quota exceeded\n"),
    ).toBeNull();
    expect(classifyFailoverTerminal(1, "Error: HTTP 429 rate limited\n")).toBe(
      "rate-limit",
    );
    expect(
      classifyFailoverTerminal(1, "Fatal: service unavailable (503)\n"),
    ).toBe("transient-infrastructure");
    expect(
      classifyFailoverTerminal(
        1,
        "Error: HTTP 429 rate limited\nError: ordinary task failure\n",
      ),
    ).toBeNull();
    expect(
      classifyFailoverTerminal(null, "Error: HTTP 429 rate limited\n"),
    ).toBeNull();
  });

  it("builds a handoff prompt with evidence path and original task", () => {
    const prompt = buildFailoverPrompt({
      originalPrompt: "update the API",
      reason: "quota",
      handoff: {
        path: "/repo/.agents/results/failover-handoff-run-1.md",
        vendor: "claude",
        runId: "run-1",
      },
    });
    expect(prompt).toContain("failover-handoff-run-1.md");
    expect(prompt).toContain("update the API");
    expect(prompt).toContain("Do not repeat network");
  });

  it("requires a fresh checkpoint tied to the exact agent run", () => {
    const root = mkdtempSync(path.join(tmpdir(), "oma-failover-"));
    tempRoots.push(root);
    const handoffPath = failoverHandoffPath(root, "run-1");
    mkdirSync(path.dirname(handoffPath), { recursive: true });
    writeFileSync(
      handoffPath,
      [
        "FAILOVER_HANDOFF: safe-to-resume",
        "Run: run-1",
        "Session: session-1",
        "Agent: backend",
        "Vendor: claude",
      ].join("\n"),
    );

    expect(
      findSafeFailoverHandoff({
        root,
        runId: "run-1",
        sessionId: "session-1",
        agentId: "backend",
        vendor: "claude",
        startedAtMs: Date.now() - 1_000,
      }),
    ).toMatchObject({ path: handoffPath, runId: "run-1" });
    expect(
      findSafeFailoverHandoff({
        root,
        runId: "run-1",
        sessionId: "another-session",
        agentId: "backend",
        vendor: "claude",
        startedAtMs: Date.now() - 1_000,
      }),
    ).toBeNull();
    writeFileSync(
      handoffPath,
      [
        "FAILOVER_HANDOFF: safe-to-resume",
        "Run: run-10",
        "Session: session-1",
        "Agent: backend",
        "Vendor: claude",
      ].join("\n"),
    );
    expect(
      findSafeFailoverHandoff({
        root,
        runId: "run-1",
        sessionId: "session-1",
        agentId: "backend",
        vendor: "claude",
        startedAtMs: Date.now() - 1_000,
      }),
    ).toBeNull();
  });
});
