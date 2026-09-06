import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
  execFileSync: vi.fn(),
}));

const childProcess = await import("node:child_process");
const { evaluateCueFile, isCueAvailable, ensureCueBinary } = await import(
  "./cue.js"
);

describe("isCueAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when cue version exits with code 0", () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      status: 0,
      stdout: "cue version v0.12.0",
      stderr: "",
      pid: 1234,
      output: [],
      signal: null,
    });
    expect(isCueAvailable()).toBe(true);
  });

  it("returns false when cue is missing or fails", () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "not found",
      pid: 1234,
      output: [],
      signal: null,
    });
    expect(isCueAvailable()).toBe(false);
  });
});

describe("ensureCueBinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns present when cue is already available", () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      status: 0,
      stdout: "cue version v0.12.0",
      stderr: "",
      pid: 1234,
      output: [],
      signal: null,
    });

    const result = ensureCueBinary();
    expect(result.status).toBe("present");
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });

  it("attempts install and returns installed on success", () => {
    // First call (isCueAvailable): false. Second call (after install): true.
    vi.mocked(childProcess.spawnSync)
      .mockReturnValueOnce({
        status: 1,
        stdout: "",
        stderr: "",
        pid: 1234,
        output: [],
        signal: null,
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "cue version v0.12.0",
        stderr: "",
        pid: 1234,
        output: [],
        signal: null,
      });

    vi.mocked(childProcess.execFileSync).mockReturnValue(Buffer.from(""));

    const startCb = vi.fn();
    const result = ensureCueBinary({ onInstallStart: startCb });
    expect(startCb).toHaveBeenCalled();
    expect(result.status).toBe("installed");
  });

  it("returns install-failed when all install attempts fail", () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "",
      pid: 1234,
      output: [],
      signal: null,
    });
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw new Error("package manager failed");
    });

    const result = ensureCueBinary();
    expect(result.status).toBe("install-failed");
    if (result.status === "install-failed") {
      expect(result.error).toContain("Install via");
    }
  });
});

describe("evaluateCueFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed JSON object when cue export succeeds", () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      status: 0,
      stdout: JSON.stringify({ language: "ko", model_preset: "antigravity" }),
      stderr: "",
      pid: 1234,
      output: [],
      signal: null,
    });

    const result = evaluateCueFile("/path/to/oma-config.cue");
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      language: "ko",
      model_preset: "antigravity",
    });
  });

  it("handles missing cue binary (ENOENT)", () => {
    const enoentError = new Error(
      "spawnSync cue ENOENT",
    ) as NodeJS.ErrnoException;
    enoentError.code = "ENOENT";

    vi.mocked(childProcess.spawnSync).mockReturnValue({
      error: enoentError,
      status: null,
      stdout: "",
      stderr: "",
      pid: 0,
      output: [],
      signal: null,
    });

    const result = evaluateCueFile("/path/to/oma-config.cue");
    expect(result.success).toBe(false);
    expect(result.missingCli).toBe(true);
    expect(result.error).toContain("not found");
  });

  it("handles non-zero exit code from cue export", () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "conflicting values in oma-config.cue:12:4",
      pid: 1234,
      output: [],
      signal: null,
    });

    const result = evaluateCueFile("/path/to/oma-config.cue");
    expect(result.success).toBe(false);
    expect(result.missingCli).toBeFalsy();
    expect(result.error).toBe("conflicting values in oma-config.cue:12:4");
  });

  it("handles invalid JSON output from cue export", () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      status: 0,
      stdout: "{ not valid json",
      stderr: "",
      pid: 1234,
      output: [],
      signal: null,
    });

    const result = evaluateCueFile("/path/to/oma-config.cue");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to parse CUE JSON output");
  });
});
