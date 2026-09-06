import { execFileSync, spawnSync } from "node:child_process";

export interface CueEvalResult {
  success: boolean;
  data?: unknown;
  error?: string;
  missingCli?: boolean;
}

/**
 * Check if the `cue` binary is available on PATH.
 */
export function isCueAvailable(): boolean {
  try {
    const result = spawnSync("cue", ["version"], {
      stdio: "ignore",
      timeout: 5000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

export type CueBinaryOutcome =
  | { status: "present" }
  | { status: "installed" }
  | { status: "installed-not-on-path" }
  | { status: "install-failed"; error: string };

/**
 * Best-effort ensure `cue` binary is installed and on PATH using brew or winget.
 */
export function ensureCueBinary(opts?: {
  onInstallStart?: () => void;
}): CueBinaryOutcome {
  if (isCueAvailable()) return { status: "present" };

  opts?.onInstallStart?.();

  if (process.platform === "darwin" || process.platform === "linux") {
    try {
      execFileSync("brew", ["install", "cue"], {
        stdio: "ignore",
        timeout: 180_000,
      });
      if (isCueAvailable()) return { status: "installed" };
    } catch {
      // ignore
    }
  } else if (process.platform === "win32") {
    try {
      execFileSync(
        "winget",
        [
          "install",
          "-e",
          "--id",
          "cue-lang.cue",
          "--accept-source-agreements",
          "--accept-package-agreements",
        ],
        { stdio: "ignore", timeout: 180_000 },
      );
      if (isCueAvailable()) return { status: "installed" };
    } catch {
      // ignore
    }
  }

  const guide =
    process.platform === "win32"
      ? "winget install cue-lang.cue"
      : "brew install cue";

  return {
    status: "install-failed",
    error: `CUE CLI is not installed. Install via '${guide}' or see https://cuelang.org/docs/install/`,
  };
}

/**
 * Evaluate a CUE file into a JavaScript object using `cue export --out json`.
 * If `cue` CLI is not installed or not in PATH, returns `{ success: false, missingCli: true, error: ... }`.
 */
export function evaluateCueFile(filePath: string): CueEvalResult {
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync("cue", ["export", "--out", "json", filePath], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    const isEnoent =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT";
    return {
      success: false,
      missingCli: Boolean(isEnoent),
      error: isEnoent
        ? "'cue' command not found in PATH"
        : err instanceof Error
          ? err.message
          : String(err),
    };
  }

  if (result.error) {
    const isEnoent = (result.error as NodeJS.ErrnoException).code === "ENOENT";
    return {
      success: false,
      missingCli: isEnoent,
      error: isEnoent
        ? "'cue' command not found in PATH"
        : result.error.message,
    };
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr).trim() : "";
    return {
      success: false,
      error: stderr || `cue export failed with exit code ${result.status}`,
    };
  }

  try {
    const data = JSON.parse(String(result.stdout));
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse CUE JSON output: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
