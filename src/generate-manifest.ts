#!/usr/bin/env node
/**
 * Generate prompt-manifest.json with file list and SHA256 checksums
 *
 * Usage: bunx tsx src/generate-manifest.ts <version>
 * Example: bunx tsx src/generate-manifest.ts 1.2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const AGENT_DIR = '.agent';
const MANIFEST_FILE = 'prompt-manifest.json';

interface FileInfo {
  path: string;
  fullPath: string;
}

interface ManifestFile {
  path: string;
  sha256: string;
  size: number;
}

interface Manifest {
  name: string;
  version: string;
  releaseDate: string;
  repository: string;
  files: ManifestFile[];
  checksums: {
    algorithm: string;
  };
  metadata: {
    skillCount: number;
    workflowCount: number;
    totalFiles: number;
  };
}

function calculateSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getAllFiles(dirPath: string, arrayOfFiles: FileInfo[] = [], basePath = ''): FileInfo[] {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const relativePath = path.join(basePath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles, relativePath);
    } else {
      arrayOfFiles.push({
        path: relativePath,
        fullPath: fullPath
      });
    }
  }

  return arrayOfFiles;
}

function countByType(files: FileInfo[]): { skillCount: number; workflowCount: number } {
  let skillCount = 0;
  let workflowCount = 0;

  for (const file of files) {
    if (file.path.includes('skills/') && file.path.endsWith('SKILL.md')) {
      skillCount++;
    }
    if (file.path.includes('workflows/') && file.path.endsWith('.md')) {
      workflowCount++;
    }
  }

  return { skillCount, workflowCount };
}

function main(): void {
  const version = process.argv[2];

  if (!version) {
    console.error('Usage: bunx tsx src/generate-manifest.ts <version>');
    console.error('Example: bunx tsx src/generate-manifest.ts 1.2.0');
    process.exit(1);
  }

  // Validate version format (semver)
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    console.error(`Invalid version format: ${version}`);
    console.error('Expected semver format: X.Y.Z or X.Y.Z-prerelease');
    process.exit(1);
  }

  if (!fs.existsSync(AGENT_DIR)) {
    console.error(`Directory not found: ${AGENT_DIR}`);
    process.exit(1);
  }

  console.log(`Generating manifest for version ${version}...`);

  const allFiles = getAllFiles(AGENT_DIR, [], AGENT_DIR);
  const { skillCount, workflowCount } = countByType(allFiles);

  const filesWithChecksums: ManifestFile[] = allFiles.map(file => ({
    path: file.path,
    sha256: calculateSha256(file.fullPath),
    size: fs.statSync(file.fullPath).size
  }));

  const manifest: Manifest = {
    name: 'oh-my-antigravity',
    version: version,
    releaseDate: new Date().toISOString(),
    repository: 'https://github.com/first-fluke/oh-my-antigravity',
    files: filesWithChecksums,
    checksums: {
      algorithm: 'sha256'
    },
    metadata: {
      skillCount: skillCount,
      workflowCount: workflowCount,
      totalFiles: allFiles.length
    }
  };

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Generated ${MANIFEST_FILE}`);
  console.log(`  - Version: ${version}`);
  console.log(`  - Skills: ${skillCount}`);
  console.log(`  - Workflows: ${workflowCount}`);
  console.log(`  - Total files: ${allFiles.length}`);
}

main();
