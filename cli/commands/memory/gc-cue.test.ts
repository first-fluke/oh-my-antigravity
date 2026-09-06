import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateCueFile } from "../../utils/cue.js";
import { loadMemoryGcConfig } from "./gc.js";

vi.mock("../../utils/cue.js", () => ({
  evaluateCueFile: vi.fn(),
}));

describe("loadMemoryGcConfig CUE support", () => {
  let base: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), "oma-gc-cue-"));
    mkdirSync(join(base, ".agents"), { recursive: true });
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("prioritizes oma-config.cue over oma-config.yaml", () => {
    writeFileSync(
      join(base, ".agents", "oma-config.cue"),
      "memory: gc: keep_sessions: 42\n",
    );
    writeFileSync(
      join(base, ".agents", "oma-config.yaml"),
      "memory:\n  gc:\n    keep_sessions: 10\n",
    );

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: true,
      data: { memory: { gc: { keep_sessions: 42, max_age_days: 7 } } },
    });

    const config = loadMemoryGcConfig(base);
    expect(config).toEqual({ keep: 42, maxAgeDays: 7 });
    expect(evaluateCueFile).toHaveBeenCalledWith(
      join(base, ".agents", "oma-config.cue"),
    );
  });

  it("falls back to oma-config.yaml if oma-config.cue evaluation fails", () => {
    writeFileSync(join(base, ".agents", "oma-config.cue"), "invalid\n");
    writeFileSync(
      join(base, ".agents", "oma-config.yaml"),
      "memory:\n  gc:\n    keep_sessions: 10\n    max_age_days: 20\n",
    );

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: false,
      missingCli: true,
      error: "cue CLI missing",
    });

    const config = loadMemoryGcConfig(base);
    expect(config).toEqual({ keep: 10, maxAgeDays: 20 });
  });
});
