import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { serenaTransportMode } from "../utils/config.js";
import { loadProviders } from "../utils/providers.js";
import { isRecord } from "../utils/type-guards.js";
import { browserMcpDocument } from "../vendors/browser-mcp-document.js";
import {
  type BrowserMcpOptions,
  browserMcpTargets,
  piAgentDir,
} from "../vendors/browser-mcp-targets.js";
import { serenaMcpEntry } from "../vendors/serena.js";

/** Only native projections are changed. The shipped .agents/mcp.json stays the default template. */
export function syncProviderMcp(
  root: string,
  vendors: readonly string[],
  options: BrowserMcpOptions & { prepare?: boolean } = {},
): string[] {
  const providers = loadProviders(root);
  const selected = providers.code_intelligence;
  // Restore only after legacy vendor writers finish, so custom backups survive.
  if (options.prepare && selected === "serena") return [];
  const statePath = join(root, ".agents", "state", "provider-mcp.json");
  const original = existsSync(statePath)
    ? readFileSync(statePath, "utf8")
    : "{}";
  const state: unknown = JSON.parse(original);
  if (!isRecord(state))
    throw new Error(`Invalid provider MCP state: ${statePath}`);
  const changes: { path: string; content: string }[] = [];
  for (const target of browserMcpTargets(root, vendors, options)) {
    if (target.path === join(root, ".agents", "mcp.json") || target.removeOnly)
      continue;
    const saved = state[target.path];
    if (selected === "serena" && saved === undefined) continue;
    if (saved !== undefined && !isRecord(saved))
      throw new Error(`Invalid provider MCP backup for ${target.path}`);
    const doc = browserMcpDocument(target);
    const serenaKey = [...target.keys, "serena"];
    const gortexKey = [...target.keys, "gortex"];
    if (selected === "gortex") {
      if (saved === undefined)
        state[target.path] = {
          serena: doc.get(serenaKey),
          gortex: doc.get(gortexKey),
        };
      const server = { command: "gortex", args: ["mcp", "--tools", "compact"] };
      const entry =
        target.entry === "opencode"
          ? {
              type: "local",
              command: [server.command, ...server.args],
              enabled: true,
            }
          : target.entry === "copilot"
            ? { type: "local", ...server, tools: ["*"] }
            : target.entry === "stdio"
              ? { type: "stdio", ...server }
              : server;
      doc.set(serenaKey, undefined);
      doc.set(gortexKey, doc.get(gortexKey) ?? entry);
    } else {
      const context =
        target.format === "toml" && target.path.includes(".codex")
          ? "codex"
          : target.path.includes("antigravity") ||
              target.path.endsWith("mcp_config.json")
            ? "antigravity"
            : target.path.endsWith(".mcp.json") ||
                target.path.endsWith(".claude.json")
              ? "claude-code"
              : "ide";
      const server = serenaMcpEntry(context, serenaTransportMode(root));
      const fallback =
        target.entry === "opencode"
          ? {
              type: "local",
              command: [server.command, ...server.args],
              enabled: true,
            }
          : target.entry === "copilot"
            ? { type: "local", ...server, tools: ["*"] }
            : target.entry === "stdio"
              ? { type: "stdio", ...server }
              : server;
      doc.set(
        serenaKey,
        (isRecord(saved) ? saved.serena : undefined) ??
          doc.get(serenaKey) ??
          fallback,
      );
      doc.set(gortexKey, isRecord(saved) ? saved.gortex : undefined);
      delete state[target.path];
    }
    const change = doc.result();
    if (change) changes.push(change);
  }
  if (selected === "gortex" && vendors.includes("pi")) {
    const path = options.global
      ? join(piAgentDir(options.home ?? homedir()), "settings.json")
      : join(root, ".pi", "settings.json");
    const doc = browserMcpDocument({ path, keys: [], format: "json" });
    const packages = doc.get(["packages"]) ?? [];
    if (!Array.isArray(packages))
      throw new Error(`Expected packages to be an array in ${path}`);
    const hasAdapter = packages.some((entry) => {
      const source = isRecord(entry) ? entry.source : entry;
      return (
        typeof source === "string" &&
        /^npm:pi-mcp-adapter(?:@[^/]+)?$/.test(source)
      );
    });
    if (!hasAdapter) doc.set(["packages"], [...packages, "npm:pi-mcp-adapter"]);
    const change = doc.result();
    if (change) changes.push(change);
  }
  // Standalone Bun hooks cannot import the CLI's dependency tree. Keep their
  // raw-event path local when a different memory provider is selected.
  const selectionPath = join(
    root,
    ".agents",
    "state",
    "provider-selection.json",
  );
  const selection = `${JSON.stringify(providers)}\n`;
  if (
    (providers.semantic_memory !== "agentmemory" ||
      existsSync(selectionPath)) &&
    (!existsSync(selectionPath) ||
      readFileSync(selectionPath, "utf8") !== selection)
  ) {
    changes.push({ path: selectionPath, content: selection });
  }
  const serialized = JSON.stringify(state, null, 2);
  if (JSON.stringify(JSON.parse(original)) !== JSON.stringify(state)) {
    changes.unshift({ path: statePath, content: `${serialized}\n` });
  }
  // Parse every target before making any writes; malformed config cannot partially switch providers.
  if (!options.dryRun)
    for (const change of changes) {
      mkdirSync(dirname(change.path), { recursive: true });
      // Rename onto the native path so a legacy symlink cannot mutate the SSOT template.
      const temporary = `${change.path}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, change.content, { mode: 0o600 });
        renameSync(temporary, change.path);
      } finally {
        rmSync(temporary, { force: true });
      }
    }
  return changes.map((change) => change.path);
}
