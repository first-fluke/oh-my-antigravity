import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { collectProviderCheck } from "./providers.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oma-doctor-search-"));
  mkdirSync(join(root, ".agents"));
  writeFileSync(join(root, ".agents", "oma-config.yaml"), "language: en\n");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

it("reports native search as runtime-managed without a network probe", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const report = await collectProviderCheck(root, {
    provider: "agentmemory",
    reachable: false,
  });
  expect(report.web).toEqual({
    provider: "native",
    capability: "web",
    status: "runtime-managed",
    reachability: "not-probed",
  });
  expect(report.issues).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  ["you", "unregistered"],
  ["context7", "unsupported"],
])("reports %s as %s for web search", async (provider, status) => {
  writeFileSync(
    join(root, ".agents", "oma-config.yaml"),
    `providers:\n  web: ${provider}\n`,
  );
  const report = await collectProviderCheck(root, {
    provider: "agentmemory",
    reachable: false,
  });
  expect(report.web).toMatchObject({ provider, status });
  expect(report.issues).toContain(
    `Web search provider ${provider}: ${status}; no automatic provider switch`,
  );
});
