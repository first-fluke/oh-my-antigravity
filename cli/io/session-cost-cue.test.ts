import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/cue.js", () => ({
  evaluateCueFile: vi.fn(),
}));

const { evaluateCueFile } = await import("../utils/cue.js");
const { loadQuotaCap } = await import("./session-cost.js");

describe("loadQuotaCap CUE support", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), "oma-quota-cue-"));
    mkdirSync(join(tempDir, ".agents", "config"), { recursive: true });
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("prioritizes oma-config.cue quota_cap over oma-config.yaml", () => {
    writeFileSync(
      join(tempDir, ".agents", "oma-config.cue"),
      "session: quota_cap: tokens: 1000\n",
    );
    writeFileSync(
      join(tempDir, ".agents", "oma-config.yaml"),
      "session:\n  quota_cap:\n    tokens: 2000\n",
    );

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: true,
      data: {
        session: {
          quota_cap: {
            tokens: 1000,
            spawn_count: 10,
          },
        },
      },
    });

    const cap = loadQuotaCap(tempDir);
    expect(cap?.tokens).toBe(1000);
    expect(cap?.spawnCount).toBe(10);
  });

  it("falls back to oma-config.yaml if oma-config.cue fails evaluation", () => {
    writeFileSync(join(tempDir, ".agents", "oma-config.cue"), "syntax error");
    writeFileSync(
      join(tempDir, ".agents", "oma-config.yaml"),
      "session:\n  quota_cap:\n    tokens: 2000\n",
    );

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: false,
      error: "cue error",
    });

    const cap = loadQuotaCap(tempDir);
    expect(cap?.tokens).toBe(2000);
  });
});
