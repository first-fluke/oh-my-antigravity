import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  deriveMeta,
  eventsPath,
  listSessionIds,
  metaPath,
  type OmaEvent,
  readEvents,
  readIndex,
  refreshMeta,
  type SessionMeta,
  sessionDir,
  updateIndex,
} from "../../state/events.js";
import { resolveProjectRoot } from "../../utils/fs-utils.js";
import { archiveRoot, collectState, parseOlderThan } from "./sessions.js";
import type { ArchiveResult, PurgeResult, RepairResult } from "./types.js";

function isValidEvent(value: unknown): value is OmaEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<OmaEvent>;
  return (
    typeof event.sid === "string" &&
    typeof event.kind === "string" &&
    typeof event.eventId === "string" &&
    typeof event.ts === "string"
  );
}

function parseEventLines(content: string): {
  validLines: string[];
  invalidLines: string[];
} {
  const validLines: string[] = [];
  const invalidLines: string[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (isValidEvent(parsed)) {
        validLines.push(JSON.stringify(parsed));
      } else {
        invalidLines.push(line);
      }
    } catch {
      invalidLines.push(line);
    }
  }
  return { validLines, invalidLines };
}

function metaNeedsRepair(projectDir: string, sid: string): boolean {
  const path = metaPath(projectDir, sid);
  if (!existsSync(path)) return true;
  try {
    JSON.parse(readFileSync(path, "utf-8"));
    return false;
  } catch {
    return true;
  }
}

function newestRepairCandidate(
  projectDir: string,
  sessions: SessionMeta[],
): string | null {
  const sorted = [...sessions].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return (
      sessionTimestampMs(projectDir, b.sid, b) -
      sessionTimestampMs(projectDir, a.sid, a)
    );
  });
  return sorted[0]?.sid ?? null;
}

function sessionTimestampMs(
  projectDir: string,
  sid: string,
  meta: SessionMeta,
): number {
  const parsed = meta.createdAt ? Date.parse(meta.createdAt) : Number.NaN;
  if (!Number.isNaN(parsed)) return parsed;
  return statSync(sessionDir(projectDir, sid)).mtimeMs;
}

export function repairStateSessions(
  args: { projectDir?: string; dryRun?: boolean } = {},
): RepairResult {
  const projectDir = args.projectDir ?? resolveProjectRoot();
  const dryRun = args.dryRun === true;
  const result: RepairResult = {
    dryRun,
    repairedMeta: [],
    quarantinedEvents: [],
    removedActive: [],
    reassignedActive: [],
    unchanged: true,
  };
  const sessionIds = listSessionIds(projectDir);

  for (const sid of sessionIds) {
    const path = eventsPath(projectDir, sid);
    if (existsSync(path)) {
      const parsed = parseEventLines(readFileSync(path, "utf-8"));
      if (parsed.invalidLines.length > 0) {
        const badPath = join(sessionDir(projectDir, sid), "events.bad.jsonl");
        result.quarantinedEvents.push({
          sid,
          invalidLines: parsed.invalidLines.length,
          badPath,
        });
        if (!dryRun) {
          writeFileSync(
            path,
            parsed.validLines.length > 0
              ? `${parsed.validLines.join("\n")}\n`
              : "",
            "utf-8",
          );
          appendFileSync(
            badPath,
            `${parsed.invalidLines.join("\n")}\n`,
            "utf-8",
          );
        }
      }
    }
    if (metaNeedsRepair(projectDir, sid)) {
      result.repairedMeta.push(sid);
      if (!dryRun) refreshMeta(projectDir, sid);
    }
  }

  const view = {
    index: readIndex(projectDir),
    sessions: sessionIds.map((sid) =>
      deriveMeta(sid, readEvents(projectDir, sid)),
    ),
  };
  const liveSids = new Set(sessionIds);
  const fallbackSid = newestRepairCandidate(projectDir, view.sessions);
  for (const [category, sid] of Object.entries(view.index.active)) {
    if (liveSids.has(sid)) continue;
    result.removedActive.push({ category, sid });
    delete view.index.active[category];
    if (category === "main" && fallbackSid) {
      view.index.active[category] = fallbackSid;
      result.reassignedActive.push({ category, from: sid, to: fallbackSid });
    }
  }

  if (
    !dryRun &&
    (result.removedActive.length > 0 || result.reassignedActive.length > 0)
  ) {
    updateIndex(projectDir, (index) => {
      for (const { category, sid } of result.removedActive) {
        // A hook may have replaced this pointer since repair inspected it.
        if (index.active[category] !== sid) continue;
        const replacement = view.index.active[category];
        if (replacement) index.active[category] = replacement;
        else delete index.active[category];
      }
    });
  }

  result.unchanged =
    result.repairedMeta.length === 0 &&
    result.quarantinedEvents.length === 0 &&
    result.removedActive.length === 0 &&
    result.reassignedActive.length === 0;
  return result;
}

export function purgeStateSessions(args: {
  projectDir?: string;
  olderThan: string;
  dryRun?: boolean;
  now?: Date;
}): PurgeResult {
  const projectDir = args.projectDir ?? resolveProjectRoot();
  const olderThanMs = parseOlderThan(args.olderThan);
  const cutoffMs = (args.now ?? new Date()).getTime() - olderThanMs;
  const view = collectState(projectDir);
  const activeSids = new Set(Object.values(view.index.active));
  const result: PurgeResult = {
    cutoff: new Date(cutoffMs).toISOString(),
    dryRun: args.dryRun === true,
    purged: [],
    skippedActive: [],
    skippedRecent: [],
  };

  for (const session of view.sessions) {
    if (activeSids.has(session.sid)) {
      result.skippedActive.push(session.sid);
      continue;
    }
    if (sessionTimestampMs(projectDir, session.sid, session) > cutoffMs) {
      result.skippedRecent.push(session.sid);
      continue;
    }
    result.purged.push(session.sid);
    if (!result.dryRun) {
      rmSync(sessionDir(projectDir, session.sid), {
        recursive: true,
        force: true,
      });
    }
  }

  // Active sessions were excluded above; there is no index mutation to save.
  // Rewriting the snapshot here would overwrite newer hook/CLI updates.

  return result;
}

function archiveBucket(meta: SessionMeta): string {
  const basis = meta.createdAt ?? new Date().toISOString();
  const parsed = new Date(basis);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toISOString().slice(0, 7);
}

export function archiveStateSessions(args: {
  projectDir?: string;
  olderThan: string;
  dryRun?: boolean;
  now?: Date;
}): ArchiveResult {
  const projectDir = args.projectDir ?? resolveProjectRoot();
  const olderThanMs = parseOlderThan(args.olderThan);
  const cutoffMs = (args.now ?? new Date()).getTime() - olderThanMs;
  const view = collectState(projectDir);
  const activeSids = new Set(Object.values(view.index.active));
  const result: ArchiveResult = {
    cutoff: new Date(cutoffMs).toISOString(),
    dryRun: args.dryRun === true,
    archived: [],
    skippedActive: [],
    skippedRecent: [],
    skippedOpen: [],
  };

  for (const session of view.sessions) {
    if (activeSids.has(session.sid)) {
      result.skippedActive.push(session.sid);
      continue;
    }
    if (session.status === "active") {
      result.skippedOpen.push(session.sid);
      continue;
    }
    if (sessionTimestampMs(projectDir, session.sid, session) > cutoffMs) {
      result.skippedRecent.push(session.sid);
      continue;
    }

    const to = join(
      archiveRoot(projectDir),
      archiveBucket(session),
      session.sid,
    );
    result.archived.push({ sid: session.sid, to });
    if (!result.dryRun) {
      mkdirSync(archiveRoot(projectDir), { recursive: true });
      mkdirSync(join(archiveRoot(projectDir), archiveBucket(session)), {
        recursive: true,
      });
      const from = sessionDir(projectDir, session.sid);
      if (existsSync(to)) throw new Error(`Archive already exists: ${to}`);
      try {
        renameSync(from, to);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
        // Legacy project sessions may live on a different volume from home.
        cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
        rmSync(from, { recursive: true });
      }
    }
  }

  // Active sessions were excluded above; preserve concurrent index updates.

  return result;
}
