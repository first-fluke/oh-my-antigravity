import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  fsyncSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";

export type TreeDigest = Record<string, string>;

/** Hash every file, retain empty directories, and never follow symbolic links. */
export function digestSessionTree(root: string): TreeDigest {
  const digest: TreeDigest = {};
  function visit(path: string, relative: string): void {
    const stat = lstatSync(path);
    if (stat.isDirectory()) {
      digest[`${relative}/`] = "directory";
      for (const name of readdirSync(path).sort()) {
        visit(join(path, name), relative ? `${relative}/${name}` : name);
      }
    } else if (stat.isFile()) {
      digest[relative] = createHash("sha256")
        .update(readFileSync(path))
        .digest("hex");
    } else {
      throw new Error(
        `Session migration does not follow links or special files: ${path}`,
      );
    }
  }
  visit(root, "");
  return digest;
}

export function sameSessionTree(a: TreeDigest, b: TreeDigest): boolean {
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([path, hash]) => b[path] === hash)
  );
}

/** Make a copied tree private and flush its files before publishing it. */
export function flushSessionCopy(root: string): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) flushSessionCopy(path);
    else {
      chmodSync(path, 0o600);
      const fd = openSync(path, "r+");
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    }
  }
  chmodSync(root, 0o700);
  flushSessionDirectory(root);
}

/** Persist directory entries before deleting the original copy. */
export function flushSessionDirectory(path: string): void {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    fsyncSync(fd);
  } catch (error) {
    // Directory handles/fsync are unsupported on Windows and some filesystems.
    if (
      process.platform !== "win32" &&
      !["EINVAL", "ENOTSUP", "EBADF"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
