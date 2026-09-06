import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mergeRulesIndexForVendor } from "../../platform/rules.js";
import { registerWebSearch, webSearch } from "./web.js";

let root: string;
const originalExitCode = process.exitCode;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oma-brave-command-"));
  mkdirSync(join(root, ".agents"));
  writeFileSync(
    join(root, ".agents", "oma-config.yaml"),
    "providers: {web: brave}\n",
  );
  vi.stubEnv("BRAVE_SEARCH_API_KEY", "synthetic-cli-token");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      web: { results: [{ url: "https://example.com", title: "Example" }] },
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.exitCode = originalExitCode;
  rmSync(root, { recursive: true, force: true });
});

it("executes the configured Brave adapter through the actual CLI handler", async () => {
  vi.spyOn(process, "cwd").mockReturnValue(root);
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  registerWebSearch(program);
  await program.parseAsync([
    "node",
    "search",
    "web",
    "typed adapters",
    "--limit",
    "2",
    "--json",
  ]);
  expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
    provider: "brave",
    sources: [{ url: "https://example.com" }],
  });
  expect(fetch).toHaveBeenCalledOnce();
});

it("allows per-request Brave override without changing the native default", async () => {
  writeFileSync(join(root, ".agents", "oma-config.yaml"), "language: en\n");
  await expect(webSearch("test", { projectDir: root })).rejects.toThrow(
    "no CLI adapter",
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(
    (await webSearch("test", { projectDir: root, provider: "brave" })).provider,
  ).toBe("brave");
  expect(readFileSync(join(root, ".agents", "oma-config.yaml"), "utf8")).toBe(
    "language: en\n",
  );
});

it.each([NaN, 0, 120001])(
  "rejects invalid timeout %s before a request",
  async (timeoutMs) => {
    await expect(
      webSearch("test", { projectDir: root, timeoutMs }),
    ).rejects.toThrow("timeout");
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("projects Brave routing for agents and removes it when switching back", () => {
  mergeRulesIndexForVendor(root, "codex");
  const path = join(root, "AGENTS.md");
  expect(readFileSync(path, "utf8")).toContain('oma search web "query" --json');
  expect(readFileSync(path, "utf8")).toContain(
    "Use Context7 for library documentation",
  );
  writeFileSync(
    join(root, ".agents", "oma-config.yaml"),
    "providers: {web: native}\n",
  );
  mergeRulesIndexForVendor(root, "codex");
  expect(readFileSync(path, "utf8")).not.toContain("Brave is the selected");
});
