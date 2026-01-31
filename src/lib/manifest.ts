import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import type { Manifest, ManifestFile } from "../types/index.js";
import { REPO } from "./skills.js";

export function calculateSHA256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export async function getFileSHA256(filePath: string): Promise<string | null> {
  try {
    const content = readFileSync(filePath, "utf-8");
    return calculateSHA256(content);
  } catch {
    return null;
  }
}

export async function getLocalVersion(targetDir: string): Promise<string | null> {
  const versionFile = join(targetDir, ".agent", "skills", "_version.json");
  if (!existsSync(versionFile)) return null;

  try {
    const content = readFileSync(versionFile, "utf-8");
    const json = JSON.parse(content);
    return json.version || null;
  } catch {
    return null;
  }
}

export async function saveLocalVersion(targetDir: string, version: string): Promise<void> {
  const versionFile = join(targetDir, ".agent", "skills", "_version.json");
  const versionDir = dirname(versionFile);

  if (!existsSync(versionDir)) {
    mkdirSync(versionDir, { recursive: true });
  }

  writeFileSync(versionFile, JSON.stringify({ version }, null, 2), "utf-8");
}

export async function fetchRemoteManifest(): Promise<Manifest> {
  const url = `https://raw.githubusercontent.com/${REPO}/main/prompt-manifest.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch remote manifest");

  return (await res.json()) as Manifest;
}

export async function downloadFile(
  manifestFile: ManifestFile
): Promise<{ path: string; success: boolean; error?: string }> {
  const url = `https://raw.githubusercontent.com/${REPO}/main/${manifestFile.path}`;
  const res = await fetch(url);

  if (!res.ok) {
    return { path: manifestFile.path, success: false, error: `HTTP ${res.status}` };
  }

  const content = await res.text();
  const actualSHA256 = calculateSHA256(content);

  if (actualSHA256 !== manifestFile.sha256) {
    return { path: manifestFile.path, success: false, error: "SHA256 mismatch" };
  }

  const targetPath = join(process.cwd(), manifestFile.path);
  const targetDir = dirname(targetPath);

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  writeFileSync(targetPath, content, "utf-8");
  return { path: manifestFile.path, success: true };
}
