#!/usr/bin/env node
import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import pMap from "p-map";
import { startDashboard } from "./dashboard";
import { startTerminalDashboard } from "./terminal-dashboard";

const REPO = "first-fluke/oh-my-ag";
const GITHUB_RAW = `https://raw.githubusercontent.com/${REPO}/main/.agent/skills`;
const VERSION = "1.1.1";

const SKILLS = {
  domain: [
    { name: "frontend-agent", desc: "React/Next.js UI specialist" },
    { name: "backend-agent", desc: "FastAPI/SQLAlchemy API specialist" },
    { name: "mobile-agent", desc: "Flutter/Dart mobile specialist" },
  ],
  coordination: [
    { name: "pm-agent", desc: "Product manager - task decomposition" },
    { name: "qa-agent", desc: "QA - OWASP, Lighthouse, WCAG" },
    { name: "workflow-guide", desc: "Manual multi-agent orchestration" },
    { name: "orchestrator", desc: "Automated parallel CLI execution" },
  ],
  utility: [
    { name: "debug-agent", desc: "Bug fixing specialist" },
    { name: "commit", desc: "Conventional Commits helper" },
  ],
};

const PRESETS: Record<string, string[]> = {
  fullstack: ["frontend-agent", "backend-agent", "pm-agent", "qa-agent", "debug-agent", "commit"],
  frontend: ["frontend-agent", "pm-agent", "qa-agent", "debug-agent", "commit"],
  backend: ["backend-agent", "pm-agent", "qa-agent", "debug-agent", "commit"],
  mobile: ["mobile-agent", "pm-agent", "qa-agent", "debug-agent", "commit"],
  all: [...SKILLS.domain, ...SKILLS.coordination, ...SKILLS.utility].map((s) => s.name),
};

// Skill installation functions
async function fetchSkillFiles(skillName: string): Promise<string[]> {
  const files = ["SKILL.md"];
  const resourceFiles = [
    "resources/execution-protocol.md",
    "resources/tech-stack.md",
    "resources/checklist.md",
    "resources/templates.md",
    "resources/error-playbook.md",
  ];

  for (const file of resourceFiles) {
    const url = `${GITHUB_RAW}/${skillName}/${file}`;
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) files.push(file);
  }

  return files;
}

async function installSkill(skillName: string, targetDir: string): Promise<boolean> {
  const skillDir = join(targetDir, ".agent", "skills", skillName);
  const files = await fetchSkillFiles(skillName);

  for (const file of files) {
    const url = `${GITHUB_RAW}/${skillName}/${file}`;
    const res = await fetch(url);
    if (!res.ok) continue;

    const content = await res.text();
    const filePath = join(skillDir, file);
    const fileDir = dirname(filePath);

    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }
    writeFileSync(filePath, content, "utf-8");
  }

  return true;
}

async function installShared(targetDir: string): Promise<void> {
  const sharedDir = join(targetDir, ".agent", "skills", "_shared");
  const files = [
    "reasoning-templates.md",
    "clarification-protocol.md",
    "context-loading.md",
    "skill-routing.md",
  ];

  if (!existsSync(sharedDir)) {
    mkdirSync(sharedDir, { recursive: true });
  }

  for (const file of files) {
    const url = `${GITHUB_RAW}/_shared/${file}`;
    const res = await fetch(url);
    if (!res.ok) continue;

    const content = await res.text();
    writeFileSync(join(sharedDir, file), content, "utf-8");
  }
}

// Manifest and update functions
function calculateSHA256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

async function getFileSHA256(filePath: string): Promise<string | null> {
  try {
    const content = readFileSync(filePath, "utf-8");
    return calculateSHA256(content);
  } catch {
    return null;
  }
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
}

async function getLocalVersion(targetDir: string): Promise<string | null> {
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

async function saveLocalVersion(targetDir: string, version: string): Promise<void> {
  const versionFile = join(targetDir, ".agent", "skills", "_version.json");
  const versionDir = dirname(versionFile);

  if (!existsSync(versionDir)) {
    mkdirSync(versionDir, { recursive: true });
  }

  writeFileSync(versionFile, JSON.stringify({ version }, null, 2), "utf-8");
}

async function fetchRemoteManifest(): Promise<Manifest> {
  const url = `https://raw.githubusercontent.com/${REPO}/main/prompt-manifest.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch remote manifest");

  return (await res.json()) as Manifest;
}

async function downloadFile(manifestFile: ManifestFile): Promise<{ path: string; success: boolean; error?: string }> {
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

// Command implementations
async function update(): Promise<void> {
  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 🛸 oh-my-ag update ")));

  const cwd = process.cwd();
  const spinner = p.spinner();

  try {
    spinner.start("Checking for updates...");

    const remoteManifest = await fetchRemoteManifest();
    const localVersion = await getLocalVersion(cwd);

    if (localVersion === remoteManifest.version) {
      spinner.stop(pc.green("Already up to date!"));
      p.outro(`Current version: ${pc.cyan(localVersion)}`);
      return;
    }

    spinner.message(`Updating from ${localVersion || "not installed"} to ${pc.cyan(remoteManifest.version)}...`);

    const results = await pMap(
      remoteManifest.files,
      async (file) => downloadFile(file),
      { concurrency: 10 }
    );

    const failures = results.filter((r) => !r.success);

    if (failures.length > 0) {
      spinner.stop("Update completed with errors");
      p.note(
        failures.map((f) => `${pc.red("✗")} ${f.path}: ${f.error}`).join("\n"),
        `${failures.length} files failed`
      );
    } else {
      spinner.stop(`Updated to version ${pc.cyan(remoteManifest.version)}!`);
    }

    await saveLocalVersion(cwd, remoteManifest.version);

    const successCount = results.length - failures.length;
    p.outro(
      failures.length > 0
        ? `${successCount} files updated, ${failures.length} failed`
        : `${successCount} files updated successfully`
    );
  } catch (error) {
    spinner.stop("Update failed");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Doctor command
interface CLICheck {
  name: string;
  installed: boolean;
  version?: string;
  installCmd: string;
}

interface SkillCheck {
  name: string;
  installed: boolean;
  hasSkillMd: boolean;
}

async function checkCLI(name: string, command: string, installCmd: string): Promise<CLICheck> {
  try {
    const version = execSync(`${command} --version`, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    return { name, installed: true, version, installCmd };
  } catch {
    return { name, installed: false, installCmd };
  }
}

async function checkMCPConfig(cliName: string): Promise<{ configured: boolean; path?: string }> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const configs: Record<string, { path: string; type: "json" | "yaml" | "toml" }> = {
    gemini: { path: `${homeDir}/.gemini/settings.json`, type: "json" },
    claude: { path: `${homeDir}/.claude.json`, type: "json" },
    codex: { path: `${homeDir}/.codex/config.toml`, type: "toml" },
  };

  const config = configs[cliName];
  if (!config) return { configured: false };

  if (existsSync(config.path)) {
    try {
      const content = readFileSync(config.path, "utf-8");
      if (config.type === "json") {
        const json = JSON.parse(content);
        const hasMCP = json.mcpServers || json.mcp;
        return { configured: !!hasMCP, path: config.path };
      }
      return { configured: true, path: config.path };
    } catch {
      return { configured: false };
    }
  }

  return { configured: false };
}

async function checkSkills(): Promise<SkillCheck[]> {
  const skillsDir = join(process.cwd(), ".agent", "skills");
  if (!existsSync(skillsDir)) return [];

  const allSkills = [...SKILLS.domain, ...SKILLS.coordination, ...SKILLS.utility];
  const checks: SkillCheck[] = [];

  for (const skill of allSkills) {
    const skillPath = join(skillsDir, skill.name);
    const skillMdPath = join(skillPath, "SKILL.md");

    checks.push({
      name: skill.name,
      installed: existsSync(skillPath),
      hasSkillMd: existsSync(skillMdPath),
    });
  }

  return checks;
}

async function doctor(jsonMode = false): Promise<void> {
  const cwd = process.cwd();

  const clis = await Promise.all([
    checkCLI("gemini", "gemini", "bun install --global @anthropic-ai/gemini-cli"),
    checkCLI("claude", "claude", "bun install --global @anthropic-ai/claude-code"),
    checkCLI("codex", "codex", "bun install --global @openai/codex"),
    checkCLI("qwen", "qwen", "bun install --global @qwen-code/qwen-code"),
  ]);

  const mcpChecks = await Promise.all(
    clis.filter((c) => c.installed).map(async (cli) => {
      const mcp = await checkMCPConfig(cli.name);
      return { ...cli, mcp };
    })
  );

  const skillChecks = await checkSkills();

  const serenaDir = join(cwd, ".serena", "memories");
  const hasSerena = existsSync(serenaDir);
  let serenaFileCount = 0;
  if (hasSerena) {
    try {
      serenaFileCount = readdirSync(serenaDir).length;
    } catch {}
  }

  const missingCLIs = clis.filter((c) => !c.installed);
  const missingSkills = skillChecks.length > 0
    ? skillChecks.filter((s) => !s.installed || !s.hasSkillMd)
    : [...SKILLS.domain, ...SKILLS.coordination, ...SKILLS.utility].map((s) => ({ name: s.name, installed: false, hasSkillMd: false }));

  const totalIssues =
    missingCLIs.length +
    mcpChecks.filter((c) => !c.mcp.configured).length +
    missingSkills.length;

    if (jsonMode) {
    const result = {
      ok: totalIssues === 0,
      issues: totalIssues,
      clis: clis.map((c) => ({ name: c.name, installed: c.installed, version: c.version || null })),
      mcp: mcpChecks.map((c) => ({ name: c.name, configured: c.mcp.configured, path: c.mcp.path || null })),
      skills: skillChecks.length > 0
        ? skillChecks.map((s) => ({ name: s.name, installed: s.installed, complete: s.hasSkillMd }))
        : [],
      missingSkills: missingSkills.map((s) => s.name),
      serena: { exists: hasSerena, fileCount: serenaFileCount },
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(totalIssues === 0 ? 0 : 1);
  }

  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 🩺 oh-my-ag doctor ")));

  const spinner = p.spinner();

  try {
    const cliTable = [
      pc.bold("🔍 CLI Installation Status"),
      "┌─────────┬──────────┬─────────────┐",
      `│ ${pc.bold("CLI")}     │ ${pc.bold("Status")}     │ ${pc.bold("Version")}       │`,
      "├─────────┼──────────┼─────────────┤",
      ...clis.map((cli) => {
        const status = cli.installed ? pc.green("✅ Installed") : pc.red("❌ Missing");
        const version = cli.version || "-";
        return `│ ${cli.name.padEnd(7)} │ ${status.padEnd(8)} │ ${version.padEnd(11)} │`;
      }),
      "└─────────┴──────────┴─────────────┘",
    ].join("\n");

    p.note(cliTable, "CLI Status");

    if (missingCLIs.length > 0) {
      p.note(
        missingCLIs.map((cli) => `${pc.yellow("→")} ${cli.name}: ${pc.dim(cli.installCmd)}`).join("\n"),
        "Install missing CLIs"
      );
    }

    if (mcpChecks.length > 0) {
      const mcpTable = [
        pc.bold("🔗 MCP Connection Status"),
        "┌─────────┬──────────┬─────────────────────┐",
        `│ ${pc.bold("CLI")}     │ ${pc.bold("MCP Config")} │ ${pc.bold("Path")}                │`,
        "├─────────┼──────────┼─────────────────────┤",
        ...mcpChecks.map((cli) => {
          const status = cli.mcp.configured ? pc.green("✅ Configured") : pc.yellow("⚠️  Not configured");
          const path = cli.mcp.path ? cli.mcp.path.split("/").pop() || "" : "-";
          return `│ ${cli.name.padEnd(7)} │ ${status.padEnd(8)} │ ${path.padEnd(19)} │`;
        }),
        "└─────────┴──────────┴─────────────────────┘",
      ].join("\n");

      p.note(mcpTable, "MCP Status");
    }

    const installedCount = skillChecks.filter((s) => s.installed).length;
    const completeCount = skillChecks.filter((s) => s.hasSkillMd).length;

    if (skillChecks.length > 0) {
      const skillTable = [
        pc.bold(`📦 Skills (${installedCount}/${skillChecks.length} installed, ${completeCount} complete)`),
        "┌────────────────────┬──────────┬─────────────┐",
        `│ ${pc.bold("Skill")}                │ ${pc.bold("Installed")} │ ${pc.bold("SKILL.md")}    │`,
        "├────────────────────┼──────────┼─────────────┤",
        ...skillChecks.map((skill) => {
          const installed = skill.installed ? pc.green("✅") : pc.red("❌");
          const hasMd = skill.hasSkillMd ? pc.green("✅") : pc.red("❌");
          return `│ ${skill.name.padEnd(18)} │ ${installed.padEnd(8)} │ ${hasMd.padEnd(11)} │`;
        }),
        "└────────────────────┴──────────┴─────────────┘",
      ].join("\n");

      p.note(skillTable, "Skills Status");
    } else {
      p.note(pc.yellow("No skills installed."), "Skills Status");
    }

    if (missingSkills.length > 0) {
      const shouldRepair = await p.confirm({
        message: `Found ${missingSkills.length} missing/incomplete skill(s). Install them?`,
        initialValue: true,
      });

      if (p.isCancel(shouldRepair)) {
        p.cancel("Cancelled.");
        process.exit(0);
      }

      if (shouldRepair) {
        const allSkillNames = missingSkills.map((s) => s.name);

        const selectMode = await p.select({
          message: "Which skills to install?",
          options: [
            { value: "all", label: `✨ All (${allSkillNames.length} skills)`, hint: "Recommended" },
            { value: "select", label: "🔧 Select individually" },
          ],
        });

        if (p.isCancel(selectMode)) {
          p.cancel("Cancelled.");
          process.exit(0);
        }

        let skillsToInstall: string[];

        if (selectMode === "select") {
          const allSkills = [...SKILLS.domain, ...SKILLS.coordination, ...SKILLS.utility];
          const selected = await p.multiselect({
            message: "Select skills to install:",
            options: missingSkills.map((s) => {
              const skillInfo = allSkills.find((sk) => sk.name === s.name);
              return {
                value: s.name,
                label: s.name,
                hint: skillInfo?.desc || "",
              };
            }),
            required: true,
          });

          if (p.isCancel(selected)) {
            p.cancel("Cancelled.");
            process.exit(0);
          }
          skillsToInstall = selected as string[];
        } else {
          skillsToInstall = allSkillNames;
        }

        spinner.start("Installing skills...");

        try {
          await installShared(cwd);

          for (const skillName of skillsToInstall) {
            spinner.message(`Installing ${pc.cyan(skillName)}...`);
            await installSkill(skillName, cwd);
          }

          spinner.stop(`Installed ${skillsToInstall.length} skill(s)!`);
          p.note(
            skillsToInstall.map((s) => `${pc.green("✓")} ${s}`).join("\n"),
            "Installed Skills"
          );
        } catch (error) {
          spinner.stop("Installation failed");
          p.log.error(error instanceof Error ? error.message : String(error));
        }
      }
    }

    if (hasSerena) {
      p.note(
        `${pc.green("✅")} Serena memory directory exists\n${pc.dim(`${serenaFileCount} memory files found`)}`,
        "Serena Memory"
      );
    } else {
      p.note(
        `${pc.yellow("⚠️")} Serena memory directory not found\n${pc.dim("Dashboard will show 'No agents detected'")}`,
        "Serena Memory"
      );
    }

    if (totalIssues === 0) {
      p.outro(pc.green("✅ All checks passed! Ready to use."));
    } else {
      p.outro(pc.yellow(`⚠️  Found ${totalIssues} issue(s). See details above.`));
    }
  } catch (error) {
    if (spinner) spinner.stop("Check failed");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Stats command
interface Metrics {
  sessions: number;
  skillsUsed: Record<string, number>;
  tasksCompleted: number;
  totalSessionTime: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  lastUpdated: string;
  startDate: string;
}

function getMetricsPath(cwd: string): string {
  return join(cwd, ".serena", "metrics.json");
}

function createEmptyMetrics(): Metrics {
  return {
    sessions: 0,
    skillsUsed: {},
    tasksCompleted: 0,
    totalSessionTime: 0,
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0,
    lastUpdated: new Date().toISOString(),
    startDate: new Date().toISOString(),
  };
}

function loadMetrics(cwd: string): Metrics {
  const metricsPath = getMetricsPath(cwd);
  if (existsSync(metricsPath)) {
    try {
      return JSON.parse(readFileSync(metricsPath, "utf-8"));
    } catch {
      return createEmptyMetrics();
    }
  }
  return createEmptyMetrics();
}

function saveMetrics(cwd: string, metrics: Metrics): void {
  const metricsPath = getMetricsPath(cwd);
  const metricsDir = dirname(metricsPath);
  if (!existsSync(metricsDir)) {
    mkdirSync(metricsDir, { recursive: true });
  }
  metrics.lastUpdated = new Date().toISOString();
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), "utf-8");
}

function getGitStats(cwd: string): { filesChanged: number; linesAdded: number; linesRemoved: number } {
  try {
    const diffStat = execSync("git diff --stat HEAD~10 2>/dev/null || git diff --stat", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    const lines = diffStat.trim().split("\n");
    const summaryLine = lines[lines.length - 1] || "";

    const filesMatch = summaryLine.match(/(\d+) files? changed/);
    const addMatch = summaryLine.match(/(\d+) insertions?\(\+\)/);
    const removeMatch = summaryLine.match(/(\d+) deletions?\(-\)/);

    return {
      filesChanged: filesMatch?.[1] ? parseInt(filesMatch[1], 10) : 0,
      linesAdded: addMatch?.[1] ? parseInt(addMatch[1], 10) : 0,
      linesRemoved: removeMatch?.[1] ? parseInt(removeMatch[1], 10) : 0,
    };
  } catch {
    return { filesChanged: 0, linesAdded: 0, linesRemoved: 0 };
  }
}

function detectSkillsFromMemories(cwd: string): Record<string, number> {
  const memoriesDir = join(cwd, ".serena", "memories");
  const skillsUsed: Record<string, number> = {};

  if (!existsSync(memoriesDir)) return skillsUsed;

  try {
    const files = readdirSync(memoriesDir);
    for (const file of files) {
      const match = file.match(/(?:progress|result)-(\w+)/);
      if (match?.[1]) {
        const skill = match[1];
        skillsUsed[skill] = (skillsUsed[skill] || 0) + 1;
      }
    }
  } catch {}

  return skillsUsed;
}

async function stats(jsonMode = false, resetMode = false): Promise<void> {
  const cwd = process.cwd();
  const metricsPath = getMetricsPath(cwd);

  if (resetMode) {
    if (existsSync(metricsPath)) {
      writeFileSync(metricsPath, JSON.stringify(createEmptyMetrics(), null, 2), "utf-8");
    }
    if (jsonMode) {
      console.log(JSON.stringify({ reset: true }));
    } else {
      console.log(pc.green("✅ Metrics reset successfully."));
    }
    return;
  }

  const metrics = loadMetrics(cwd);
  const gitStats = getGitStats(cwd);
  const detectedSkills = detectSkillsFromMemories(cwd);

  for (const [skill, count] of Object.entries(detectedSkills)) {
    metrics.skillsUsed[skill] = (metrics.skillsUsed[skill] || 0) + count;
  }

  metrics.filesChanged += gitStats.filesChanged;
  metrics.linesAdded += gitStats.linesAdded;
  metrics.linesRemoved += gitStats.linesRemoved;
  metrics.sessions += 1;

  saveMetrics(cwd, metrics);

  const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(metrics.startDate).getTime()) / (1000 * 60 * 60 * 24)));
  const avgSessionTime = metrics.sessions > 0 ? Math.round(metrics.totalSessionTime / metrics.sessions) : 0;

  if (jsonMode) {
    console.log(JSON.stringify({
      ...metrics,
      gitStats,
      daysSinceStart,
      avgSessionTime,
    }, null, 2));
    return;
  }

  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 📊 oh-my-ag stats ")));

  const statsTable = [
    pc.bold(`📈 Productivity Metrics (${daysSinceStart} days)`),
    "┌─────────────────────┬──────────────┐",
    `│ ${pc.bold("Metric")}              │ ${pc.bold("Value")}        │`,
    "├─────────────────────┼──────────────┤",
    `│ Sessions            │ ${String(metrics.sessions).padEnd(12)} │`,
    `│ Tasks Completed     │ ${String(metrics.tasksCompleted).padEnd(12)} │`,
    `│ Files Changed       │ ${String(metrics.filesChanged).padEnd(12)} │`,
    `│ Lines Added         │ ${pc.green("+" + metrics.linesAdded).padEnd(12)} │`,
    `│ Lines Removed       │ ${pc.red("-" + metrics.linesRemoved).padEnd(12)} │`,
    "└─────────────────────┴──────────────┘",
  ].join("\n");

  p.note(statsTable, "Overview");

  const sortedSkills = Object.entries(metrics.skillsUsed)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (sortedSkills.length > 0) {
    const skillsTable = [
      pc.bold("🏆 Top Skills Used"),
      ...sortedSkills.map(([skill, count], i) => `  ${i + 1}. ${skill} (${count})`),
    ].join("\n");

    p.note(skillsTable, "Skills");
  }

  p.outro(pc.dim(`Data stored in: ${metricsPath}`));
}

// Retro command
interface Retrospective {
  id: string;
  date: string;
  summary: string;
  keyLearnings: string[];
  filesChanged: string[];
  nextSteps: string[];
}

function getRetroPath(cwd: string): string {
  return join(cwd, ".serena", "retrospectives");
}

function loadRetrospectives(cwd: string): Retrospective[] {
  const retroDir = getRetroPath(cwd);
  if (!existsSync(retroDir)) return [];

  try {
    const files = readdirSync(retroDir).filter((f) => f.endsWith(".json")).sort().reverse();
    return files.slice(0, 10).map((f) => JSON.parse(readFileSync(join(retroDir, f), "utf-8")));
  } catch {
    return [];
  }
}

function saveRetrospective(cwd: string, retro: Retrospective): void {
  const retroDir = getRetroPath(cwd);
  if (!existsSync(retroDir)) {
    mkdirSync(retroDir, { recursive: true });
  }
  const filename = `${retro.date.replace(/[:.]/g, "-")}_${retro.id}.json`;
  writeFileSync(join(retroDir, filename), JSON.stringify(retro, null, 2), "utf-8");
}

function getRecentGitCommits(cwd: string, limit = 5): string[] {
  try {
    const logs = execSync(`git log --oneline -${limit} 2>/dev/null`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return logs.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getRecentChangedFiles(cwd: string): string[] {
  try {
    const files = execSync("git diff --name-only HEAD~5 2>/dev/null || git diff --name-only", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return files.trim().split("\n").filter(Boolean).slice(0, 10);
  } catch {
    return [];
  }
}

async function retro(jsonMode = false): Promise<void> {
  const cwd = process.cwd();
  const retroDir = getRetroPath(cwd);
  const existingRetros = loadRetrospectives(cwd);

  if (jsonMode) {
    console.log(JSON.stringify({ retrospectives: existingRetros }, null, 2));
    return;
  }

  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 🔄 oh-my-ag retro ")));

  const recentRetro = existingRetros[0];
  if (recentRetro) {
    p.note(
      [
        pc.bold("📅 Last Retrospective"),
        `Date: ${recentRetro.date}`,
        "",
        pc.bold("Summary:"),
        recentRetro.summary,
        "",
        pc.bold("Key Learnings:"),
        ...recentRetro.keyLearnings.map((l) => `  • ${l}`),
        "",
        pc.bold("Next Steps:"),
        ...recentRetro.nextSteps.map((s) => `  → ${s}`),
      ].join("\n"),
      "Previous Session"
    );
  }

  const action = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "new", label: "📝 Create new retrospective" },
      { value: "list", label: "📋 View past retrospectives" },
      { value: "exit", label: "👋 Exit" },
    ],
  });

  if (p.isCancel(action) || action === "exit") {
    p.outro(pc.dim("Goodbye!"));
    return;
  }

  if (action === "list") {
    if (existingRetros.length === 0) {
      p.note(pc.yellow("No retrospectives found."), "History");
    } else {
      const list = existingRetros.map((r, i) => `${i + 1}. [${r.date.split("T")[0]}] ${r.summary.slice(0, 50)}...`).join("\n");
      p.note(list, `📚 Past Retrospectives (${existingRetros.length})`);
    }
    p.outro(pc.dim(`Stored in: ${retroDir}`));
    return;
  }

  const recentCommits = getRecentGitCommits(cwd);
  const changedFiles = getRecentChangedFiles(cwd);

  if (recentCommits.length > 0) {
    p.note(recentCommits.join("\n"), "Recent Commits");
  }
  if (changedFiles.length > 0) {
    p.note(changedFiles.join("\n"), "Changed Files");
  }

  const summary = await p.text({
    message: "What did you accomplish in this session?",
    placeholder: "e.g., Implemented user authentication flow",
  });

  if (p.isCancel(summary)) {
    p.cancel("Cancelled.");
    return;
  }

  const learningsInput = await p.text({
    message: "Key learnings? (comma-separated)",
    placeholder: "e.g., JWT needs refresh token, bcrypt is slow",
  });

  if (p.isCancel(learningsInput)) {
    p.cancel("Cancelled.");
    return;
  }

  const nextStepsInput = await p.text({
    message: "Next steps? (comma-separated)",
    placeholder: "e.g., Add password reset, Write tests",
  });

  if (p.isCancel(nextStepsInput)) {
    p.cancel("Cancelled.");
    return;
  }

  const retro: Retrospective = {
    id: Math.random().toString(36).slice(2, 8),
    date: new Date().toISOString(),
    summary: summary as string,
    keyLearnings: (learningsInput as string).split(",").map((s) => s.trim()).filter(Boolean),
    filesChanged: changedFiles,
    nextSteps: (nextStepsInput as string).split(",").map((s) => s.trim()).filter(Boolean),
  };

  saveRetrospective(cwd, retro);

  p.note(
    [
      pc.green("✅ Retrospective saved!"),
      "",
      `Summary: ${retro.summary}`,
      `Learnings: ${retro.keyLearnings.length} items`,
      `Next steps: ${retro.nextSteps.length} items`,
    ].join("\n"),
    "Saved"
  );

  p.outro(pc.dim(`Stored in: ${retroDir}`));
}

// Cleanup command
interface CleanupResult {
  cleaned: number;
  skipped: number;
  details: string[];
}

async function cleanup(dryRun = false, jsonMode = false): Promise<void> {
  const cwd = process.cwd();
  const resultsDir = join(cwd, ".agent", "results");
  const tmpDir = "/tmp";

  const result: CleanupResult = {
    cleaned: 0,
    skipped: 0,
    details: [],
  };

  const logAction = (msg: string) => {
    result.details.push(dryRun ? `[DRY-RUN] ${msg}` : `[CLEAN] ${msg}`);
    result.cleaned++;
  };

  const logSkip = (msg: string) => {
    result.details.push(`[SKIP] ${msg}`);
    result.skipped++;
  };

  // Step 1: Clean up /tmp/subagent-*.pid files
  try {
    const pidFiles = readdirSync(tmpDir).filter((f) => f.startsWith("subagent-") && f.endsWith(".pid"));

    for (const pidFile of pidFiles) {
      const pidPath = join(tmpDir, pidFile);
      const pidContent = readFileSync(pidPath, "utf-8").trim();

      if (!pidContent) {
        logAction(`Removing empty PID file: ${pidPath}`);
        if (!dryRun) {
          try {
            execSync(`rm -f "${pidPath}"`);
          } catch {}
        }
        continue;
      }

      const pid = parseInt(pidContent, 10);
      if (isNaN(pid)) {
        logAction(`Removing invalid PID file: ${pidPath}`);
        if (!dryRun) {
          try {
            execSync(`rm -f "${pidPath}"`);
          } catch {}
        }
        continue;
      }

      // Check if process is running
      try {
        execSync(`kill -0 ${pid} 2>/dev/null`);
        // Process is running - kill it
        logAction(`Killing orphaned process PID=${pid} (from ${pidPath})`);
        if (!dryRun) {
          try {
            execSync(`kill ${pid} 2>/dev/null || true`);
            // Wait briefly, then force-kill if still alive
            await new Promise((resolve) => setTimeout(resolve, 1000));
            try {
              execSync(`kill -0 ${pid} 2>/dev/null`);
              execSync(`kill -9 ${pid} 2>/dev/null || true`);
            } catch {
              // Process already dead
            }
            execSync(`rm -f "${pidPath}"`);
          } catch {}
        }
      } catch {
        // Process not running - just remove stale PID file
        logAction(`Removing stale PID file (process gone): ${pidPath}`);
        if (!dryRun) {
          try {
            execSync(`rm -f "${pidPath}"`);
          } catch {}
        }
      }
    }
  } catch {
    // /tmp directory might not be accessible
  }

  // Step 2: Clean up /tmp/subagent-*.log files
  try {
    const logFiles = readdirSync(tmpDir).filter((f) => f.startsWith("subagent-") && f.endsWith(".log"));

    for (const logFile of logFiles) {
      const logPath = join(tmpDir, logFile);
      const pidFile = logFile.replace(".log", ".pid");
      const pidPath = join(tmpDir, pidFile);

      // Check if there's a matching PID file with a running process
      if (existsSync(pidPath)) {
        try {
          const pidContent = readFileSync(pidPath, "utf-8").trim();
          const pid = parseInt(pidContent, 10);
          if (!isNaN(pid)) {
            execSync(`kill -0 ${pid} 2>/dev/null`);
            logSkip(`Log file has active process: ${logPath}`);
            continue;
          }
        } catch {
          // Process not running or invalid PID
        }
      }

      logAction(`Removing stale log file: ${logPath}`);
      if (!dryRun) {
        try {
          execSync(`rm -f "${logPath}"`);
        } catch {}
      }
    }
  } catch {
    // /tmp directory might not be accessible
  }

  // Step 3: Clean up parallel-run PID list files
  if (existsSync(resultsDir)) {
    try {
      const parallelDirs = readdirSync(resultsDir).filter((d) => d.startsWith("parallel-"));

      for (const parallelDir of parallelDirs) {
        const pidsPath = join(resultsDir, parallelDir, "pids.txt");
        if (!existsSync(pidsPath)) continue;

        const pidsContent = readFileSync(pidsPath, "utf-8");
        const lines = pidsContent.split("\n").filter((l) => l.trim());

        let hasRunning = false;
        for (const line of lines) {
          const [pidStr, agent] = line.split(":");
          const pid = parseInt(pidStr?.trim() || "", 10);
          if (isNaN(pid)) continue;

          try {
            execSync(`kill -0 ${pid} 2>/dev/null`);
            hasRunning = true;
            logAction(`Killing orphaned parallel agent PID=${pid} (${agent?.trim() || "unknown"})`);
            if (!dryRun) {
              try {
                execSync(`kill ${pid} 2>/dev/null || true`);
              execSync(`rm -f "${pidsPath}"`);
              } catch {}
            }
          } catch {
            // Process not running
          }
        }

        if (!hasRunning) {
          logAction(`Removing stale PID list: ${pidsPath}`);
          if (!dryRun) {
            try {
              execSync(`rm -f "${pidsPath}"`);
            } catch {}
          }
        } else {
          // Give processes time to die, then clean up
          if (!dryRun) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            try {
              execSync(`rm -f "${pidsPath}"`);
            } catch {}
          }
        }
      }
    } catch {
      // Error reading results directory
    }
  } else {
    logSkip(`No results directory found: ${resultsDir}`);
  }

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 🧹 oh-my-ag cleanup ")));

  if (dryRun) {
    p.note(pc.yellow("Dry-run mode — no changes will be made"), "Mode");
  }

  if (result.details.length > 0) {
    const detailsTable = [
      pc.bold("Cleanup Details"),
      ...result.details.map((d) => {
        if (d.startsWith("[DRY-RUN]")) return pc.yellow(d);
        if (d.startsWith("[CLEAN]")) return pc.green(d);
        return pc.cyan(d);
      }),
    ].join("\n");

    p.note(detailsTable, "Details");
  }

  const summaryTable = [
    pc.bold("Summary"),
    `┌─────────┬────────┐`,
    `│ ${pc.bold("Action")}  │ ${pc.bold("Count")}  │`,
    `├─────────┼────────┤`,
    `│ Cleaned │ ${String(result.cleaned).padEnd(6)} │`,
    `│ Skipped │ ${String(result.skipped).padEnd(6)} │`,
    `└─────────┴────────┘`,
  ].join("\n");

  p.note(summaryTable, "Results");

  if (dryRun) {
    p.outro(pc.yellow("Run without --dry-run to apply changes"));
  } else {
    p.outro(pc.green("Cleanup complete!"));
  }
}

// Interactive main command
async function main(): Promise<void> {
  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 🛸 oh-my-ag ")));

  const projectType = await p.select({
    message: "What type of project?",
    options: [
      { value: "all", label: "✨ All", hint: "Install everything" },
      { value: "fullstack", label: "🌐 Fullstack", hint: "Frontend + Backend + PM + QA" },
      { value: "frontend", label: "🎨 Frontend", hint: "React/Next.js" },
      { value: "backend", label: "⚙️ Backend", hint: "FastAPI/Python" },
      { value: "mobile", label: "📱 Mobile", hint: "Flutter/Dart" },
      { value: "custom", label: "🔧 Custom", hint: "Choose skills" },
    ],
  });

  if (p.isCancel(projectType)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  let selectedSkills: string[];

  if (projectType === "custom") {
    const allSkills = [...SKILLS.domain, ...SKILLS.coordination, ...SKILLS.utility];
    const selected = await p.multiselect({
      message: "Select skills:",
      options: allSkills.map((s) => ({
        value: s.name,
        label: s.name,
        hint: s.desc,
      })),
      required: true,
    });

    if (p.isCancel(selected)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
    selectedSkills = selected as string[];
  } else {
    selectedSkills = PRESETS[projectType as string] ?? [];
  }

  const cwd = process.cwd();
  const spinner = p.spinner();
  spinner.start("Installing skills...");

  try {
    await installShared(cwd);

    for (const skillName of selectedSkills) {
      spinner.message(`Installing ${pc.cyan(skillName)}...`);
      await installSkill(skillName, cwd);
    }

    spinner.stop("Skills installed!");

    p.note(
      [
        ...selectedSkills.map((s) => `${pc.green("✓")} ${s}`),
        "",
        pc.dim(`Location: ${join(cwd, ".agent", "skills")}`),
      ].join("\n"),
      "Installed"
    );

    p.outro(pc.green("Done! Open your project in your IDE to use the skills."));

    p.note(
      `${pc.yellow("❤️")} Enjoying oh-my-ag? Give it a star!\n${pc.dim("gh api --method PUT /user/starred/first-fluke/oh-my-ag")}`,
      "Support"
    );
  } catch (error) {
    spinner.stop("Installation failed");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Commander.js setup
const program = new Command();

program
  .name("oh-my-ag")
  .description("Multi-Agent Skills for Antigravity IDE")
  .version(VERSION)
  .action(() => {
    main().catch(console.error);
  });

program
  .command("dashboard")
  .description("Start terminal dashboard (real-time agent monitoring)")
  .action(() => {
    startTerminalDashboard();
  });

program
  .command("dashboard:web")
  .description("Start web dashboard on http://localhost:9847")
  .action(() => {
    startDashboard();
  });

program
  .command("update")
  .description("Update skills to latest version from registry")
  .action(() => {
    update().catch(console.error);
  });

program
  .command("doctor")
  .description("Check CLI installations, MCP configs, and skill status")
  .option("--json", "Output as JSON for CI/CD")
  .action((options) => {
    doctor(options.json).catch(console.error);
  });

program
  .command("stats")
  .description("View productivity metrics")
  .option("--json", "Output as JSON")
  .option("--reset", "Reset metrics data")
  .action((options) => {
    stats(options.json, options.reset).catch(console.error);
  });

program
  .command("retro")
  .description("Session retrospective (learnings & next steps)")
  .option("--json", "Output as JSON")
  .action((options) => {
    retro(options.json).catch(console.error);
  });

program
  .command("cleanup")
  .description("Clean up orphaned subagent processes and temp files")
  .option("--dry-run", "Show what would be cleaned without making changes")
  .option("--json", "Output as JSON")
  .action((options) => {
    cleanup(options.dryRun, options.json).catch(console.error);
  });

program.parse();
