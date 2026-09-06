import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { projectStateDir } from "./session-storage.ts";

const sleeper = new Int32Array(new SharedArrayBuffer(4));

function removeOwner(directory: string, owner: string): void {
  try {
    // Never recursively delete a published lock: another process may already
    // have acquired it. Its unique owner file keeps rmdir from removing it.
    unlinkSync(join(directory, owner));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    rmdirSync(directory);
  } catch (error) {
    if (
      !["ENOENT", "ENOTEMPTY", "EEXIST"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw error;
  }
}

function recoverDeadOwner(directory: string): void {
  try {
    const owners = readdirSync(directory);
    if (owners.length === 0) {
      // Windows does not replace even an empty destination directory.
      // rmdir succeeds only while empty, never after a new owner publishes.
      rmdirSync(directory);
      return;
    }
    for (const owner of owners) {
      if (!owner.startsWith("owner-")) continue;
      const meta = JSON.parse(readFileSync(join(directory, owner), "utf-8"));
      if (
        meta.hostname !== hostname() ||
        !Number.isSafeInteger(meta.pid) ||
        meta.pid <= 0
      )
        continue;
      try {
        process.kill(meta.pid, 0);
      } catch (error) {
        // EPERM is a live process we cannot signal, not a stale lock.
        if ((error as NodeJS.ErrnoException).code === "ESRCH")
          removeOwner(directory, owner);
      }
    }
  } catch {
    // A racing release/recovery or unreadable owner never grants ownership.
    // Only publishing our nonempty directory below can acquire the lock.
  }
}

/** Shared by the standalone Bun hooks and the CLI; no installed dependencies. */
export function withStateIndexLock<T>(
  projectDir: string,
  action: () => T,
  timeoutMs = 2000,
): T {
  return withLock(projectDir, "session-index", action, timeoutMs);
}

/** Serializes session writes with the final migration copy and path switch. */
export function withSessionWriteLock<T>(
  projectDir: string,
  sid: string,
  action: () => T,
): T {
  // Hashing also keeps legacy session IDs from becoming lock path components.
  return withLock(
    projectDir,
    `session-${createHash("sha256").update(sid).digest("hex")}`,
    action,
    2000,
  );
}

function withLock<T>(
  projectDir: string,
  name: string,
  action: () => T,
  timeoutMs: number,
): T {
  const root = join(projectStateDir(projectDir), "locks");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const lock = join(root, name);
  const owner = `owner-${process.pid}-${randomUUID()}`;
  const candidate = join(root, owner);
  mkdirSync(candidate);
  let acquired = false;
  try {
    writeFileSync(
      join(candidate, owner),
      JSON.stringify({ pid: process.pid, hostname: hostname() }),
    );
    const deadline = performance.now() + timeoutMs;
    while (!acquired) {
      try {
        // A populated directory cannot replace another populated directory.
        // Publishing the owner and lock together avoids an empty-lock crash
        // window. Empty directories left by interrupted release are reusable.
        renameSync(candidate, lock);
        acquired = true;
      } catch (error) {
        if (
          !["EEXIST", "ENOTEMPTY", "EPERM", "EACCES"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          )
        )
          throw error;
        recoverDeadOwner(lock);
        if (performance.now() >= deadline) {
          throw new Error(
            `Timed out waiting for state index lock: ${lock}. Another process may still be updating the session index.`,
          );
        }
        Atomics.wait(sleeper, 0, 0, 10);
      }
    }
    return action();
  } finally {
    removeOwner(acquired ? lock : candidate, owner);
  }
}
