import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalProfile,
  listLocalProfiles,
  profileDirectory,
  readLocalProfile,
  selectedProfileStatus,
  shellActivation,
} from "./profiles.js";

describe("local profiles", () => {
  let stateHome: string;

  beforeEach(() => {
    stateHome = mkdtempSync(join(tmpdir(), "oma-profiles-"));
    vi.stubEnv("OMA_STATE_HOME", stateHome);
    vi.stubEnv("OMA_PROFILE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(stateHome, { recursive: true, force: true });
  });

  it("lists absent storage without creating a profile identity", () => {
    expect(listLocalProfiles()).toEqual([]);
    expect(selectedProfileStatus()).toEqual({
      slot: "0",
      selected: true,
      profile: null,
    });
    expect(existsSync(join(stateHome, "u"))).toBe(false);
  });

  it("creates each decimal slot once and marks the environment-selected profile", () => {
    const created = createLocalProfile("1");
    const repeated = createLocalProfile("1");
    expect(repeated.profileId).toBe(created.profileId);
    vi.stubEnv("OMA_PROFILE", "1");
    expect(listLocalProfiles()).toEqual([
      expect.objectContaining({ slot: "1", selected: true, profile: created }),
    ]);
    expect(readLocalProfile("1")).toEqual(created);
  });

  it("rejects invalid slots and malformed profile metadata", () => {
    expect(() => createLocalProfile("01")).toThrow("non-negative decimal");
    expect(() => readLocalProfile("../../escape")).toThrow(
      "non-negative decimal",
    );
    createLocalProfile("3");
    const path = join(profileDirectory("3"), "profile.json");
    writeFileSync(path, "not json");
    expect(() => readLocalProfile("3")).toThrow("Invalid local profile");
  });

  it("renders activation without claiming to modify the parent shell", () => {
    expect(shellActivation("1", "zsh")).toBe("export OMA_PROFILE='1'");
    expect(shellActivation("1", "fish")).toBe("set -gx OMA_PROFILE 1");
  });
});
