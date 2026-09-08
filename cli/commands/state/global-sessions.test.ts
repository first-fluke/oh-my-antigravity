import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateWorkflowSession, sessionsDir } from "../../state/events.js";
import { collectGlobalState } from "./sessions.js";

describe("collectGlobalState", () => {
  let workspace: string;
  let stateHome: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "oma-global-sessions-"));
    stateHome = join(workspace, "state");
    vi.stubEnv("OMA_STATE_HOME", stateHome);
    vi.stubEnv("OMA_PROFILE", "2");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("aggregates only valid sessions from the selected profile without creating profiles", () => {
    const first = join(workspace, "projects", "first");
    const deleted = join(workspace, "projects", "deleted");
    mkdirSync(first, { recursive: true });
    activateWorkflowSession({
      projectDir: first,
      sid: "oma-first",
      workflow: "migration",
      vendor: "codex",
      vendorSid: "vendor-first",
    });
    activateWorkflowSession({
      projectDir: deleted,
      sid: "oma-deleted",
      workflow: "failover",
      vendor: "claude",
      vendorSid: "vendor-deleted",
    });
    const malformed = join(sessionsDir(), "oma-malformed");
    mkdirSync(malformed, { recursive: true });
    writeFileSync(join(malformed, "context.json"), "{bad json");
    const wrongHash = join(sessionsDir(), "oma-wrong-hash");
    mkdirSync(wrongHash, { recursive: true });
    writeFileSync(
      join(wrongHash, "context.json"),
      JSON.stringify({
        schemaVersion: 1,
        projectId: "not-the-project-hash",
        projectDir: first,
        profile: "2",
      }),
    );
    const wrongProfile = join(sessionsDir(), "oma-wrong-profile");
    mkdirSync(wrongProfile, { recursive: true });
    const homeContext = JSON.parse(
      readFileSync(join(sessionsDir(), "oma-first", "context.json"), "utf-8"),
    ) as Record<string, unknown>;
    writeFileSync(
      join(wrongProfile, "context.json"),
      JSON.stringify({ ...homeContext, profile: "3" }),
    );
    const legacy = join(first, ".agents", "state", "sessions", "oma-first");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(
      join(legacy, "events.jsonl"),
      `${JSON.stringify({
        eventId: "legacy-session-created",
        ts: "2026-01-01T00:00:00.000Z",
        kind: "session.created",
        payload: { workflow: "legacy" },
      })}\n`,
    );

    const all = collectGlobalState();
    expect(all.profile).toBe("2");
    expect(all.sessions.map((session) => session.sid).sort()).toEqual([
      "oma-deleted",
      "oma-first",
    ]);
    expect(collectGlobalState({ project: deleted }).sessions).toHaveLength(1);
    expect(
      collectGlobalState({ project: relative(process.cwd(), deleted) })
        .sessions,
    ).toHaveLength(1);
    expect(collectGlobalState({ search: "MIGRATION" }).sessions).toEqual([
      expect.objectContaining({ sid: "oma-first" }),
    ]);
    expect(
      all.sessions.find((session) => session.sid === "oma-first")?.meta
        .workflow,
    ).toBe("migration");

    vi.stubEnv("OMA_PROFILE", "3");
    activateWorkflowSession({
      projectDir: join(workspace, "projects", "other-profile"),
      sid: "oma-profile-three",
      workflow: "isolated",
      vendor: "codex",
      vendorSid: "vendor-profile-three",
    });
    vi.stubEnv("OMA_PROFILE", "2");
    expect(
      collectGlobalState().sessions.map((session) => session.sid),
    ).not.toContain("oma-profile-three");
  });

  it("returns an empty view for an absent profile root without initializing it", () => {
    expect(collectGlobalState()).toEqual({ profile: "2", sessions: [] });
    expect(existsSync(join(stateHome, "u"))).toBe(false);
  });
});
