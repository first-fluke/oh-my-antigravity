import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/cue.js", () => ({
  evaluateCueFile: vi.fn(),
}));

const { evaluateCueFile } = await import("../../utils/cue.js");
const { ConfigError } = await import("./config-error.js");
const { loadUserConfig } = await import("./config-loader.js");

describe("loadUserConfig CUE support", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), "oma-user-cue-"));
    mkdirSync(join(tempDir, ".agents"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("prioritizes oma-config.cue over oma-config.yaml", () => {
    writeFileSync(
      join(tempDir, ".agents", "oma-config.cue"),
      'language: "ko"\n',
    );
    writeFileSync(
      join(tempDir, ".agents", "oma-config.yaml"),
      "language: en\nmodel_preset: claude\n",
    );

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: true,
      data: { language: "ko", model_preset: "antigravity" },
    });

    const config = loadUserConfig(tempDir);
    expect(config.language).toBe("ko");
    expect(config.model_preset).toBe("antigravity");
  });

  it("throws ConfigError when model_preset in CUE is a legacy name", () => {
    writeFileSync(
      join(tempDir, ".agents", "oma-config.cue"),
      'model_preset: "claude-only"\n',
    );

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: true,
      data: { model_preset: "claude-only" },
    });

    expect(() => loadUserConfig(tempDir)).toThrow(ConfigError);
  });

  it("falls back to oma-config.yaml when cue CLI is not installed", () => {
    writeFileSync(
      join(tempDir, ".agents", "oma-config.cue"),
      'language: "ko"\n',
    );
    writeFileSync(
      join(tempDir, ".agents", "oma-config.yaml"),
      "language: en\nmodel_preset: codex\n",
    );

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: false,
      missingCli: true,
      error: "not found",
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = loadUserConfig(tempDir);
    expect(config.language).toBe("en");
    expect(config.model_preset).toBe("codex");

    warnSpy.mockRestore();
  });

  it("throws ConfigError when only oma-config.cue exists and cue CLI is missing", () => {
    writeFileSync(
      join(tempDir, ".agents", "oma-config.cue"),
      'language: "ko"\n',
    );

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: false,
      missingCli: true,
      error: "not found",
    });

    expect(() => loadUserConfig(tempDir)).toThrow(ConfigError);
    expect(() => loadUserConfig(tempDir)).toThrow(/Install CUE/);
  });

  it("throws ConfigError when only oma-config.cue exists and cue export fails", () => {
    writeFileSync(join(tempDir, ".agents", "oma-config.cue"), "invalid cue");

    vi.mocked(evaluateCueFile).mockReturnValue({
      success: false,
      error: "syntax error on line 5",
    });

    expect(() => loadUserConfig(tempDir)).toThrow(ConfigError);
    expect(() => loadUserConfig(tempDir)).toThrow(/syntax error on line 5/);
  });
});
