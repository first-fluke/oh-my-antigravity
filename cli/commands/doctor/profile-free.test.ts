import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectProfileReport,
  serializeProfileReportAsJson,
} from "./profile.js";

describe("free profile diagnostics", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "oma-free-doctor-"));
    mkdirSync(join(root, ".agents"));
    writeFileSync(
      join(root, ".agents", "oma-config.yaml"),
      "model_preset: auto",
    );
    writeFileSync(
      join(root, ".agents", "oma-config.local.yaml"),
      "model_preset: free",
    );
    vi.stubEnv("FREELLM_API_KEY", "fixture-key");
    vi.stubEnv("FREELLMAPI_API_KEY", "");
    vi.stubEnv("FREELLM_BASE_URL", "http://127.0.0.1:31415/v1");
    vi.stubEnv("FREELLM_MODEL", "auto:coding");
    vi.stubEnv("OMA_RUNTIME_VENDOR", "codex");
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("reports the actual local/env configuration and successful authentication without the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}")),
    );
    const report = await collectProfileReport(root);
    expect(report.profileName).toBe("free");
    expect(report.configSources?.local).toBe(
      join(root, ".agents", "oma-config.local.yaml"),
    );
    expect(report.freeProvider).toMatchObject({
      model: "auto:coding",
      keyPresent: true,
      reachable: true,
    });
    expect(
      report.rows.every(
        (row) => row.model === "auto:coding" && row.cli === "codex",
      ),
    ).toBe(true);
    expect(serializeProfileReportAsJson(report)).not.toContain("fixture-key");
  });
  it("reports missing keys without making network calls", async () => {
    vi.stubEnv("FREELLM_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const report = await collectProfileReport(root);
    expect(report.freeProvider).toMatchObject({
      keyPresent: false,
      reachable: false,
    });
    expect(report.freeProvider?.error).toContain("requires FREELLM_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports invalid local configuration rather than showing the shared auto profile", async () => {
    writeFileSync(join(root, ".agents", "oma-config.local.yaml"), "free: {");
    const report = await collectProfileReport(root);
    expect(report.configError).toContain("oma-config.local.yaml");
    expect(report.missingPreset).toBe(true);
  });
});
