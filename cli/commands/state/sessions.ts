import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  profileSlot,
  projectIdentity,
  type SessionContext,
} from "../../../.agents/hooks/core/session-storage.js";
import {
  deriveMeta,
  isValidSid,
  listSessionIds,
  type OmaEvent,
  readEvents,
  readIndex,
  refreshMeta,
  type SessionMeta,
  sessionArchiveRoot,
  sessionArchiveRoots,
  sessionDir,
  sessionsDir,
  setActiveSession,
  sortEvents,
} from "../../state/events.js";
import { resolveProjectRoot } from "../../utils/fs-utils.js";
import type {
  ArchivedSession,
  ArchivedStateView,
  GlobalStateView,
  SessionView,
  StateView,
} from "./types.js";

function loadSessionMeta(projectDir: string, sid: string): SessionMeta {
  const metaPath = join(sessionDir(projectDir, sid), "meta.json");
  if (existsSync(metaPath)) {
    try {
      return JSON.parse(readFileSync(metaPath, "utf-8")) as SessionMeta;
    } catch {
      return refreshMeta(projectDir, sid);
    }
  }
  return deriveMeta(sid, readEvents(projectDir, sid));
}

function eventsFromDir(dir: string): OmaEvent[] {
  const path = join(dir, "events.jsonl");
  if (!existsSync(path)) return [];
  const events: OmaEvent[] = [];
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as OmaEvent;
      if (event.sid && event.kind && event.eventId && event.ts) {
        events.push(event);
      }
    } catch {
      // Bad archive lines stay ignored here; doctor/repair can quarantine.
    }
  }
  return sortEvents(events);
}

function loadArchivedSession(
  bucket: string,
  sid: string,
  archivePath: string,
): ArchivedSession {
  const metaPath = join(archivePath, "meta.json");
  if (existsSync(metaPath)) {
    try {
      return {
        bucket,
        sid,
        archivePath,
        meta: JSON.parse(readFileSync(metaPath, "utf-8")) as SessionMeta,
      };
    } catch {
      // Re-derive below.
    }
  }
  const events = eventsFromDir(archivePath);
  return {
    bucket,
    sid,
    archivePath,
    meta: deriveMeta(sid, events),
  };
}

export function collectState(projectDir = resolveProjectRoot()): StateView {
  const index = readIndex(projectDir);
  const sessions: SessionMeta[] = [];
  for (const sid of listSessionIds(projectDir)) {
    sessions.push(loadSessionMeta(projectDir, sid));
  }
  sessions.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return { index, sessions };
}

/** Read every valid session in the selected profile without creating storage. */
export function collectGlobalState(
  filters: { project?: string; search?: string } = {},
): GlobalStateView {
  const profile = profileSlot();
  const root = sessionsDir();
  if (!existsSync(root)) return { profile, sessions: [] };
  const sessions = [] as GlobalStateView["sessions"];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return { profile, sessions };
  }
  for (const sid of entries) {
    if (!isValidSid(sid)) continue;
    const context = readGlobalContext(join(root, sid));
    if (!context || context.profile !== profile) continue;
    const meta = deriveMeta(sid, eventsFromDir(join(root, sid)));
    if (!matchesGlobalFilters({ sid, context, meta }, filters)) continue;
    sessions.push({ sid, context, meta });
  }
  sessions.sort((a, b) =>
    (b.meta.createdAt ?? "").localeCompare(a.meta.createdAt ?? ""),
  );
  return { profile, sessions };
}

export function collectArchivedState(
  projectDir = resolveProjectRoot(),
): ArchivedStateView {
  const sessions: ArchivedSession[] = [];
  for (const root of archiveRoots(projectDir)) {
    if (existsSync(root)) {
      for (const bucketEntry of readdirSync(root, { withFileTypes: true })) {
        if (!bucketEntry.isDirectory()) continue;
        const bucket = bucketEntry.name;
        const bucketPath = join(root, bucket);
        for (const sessionEntry of readdirSync(bucketPath, {
          withFileTypes: true,
        })) {
          if (!sessionEntry.isDirectory()) continue;
          sessions.push(
            loadArchivedSession(
              bucket,
              sessionEntry.name,
              join(bucketPath, sessionEntry.name),
            ),
          );
        }
      }
    }
  }
  sessions.sort((a, b) =>
    (b.meta.createdAt ?? "").localeCompare(a.meta.createdAt ?? ""),
  );
  return { sessions };
}

export function viewSession(
  sid: string,
  projectDir = resolveProjectRoot(),
): SessionView {
  const livePath = sessionDir(projectDir, sid);
  if (existsSync(livePath)) {
    const events = readEvents(projectDir, sid);
    return { meta: deriveMeta(sid, events), events, archived: false };
  }

  const archived = collectArchivedState(projectDir).sessions.find(
    (session) => session.sid === sid,
  );
  if (archived) {
    const events = eventsFromDir(archived.archivePath);
    return {
      meta: deriveMeta(sid, events),
      events,
      archived: true,
      archivePath: archived.archivePath,
    };
  }

  const events = readEvents(projectDir, sid);
  return { meta: deriveMeta(sid, events), events, archived: false };
}

function readGlobalContext(dir: string): SessionContext | null {
  try {
    const value = JSON.parse(
      readFileSync(join(dir, "context.json"), "utf-8"),
    ) as unknown;
    if (!value || typeof value !== "object") return null;
    const context = value as Partial<SessionContext>;
    if (
      context.schemaVersion !== 1 ||
      typeof context.projectId !== "string" ||
      context.projectId.length === 0 ||
      typeof context.projectDir !== "string" ||
      !isAbsolute(context.projectDir) ||
      typeof context.profile !== "string"
    ) {
      return null;
    }
    const identity = projectIdentity(context.projectDir);
    if (
      context.projectId !== identity.projectId ||
      context.profile !== identity.profile
    ) {
      return null;
    }
    return identity;
  } catch {
    return null;
  }
}

function matchesGlobalFilters(
  session: GlobalStateView["sessions"][number],
  filters: { project?: string; search?: string },
): boolean {
  if (filters.project) {
    const projectPath = projectIdentity(filters.project).projectDir;
    if (
      session.context.projectId !== filters.project &&
      session.context.projectDir !== projectPath
    ) {
      return false;
    }
  }
  const search = filters.search?.trim().toLowerCase();
  if (!search) return true;
  return [
    session.sid,
    session.context.projectId,
    session.context.projectDir,
    session.meta.workflow,
    session.meta.status,
    session.meta.currentPhase,
  ].some((value) => value?.toLowerCase().includes(search));
}

export function activateStateSession(
  sid: string,
  category = "main",
  projectDir = resolveProjectRoot(),
): void {
  setActiveSession(projectDir, category, sid);
}

/**
 * Validate that a session directory name is safe to use as a path component.
 * Accepts the formats actually used by oma (e.g. "oma-main", "sid-1").
 * Rejects anything containing ".." or characters outside [A-Za-z0-9._-].
 */
export { isValidSid };

export function parseOlderThan(value: string): number {
  const match = value.trim().match(/^(\d+)([dhm]?)$/i);
  if (!match) {
    throw new Error("older-than must be a duration like 90d, 24h, or 30m");
  }
  const amount = Number(match[1] ?? "0");
  const unit = (match[2] ?? "d").toLowerCase() || "d";
  const multipliers = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
  } as const;
  const multiplier =
    multipliers[unit as keyof typeof multipliers] ?? multipliers.d;
  return amount * multiplier;
}

export function archiveRoot(projectDir: string): string {
  return sessionArchiveRoot(projectDir);
}

export function archiveRoots(projectDir: string): string[] {
  return sessionArchiveRoots(projectDir);
}
