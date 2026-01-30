#!/usr/bin/env node
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import pMap from "p-map";
import { startDashboard } from "./dashboard";
import { startTerminalDashboard } from "./terminal-dashboard";

const args = process.argv.slice(2);
if (args[0] === "dashboard") {
  startTerminalDashboard();
} else if (args[0] === "dashboard:web") {
  startDashboard();
} else if (args[0] === "update") {
  update().catch(console.error);
} else if (args[0] === "doctor") {
  doctor().catch(console.error);
} else if (args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
  showHelp();
} else {
  main().catch(console.error);
}

const REPO = "first-fluke/oh-my-antigravity";
const GITHUB_RAW = `https://raw.githubusercontent.com/${REPO}/main/.agent/skills`;

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

async function update(): Promise<void> {
  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 🛸 oh-my-antigravity update ")));

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

interface CLICheck {
  name: string;
  installed: boolean;
  version?: string;
  installCmd: string;
}

interface DashboardCheck {
  name: string;
  available: boolean;
  type: "terminal" | "web";
  installCmd?: string;
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

async function checkDashboardDependencies(): Promise<DashboardCheck[]> {
  const checks: DashboardCheck[] = [];

  try {
    execSync("which fswatch", { stdio: "ignore" });
    checks.push({ name: "fswatch", available: true, type: "terminal" });
  } catch {
    checks.push({
      name: "fswatch",
      available: false,
      type: "terminal",
      installCmd: "brew install fswatch (macOS) or apt install inotify-tools (Linux)",
    });
  }

  const webDashboardPath = join(process.cwd(), "scripts", "dashboard-web", "server.js");
  if (existsSync(webDashboardPath)) {
    try {
      const nodeModulesPath = join(process.cwd(), "node_modules");
      const hasChokidar = existsSync(join(nodeModulesPath, "chokidar"));
      const hasWs = existsSync(join(nodeModulesPath, "ws"));

      if (hasChokidar && hasWs) {
        checks.push({ name: "chokidar + ws", available: true, type: "web" });
      } else {
        checks.push({
          name: "chokidar + ws",
          available: false,
          type: "web",
          installCmd: "npm install",
        });
      }
    } catch {
      checks.push({
        name: "chokidar + ws",
        available: false,
        type: "web",
        installCmd: "npm install",
      });
    }
  }

  return checks;
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

async function doctor(): Promise<void> {
  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 🩺 oh-my-antigravity doctor ")));

  const cwd = process.cwd();
  const spinner = p.spinner();

  try {
    spinner.start("Checking CLI installations...");

    const clis = await Promise.all([
      checkCLI("gemini", "gemini", "npm install -g @anthropic-ai/gemini-cli"),
      checkCLI("claude", "claude", "npm install -g @anthropic-ai/claude-code"),
      checkCLI("codex", "codex", "npm install -g @openai/codex"),
      checkCLI("qwen", "qwen", "pip install qwen-cli"),
    ]);

    spinner.stop("CLI check complete");

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

    const missingCLIs = clis.filter((c) => !c.installed);
    if (missingCLIs.length > 0) {
      p.note(
        missingCLIs.map((cli) => `${pc.yellow("→")} ${cli.name}: ${pc.dim(cli.installCmd)}`).join("\n"),
        "Install missing CLIs"
      );
    }

    spinner.start("Checking MCP configurations...");

    const mcpChecks = await Promise.all(
      clis.filter((c) => c.installed).map(async (cli) => {
        const mcp = await checkMCPConfig(cli.name);
        return { ...cli, mcp };
      })
    );

    spinner.stop("MCP check complete");

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

    spinner.start("Checking dashboard dependencies...");
    const dashboardChecks = await checkDashboardDependencies();
    spinner.stop("Dashboard check complete");

    const dashboardTable = [
      pc.bold("📊 Dashboard Dependencies"),
      "┌─────────────────┬──────────┬────────────────────────────────────┐",
      `│ ${pc.bold("Dependency")}      │ ${pc.bold("Status")}     │ ${pc.bold("Install Command")}                    │`,
      "├─────────────────┼──────────┼────────────────────────────────────┤",
      ...dashboardChecks.map((check) => {
        const status = check.available ? pc.green("✅ Available") : pc.red("❌ Missing");
        const installCmd = check.installCmd || "-";
        return `│ ${check.name.padEnd(15)} │ ${status.padEnd(8)} │ ${installCmd.padEnd(34)} │`;
      }),
      "└─────────────────┴──────────┴────────────────────────────────────┘",
    ].join("\n");

    p.note(dashboardTable, "Dashboard Status");

    spinner.start("Checking skills installation...");
    const skillChecks = await checkSkills();
    spinner.stop("Skills check complete");

    if (skillChecks.length > 0) {
      const installedCount = skillChecks.filter((s) => s.installed).length;
      const completeCount = skillChecks.filter((s) => s.hasSkillMd).length;

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
      p.note(pc.yellow("No skills installed. Run `oh-my-antigravity` to install."), "Skills Status");
    }

    // Serena Memory Check
    const serenaDir = join(cwd, ".serena", "memories");
    const hasSerena = existsSync(serenaDir);

    if (hasSerena) {
      try {
        const files = readdirSync(serenaDir);
        p.note(
          `${pc.green("✅")} Serena memory directory exists\n${pc.dim(`${files.length} memory files found`)}`,
          "Serena Memory"
        );
      } catch {
        p.note(pc.yellow("⚠️  Serena directory exists but cannot read files"), "Serena Memory");
      }
    } else {
      p.note(
        `${pc.yellow("⚠️")} Serena memory directory not found\n${pc.dim("Dashboard will show 'No agents detected'")}`,
        "Serena Memory"
      );
    }

    const totalIssues =
      missingCLIs.length +
      mcpChecks.filter((c) => !c.mcp.configured).length +
      dashboardChecks.filter((d) => !d.available).length +
      (skillChecks.length === 0 ? 1 : 0);

    if (totalIssues === 0) {
      p.outro(pc.green("✅ All checks passed! Ready to use."));
    } else {
      p.outro(pc.yellow(`⚠️  Found ${totalIssues} issue(s). See details above.`));
    }
  } catch (error) {
    spinner.stop("Check failed");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`
${pc.bold("🛸 oh-my-antigravity")} - Multi-Agent Skills for Antigravity IDE

${pc.bold("USAGE:")}
  bunx oh-my-antigravity [command]

${pc.bold("COMMANDS:")}
  ${pc.cyan("<no command>")}    Interactive CLI - install skills with prompts
  ${pc.cyan("dashboard")}      Start terminal dashboard (real-time agent monitoring)
  ${pc.cyan("dashboard:web")}  Start web dashboard on http://localhost:9847
  ${pc.cyan("update")}         Update skills to latest version from registry
  ${pc.cyan("doctor")}         Check CLI installations, MCP configs, and skill status
  ${pc.cyan("help")}           Show this help message

${pc.bold("PRESETS:")}
  ✨ all       - Install all available skills
  🌐 fullstack - Frontend + Backend + PM + QA + Debug + Commit
  🎨 frontend  - Frontend + PM + QA + Debug + Commit
  ⚙️ backend   - Backend + PM + QA + Debug + Commit
  📱 mobile    - Mobile + PM + QA + Debug + Commit

${pc.bold("EXAMPLES:")}
  bunx oh-my-antigravity                    # Interactive mode
  bunx oh-my-antigravity dashboard          # Terminal dashboard
  bunx oh-my-antigravity dashboard:web      # Web dashboard
  bunx oh-my-antigravity update             # Update skills
  bunx oh-my-antigravity doctor             # Check setup

${pc.dim("For more info: https://github.com/first-fluke/oh-my-antigravity")}
`);
}

async function main() {
  console.clear();
  p.intro(pc.bgMagenta(pc.white(" 🛸 oh-my-antigravity ")));

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
  } catch (error) {
    spinner.stop("Installation failed");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
