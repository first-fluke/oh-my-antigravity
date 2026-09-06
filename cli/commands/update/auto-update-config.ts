import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolve whether to auto-update the CLI binary.
 *
 * Precedence (highest first):
 *   1. Project-level: <cwd>/.agents/oma-config.yaml
 *   2. Global-level:  <HOME>/.agents/oma-config.yaml
 *   3. Default: true (opt-out model)
 *
 * When both installs are present, project config beats global.
 * TODO: see docs/oma-config-semantics.md (Task 53)
 */
function readAutoUpdateFlag(filePath: string): boolean | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    const content = readFileSync(filePath, "utf-8");
    const match = content.match(/^[ \t]*auto_update_cli:\s*(true|false)/m);
    if (match) {
      return match[1] === "true";
    }
  } catch {
    // fall through
  }
  return undefined;
}

export function resolveAutoUpdateCli(cwd: string): boolean {
  // 1. Project-level config (CUE first, then YAML)
  const projectCue = readAutoUpdateFlag(join(cwd, ".agents", "oma-config.cue"));
  if (projectCue !== undefined) return projectCue;

  const projectYaml = readAutoUpdateFlag(
    join(cwd, ".agents", "oma-config.yaml"),
  );
  if (projectYaml !== undefined) return projectYaml;

  // 2. Global-level config (CUE first, then YAML)
  const globalCue = readAutoUpdateFlag(
    join(homedir(), ".agents", "oma-config.cue"),
  );
  if (globalCue !== undefined) return globalCue;

  const globalYaml = readAutoUpdateFlag(
    join(homedir(), ".agents", "oma-config.yaml"),
  );
  if (globalYaml !== undefined) return globalYaml;

  // 3. Default: opt-out (enabled unless explicitly set to false)
  return true;
}
