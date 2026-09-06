import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { OmaConfig } from "../platform/agent-config.js";
import { evaluateCueFile } from "./cue.js";
import { isRecord } from "./type-guards.js";

export type { OmaConfig } from "../platform/agent-config.js";

/**
 * Read .agents/oma-config.cue (if present) or .agents/oma-config.yaml, walking up from cwd.
 * .agents/oma-config.cue takes priority over .agents/oma-config.yaml.
 * If 'cue' CLI is not available in PATH, logs a warning and falls back to .agents/oma-config.yaml.
 * Returns null if not found or if the file cannot be read.
 */
export function loadOmaConfig(cwd?: string): OmaConfig | null {
  let dir = cwd || process.cwd();
  for (let i = 0; i < 10; i++) {
    const cuePath = join(dir, ".agents", "oma-config.cue");
    const yamlPath = join(dir, ".agents", "oma-config.yaml");
    const hasCue = existsSync(cuePath);
    const hasYaml = existsSync(yamlPath);

    if (hasCue) {
      const result = evaluateCueFile(cuePath);
      if (result.success) {
        if (
          result.data &&
          typeof result.data === "object" &&
          !Array.isArray(result.data)
        ) {
          return result.data as OmaConfig;
        }
        console.warn(`[config] CUE output at ${cuePath} is not an object`);
      } else {
        if (result.missingCli) {
          console.warn(
            `[config] Found ${cuePath} but 'cue' command was not found in PATH.${hasYaml ? " Falling back to oma-config.yaml." : ""}`,
          );
        } else {
          console.warn(
            `[config] Failed to evaluate CUE at ${cuePath}: ${result.error}.${hasYaml ? " Falling back to oma-config.yaml." : ""}`,
          );
        }
      }
    }

    if (hasYaml) {
      let content: string;
      try {
        content = readFileSync(yamlPath, "utf-8");
      } catch {
        return null;
      }
      try {
        return parseYaml(content) as OmaConfig;
      } catch (err) {
        const pos =
          err &&
          typeof err === "object" &&
          "linePos" in err &&
          Array.isArray((err as { linePos: unknown[] }).linePos) &&
          (err as { linePos: Array<{ line: number; col: number }> }).linePos
            .length > 0
            ? (err as { linePos: Array<{ line: number; col: number }> })
                .linePos[0]
            : null;
        const location = pos ? `${yamlPath}:${pos.line}:${pos.col}` : yamlPath;
        console.warn(
          `[config] Failed to parse YAML at ${location}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }
    }

    if (hasCue) {
      return null;
    }

    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Read auto_update_cli from oma-config.yaml. Defaults to true (opt-out).
 */
export function isAutoUpdateCliEnabled(cwd?: string): boolean {
  const config = loadOmaConfig(cwd);
  return config?.auto_update_cli !== false;
}

/**
 * Read telemetry from oma-config.yaml. Defaults to false (opt-in).
 * When true, oh-my-agent omits `DISABLE_TELEMETRY` from `.claude/settings.json`
 * so features that gate on telemetry (e.g. Remote Control) keep working.
 */
export function isTelemetryEnabled(cwd?: string): boolean {
  const config = loadOmaConfig(cwd);
  return config?.telemetry === true;
}

/**
 * Read timezone from oma-config.yaml.
 * Falls back to system timezone.
 */
export function loadTimezone(cwd?: string): string {
  const config = loadOmaConfig(cwd);
  if (config?.timezone && typeof config.timezone === "string") {
    return config.timezone;
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Browsers whose DevTools MCP server should be wired into the MCP configs.
 *
 * Reads `mcp.devtools_browsers` from oma-config.yaml. Returns `undefined` when
 * the key is absent, which callers must treat as "leave the current config
 * alone" — an unset key means the user never expressed a preference, and
 * silently deleting a server they may be using is not oma's call. An explicit
 * empty list (`devtools_browsers: []`) does mean "none".
 *
 * The distinction matters because a browser DevTools server is not free:
 * chrome-devtools-mcp costs three processes per agent session (`npm exec` →
 * server → telemetry watchdog), and every concurrent session pays it whether or
 * not a browser is ever driven.
 */
export function loadDevToolsBrowsers(
  cwd?: string,
): ("aside" | "chrome" | "firefox")[] | undefined {
  const config = loadOmaConfig(cwd) as unknown as {
    mcp?: { devtools_browsers?: unknown };
  } | null;
  const raw = isRecord(config?.mcp) ? config.mcp.devtools_browsers : undefined;
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(
    (entry): entry is "aside" | "chrome" | "firefox" =>
      entry === "aside" || entry === "chrome" || entry === "firefox",
  );
}

/**
 * Serena transport configuration.
 *
 * Default `bridge` — each vendor's MCP entry runs `oma bridge`, a stdio proxy
 * onto one shared serena HTTP server per project, started on first use. Several
 * agent sessions on a repo then share a single language-server stack instead of
 * each spawning its own; the proxy falls back to a session-local stdio serena
 * whenever the shared one cannot be reached, so nothing is lost when it fails.
 *
 * `stdio` opts out, restoring one full serena process per session.
 *
 * `autoUpdate` is opt-out (default true). Unless set to false, `oma update`
 * runs `uv tool upgrade serena-agent --prerelease=allow` so the
 * locally-installed serena binary tracks the latest prerelease.
 */
export interface SerenaConfig {
  mode: "stdio" | "bridge";
  autoUpdate: boolean;
}

export function loadSerenaConfig(cwd?: string): SerenaConfig {
  const config = loadOmaConfig(cwd) as unknown as {
    serena?: { mode?: unknown; auto_update?: unknown };
  } | null;
  const raw = isRecord(config?.serena) ? config.serena : undefined;
  const mode = raw?.mode === "stdio" ? "stdio" : "bridge";
  const autoUpdate = raw?.auto_update !== false;
  return { mode, autoUpdate };
}

/** Convenience accessor for the vendor MCP-entry builders. */
export function serenaTransportMode(cwd?: string): "stdio" | "bridge" {
  return loadSerenaConfig(cwd).mode;
}
