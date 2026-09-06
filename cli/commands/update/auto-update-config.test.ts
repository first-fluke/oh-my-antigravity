import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAutoUpdateCli } from "./auto-update-config.js";

describe("resolveAutoUpdateCli", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "oma-auto-update-test-"));
    mkdirSync(join(tempDir, ".agents"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("prioritizes oma-config.cue over oma-config.yaml", () => {
    writeFileSync(
      join(tempDir, ".agents", "oma-config.cue"),
      "package config\nauto_update_cli: false\n",
    );
    writeFileSync(
      join(tempDir, ".agents", "oma-config.yaml"),
      "auto_update_cli: true\n",
    );

    expect(resolveAutoUpdateCli(tempDir)).toBe(false);
  });

  it("falls back to oma-config.yaml when oma-config.cue is absent", () => {
    writeFileSync(
      join(tempDir, ".agents", "oma-config.yaml"),
      "auto_update_cli: false\n",
    );

    expect(resolveAutoUpdateCli(tempDir)).toBe(false);
  });

  it("defaults to true when no config files set auto_update_cli", () => {
    expect(resolveAutoUpdateCli(tempDir)).toBe(true);
  });
});
