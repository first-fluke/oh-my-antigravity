import { randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  withSessionWriteLock,
  withStateIndexLock,
} from "../../.agents/hooks/core/state-index-lock.ts";
import {
  atomicWriteJson,
  defaultIndex,
  ensureProfile,
  indexPath,
  isValidSid,
  legacySessionsDir,
  profileSlot,
  projectIdentity,
  projectStateDir,
  type StateIndex,
  sessionArchiveRoot,
  sessionsDir,
} from "./events.js";
import {
  digestSessionTree,
  flushSessionCopy,
  flushSessionDirectory,
  sameSessionTree,
  type TreeDigest,
} from "./session-copy.js";

export interface SessionMigrationEntry {
  sid: string;
  kind: "session" | "archive";
  source: string;
  destination: string;
  cleanup: string;
  pendingCleanup?: boolean;
}

export interface SessionMigrationResult {
  dryRun: boolean;
  projectDir: string;
  indexRemoved: boolean;
  migrated: SessionMigrationEntry[];
  skipped: Array<SessionMigrationEntry & { reason: string }>;
  failed: Array<SessionMigrationEntry & { reason: string }>;
}

function readStrictIndex(path: string): StateIndex {
  if (!existsSync(path)) return defaultIndex();
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as StateIndex;
  if (
    parsed?.schemaVersion !== 1 ||
    !parsed.active ||
    typeof parsed.active !== "object" ||
    Array.isArray(parsed.active) ||
    Object.values(parsed.active).some(
      (sid) => typeof sid !== "string" || !isValidSid(sid),
    )
  ) {
    throw new Error(`Cannot migrate with an invalid state index: ${path}`);
  }
  return parsed;
}

function activeIndex(projectDir: string): StateIndex {
  const current = indexPath(projectDir);
  return readStrictIndex(
    existsSync(current)
      ? current
      : join(legacySessionsDir(projectDir), "_index.json"),
  );
}

function candidates(projectDir: string): SessionMigrationEntry[] {
  const entries: SessionMigrationEntry[] = [];
  const cleanupRoot = join(
    projectDir,
    ".agents",
    "state",
    ".session-migration-cleanup",
  );
  function collect(
    root: string,
    destination: string,
    cleanup: string,
    kind: "session" | "archive",
    pendingCleanup = false,
  ) {
    if (!existsSync(root)) return;
    if (!lstatSync(root).isDirectory())
      throw new Error(`Invalid legacy session directory: ${root}`);
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isValidSid(entry.name)) continue;
      entries.push({
        sid: entry.name,
        kind,
        source: join(root, entry.name),
        destination: join(destination, entry.name),
        cleanup: join(cleanup, entry.name),
        pendingCleanup,
      });
    }
  }
  collect(
    legacySessionsDir(projectDir),
    sessionsDir(),
    join(cleanupRoot, "sessions"),
    "session",
  );
  collect(
    join(cleanupRoot, "sessions"),
    sessionsDir(),
    join(cleanupRoot, "sessions"),
    "session",
    true,
  );
  for (const [archive, pendingCleanup] of [
    [join(projectDir, ".agents", "state", "archive"), false],
    [join(cleanupRoot, "archive"), true],
  ] as const) {
    if (existsSync(archive)) {
      if (!lstatSync(archive).isDirectory())
        throw new Error(`Invalid legacy archive: ${archive}`);
      for (const bucket of readdirSync(archive, { withFileTypes: true })) {
        if (!bucket.isDirectory() || !isValidSid(bucket.name)) continue;
        collect(
          join(archive, bucket.name),
          join(sessionArchiveRoot(projectDir), bucket.name),
          join(cleanupRoot, "archive", bucket.name),
          "archive",
          pendingCleanup,
        );
      }
    }
  }
  return entries.sort(
    (a, b) =>
      Number(b.pendingCleanup) - Number(a.pendingCleanup) ||
      a.source.localeCompare(b.source),
  );
}

function validateDestination(
  projectDir: string,
  entry: SessionMigrationEntry,
  source: TreeDigest,
): void {
  const identity = projectIdentity(projectDir);
  const context = JSON.parse(
    readFileSync(join(entry.destination, "context.json"), "utf-8"),
  );
  if (context?.projectId !== identity.projectId || context.profile !== "0") {
    throw new Error(
      `Destination belongs to another project: ${entry.destination}`,
    );
  }
  const destination = digestSessionTree(entry.destination);
  // context.json is the only added file; every original byte must still match.
  if (!("context.json" in source)) delete destination["context.json"];
  const matches = entry.pendingCleanup
    ? Object.entries(source).every(([path, hash]) => destination[path] === hash)
    : sameSessionTree(source, destination);
  if (!matches) {
    throw new Error(
      `Destination differs from legacy session: ${entry.destination}`,
    );
  }
}

function migrateEntry(
  projectDir: string,
  entry: SessionMigrationEntry,
  dryRun: boolean,
): void {
  if (!entry.pendingCleanup && existsSync(entry.cleanup))
    throw new Error(`Pending source cleanup already exists: ${entry.cleanup}`);
  const source = digestSessionTree(entry.source);
  if (entry.pendingCleanup) {
    // Only remove remaining temporary originals still proven to exist at home.
    // A partially failed rm can leave a subset of the previously verified tree.
    validateDestination(projectDir, entry, source);
    if (!dryRun) {
      rmSync(entry.cleanup, { recursive: true });
      pruneEmptyParents(
        dirname(entry.cleanup),
        join(projectDir, ".agents", "state", ".session-migration-cleanup"),
      );
    }
    return;
  }
  const context = projectIdentity(projectDir);
  if ("context.json" in source) {
    const existing = JSON.parse(
      readFileSync(join(entry.source, "context.json"), "utf-8"),
    );
    if (existing?.projectId !== context.projectId || existing.profile !== "0") {
      throw new Error(
        `Legacy context belongs to another project: ${entry.source}`,
      );
    }
  }
  if (existsSync(entry.destination))
    validateDestination(projectDir, entry, source);
  if (dryRun) return;

  ensureProfile();
  const staging = join(
    projectStateDir(projectDir),
    "migration-staging",
    randomUUID(),
  );
  try {
    if (!existsSync(entry.destination)) {
      mkdirSync(dirname(staging), { recursive: true, mode: 0o700 });
      cpSync(entry.source, staging, {
        recursive: true,
        preserveTimestamps: true,
        errorOnExist: true,
        force: false,
      });
      if (!sameSessionTree(source, digestSessionTree(staging))) {
        throw new Error(`Session copy verification failed: ${entry.source}`);
      }
      if (!("context.json" in source)) {
        writeFileSync(
          join(staging, "context.json"),
          `${JSON.stringify(context, null, 2)}\n`,
          { mode: 0o600 },
        );
      }
      flushSessionCopy(staging);
      const originalStat = lstatSync(entry.source);
      utimesSync(staging, originalStat.atime, originalStat.mtime);
      if (!sameSessionTree(source, digestSessionTree(entry.source))) {
        throw new Error(`Legacy session changed during copy: ${entry.source}`);
      }
      mkdirSync(dirname(entry.destination), { recursive: true, mode: 0o700 });
      // A concurrently published, populated session directory cannot be replaced.
      if (existsSync(entry.destination))
        validateDestination(projectDir, entry, source);
      else renameSync(staging, entry.destination);
    }
    validateDestination(projectDir, entry, source);
    // The verified home tree must be durable before its only original is removed.
    flushSessionCopy(entry.destination);
    flushSessionDirectory(dirname(entry.destination));
    if (!sameSessionTree(source, digestSessionTree(entry.source))) {
      throw new Error(
        `Legacy session changed during migration: ${entry.source}`,
      );
    }

    // Adopt the old index before switching a session's authoritative directory.
    // Existing home pointers remain authoritative and are never overwritten.
    if (!existsSync(indexPath(projectDir)))
      atomicWriteJson(indexPath(projectDir), activeIndex(projectDir));
    mkdirSync(dirname(entry.cleanup), { recursive: true, mode: 0o700 });
    // Rename switches readers atomically; only then remove the verified original.
    // Interrupted cleanup is discoverable on the next migration run.
    renameSync(entry.source, entry.cleanup);
    if (!sameSessionTree(source, digestSessionTree(entry.cleanup))) {
      if (!existsSync(entry.source)) renameSync(entry.cleanup, entry.source);
      throw new Error(
        `Legacy session changed during path switch: ${entry.source}`,
      );
    }
    rmSync(entry.cleanup, { recursive: true });
    pruneEmptyParents(
      dirname(entry.cleanup),
      join(projectDir, ".agents", "state", ".session-migration-cleanup"),
    );
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    pruneEmptyParents(dirname(staging), dirname(staging));
  }
}

function pruneEmptyParents(path: string, boundary: string): void {
  for (let current = path; ; current = dirname(current)) {
    try {
      rmdirSync(current);
    } catch {
      return;
    }
    if (current === boundary) return;
  }
}

function removeLegacyIndex(projectDir: string, dryRun: boolean): boolean {
  const root = legacySessionsDir(projectDir);
  const legacy = join(root, "_index.json");
  if (
    !existsSync(legacy) ||
    readdirSync(root).some((name) => name !== "_index.json")
  )
    return false;
  const original = readFileSync(legacy);
  const oldIndex = readStrictIndex(legacy);
  if (existsSync(indexPath(projectDir))) readStrictIndex(indexPath(projectDir));
  if (!dryRun) {
    if (!existsSync(indexPath(projectDir))) {
      ensureProfile();
      atomicWriteJson(indexPath(projectDir), oldIndex);
    }
    if (!original.equals(readFileSync(legacy)))
      throw new Error("Legacy index changed during migration");
    rmSync(legacy);
    pruneEmptyParents(root, root);
  }
  return true;
}

export function migrateLegacySessions(args: {
  projectDir: string;
  dryRun?: boolean;
  includeActive?: boolean;
}): SessionMigrationResult {
  if (profileSlot() !== "0")
    throw new Error(
      "Legacy sessions can only migrate into profile 0 (OMA_PROFILE=0)",
    );
  const { projectDir } = args;
  const result: SessionMigrationResult = {
    projectDir,
    dryRun: args.dryRun === true,
    indexRemoved: false,
    migrated: [],
    skipped: [],
    failed: [],
  };
  const entries = candidates(projectDir);
  // Lock each session separately so large migrations do not block index writers.
  const run = (entry: SessionMigrationEntry) => {
    const active = new Set(Object.values(activeIndex(projectDir).active));
    if (
      !args.includeActive &&
      !entry.pendingCleanup &&
      entry.kind === "session" &&
      active.has(entry.sid)
    ) {
      result.skipped.push({ ...entry, reason: "active session" });
      return;
    }
    if (!existsSync(entry.source)) return; // another migration already finished
    try {
      const migrate = () => migrateEntry(projectDir, entry, result.dryRun);
      if (result.dryRun) migrate();
      else withSessionWriteLock(projectDir, entry.sid, migrate);
      result.migrated.push(entry);
    } catch (error) {
      result.failed.push({
        ...entry,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  };
  for (const entry of entries) {
    if (result.dryRun) run(entry);
    else withStateIndexLock(projectDir, () => run(entry));
  }
  if (existsSync(join(legacySessionsDir(projectDir), "_index.json"))) {
    const finalize = () => {
      result.indexRemoved = removeLegacyIndex(projectDir, result.dryRun);
    };
    if (result.dryRun) finalize();
    else withStateIndexLock(projectDir, finalize);
  }
  if (!result.dryRun) {
    pruneEmptyParents(
      legacySessionsDir(projectDir),
      legacySessionsDir(projectDir),
    );
  }
  return result;
}

export function sessionMigrationActions(
  result: SessionMigrationResult,
): string[] {
  return [
    ...result.migrated.map(
      (entry) =>
        `${result.dryRun ? "would migrate" : "migrated"} ${entry.source} → ${entry.destination}; ${result.dryRun ? "would remove" : "removed"} original`,
    ),
    ...result.skipped.map((entry) => `deferred ${entry.sid}: ${entry.reason}`),
    ...result.failed.map(
      (entry) => `session migration failed for ${entry.sid}: ${entry.reason}`,
    ),
    ...(result.indexRemoved
      ? [
          `${result.dryRun ? "would remove" : "removed"} migrated legacy session index`,
        ]
      : []),
  ];
}
