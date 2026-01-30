import { watch } from "chokidar";
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import pc from "picocolors";

const SYM_RUNNING = "●";
const SYM_COMPLETED = "✓";
const SYM_FAILED = "✗";
const SYM_BLOCKED = "○";
const SYM_PENDING = "◌";

function resolveMemoriesDir(): string {
  if (process.env.MEMORIES_DIR) return process.env.MEMORIES_DIR;
  const cliArg = process.argv[3];
  if (cliArg) return join(cliArg, ".serena", "memories");
  return join(process.cwd(), ".serena", "memories");
}

function readFileSafe(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function findSessionFile(memoriesDir: string): string | null {
  try {
    const files = readdirSync(memoriesDir);
    if (files.includes("orchestrator-session.md")) {
      return join(memoriesDir, "orchestrator-session.md");
    }
    const sessionFiles = files
      .filter((f) => /^session-.*\.md$/.test(f))
      .map((f) => ({ name: f, mtime: statSync(join(memoriesDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (sessionFiles.length > 0 && sessionFiles[0]) {
      return join(memoriesDir, sessionFiles[0].name);
    }
  } catch {}
  return null;
}

function parseSessionInfo(memoriesDir: string): { id: string; status: string } {
  const sessionFile = findSessionFile(memoriesDir);
  if (!sessionFile) return { id: "N/A", status: "UNKNOWN" };

  const content = readFileSafe(sessionFile);
  if (!content) return { id: "N/A", status: "UNKNOWN" };

  let id =
    (content.match(/session-id:\s*(.+)/i) || [])[1] ||
    (content.match(/# Session:\s*(.+)/i) || [])[1] ||
    content.match(/(session-\d{8}-\d{6})/)?.[1] ||
    basename(sessionFile, ".md");

  let status = "UNKNOWN";
  if (/IN PROGRESS|RUNNING|## Active|\[IN PROGRESS\]/i.test(content)) {
    status = "RUNNING";
  } else if (/COMPLETED|DONE|## Completed|\[COMPLETED\]/i.test(content)) {
    status = "COMPLETED";
  } else if (/FAILED|ERROR|## Failed|\[FAILED\]/i.test(content)) {
    status = "FAILED";
  } else if (/Step \d+:.*\[/i.test(content)) {
    status = "RUNNING";
  }

  return { id: (id || "N/A").trim(), status };
}

function parseTaskBoard(memoriesDir: string): { agent: string; status: string; task: string }[] {
  const content = readFileSafe(join(memoriesDir, "task-board.md"));
  if (!content) return [];

  const agents: { agent: string; status: string; task: string }[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.startsWith("|") || /^\|\s*-+/.test(line)) continue;
    const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
    const agentName = cols[0];
    if (cols.length < 2 || !agentName || /^agent$/i.test(agentName)) continue;
    const status = cols[1];
    const task = cols[2];
    agents.push({ agent: agentName, status: status || "pending", task: task || "" });
  }
  return agents;
}

function getAgentTurn(memoriesDir: string, agent: string): number | null {
  try {
    const files = readdirSync(memoriesDir)
      .filter((f) => f.startsWith(`progress-${agent}`) && f.endsWith(".md"))
      .sort().reverse();
    if (files.length === 0 || !files[0]) return null;
    const content = readFileSafe(join(memoriesDir, files[0]));
    const match = content.match(/turn[:\s]*(\d+)/i);
    return match && match[1] ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

function getLatestActivity(memoriesDir: string): { agent: string; message: string }[] {
  try {
    const files = readdirSync(memoriesDir)
      .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
      .map((f) => ({ name: f, mtime: statSync(join(memoriesDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5);

    const activities: { agent: string; message: string }[] = [];
    for (const f of files) {
      const name = f.name
        .replace(/^(progress|result|session|debug|task)-?/, "")
        .replace(/[-_]agent/, "").replace(/[-_]completion/, "")
        .replace(/\.md$/, "").replace(/[-_]/g, " ").trim() || f.name.replace(/\.md$/, "");

      const content = readFileSafe(join(memoriesDir, f.name));
      const lines = content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("---") && l.length > 3);

      let message = "";
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        if (/^\*\*|^#+|^-|^\d+\.|Status|Result|Action|Step/i.test(line)) {
          message = line.replace(/^[#*\-\d.]+\s*/, "").replace(/\*\*/g, "").trim();
          if (message.length > 5) break;
        }
      }
      if (message.length > 52) message = message.substring(0, 49) + "...";
      if (message) activities.push({ agent: name, message });
    }
    return activities;
  } catch {
    return [];
  }
}

function discoverAgentsFromFiles(memoriesDir: string): { agent: string; status: string; task: string; turn: number | null }[] {
  const agents: { agent: string; status: string; task: string; turn: number | null }[] = [];
  const seen = new Set<string>();

  try {
    const files = readdirSync(memoriesDir)
      .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
      .map((f) => ({ name: f, mtime: statSync(join(memoriesDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const f of files) {
      const content = readFileSafe(join(memoriesDir, f.name));
      const agentMatch = content.match(/\*\*Agent\*\*:\s*(.+)/i) ||
                         content.match(/Agent:\s*(.+)/i) ||
                         content.match(/^#+\s*(.+?)\s*Agent/im);

      let agentName: string | null = null;
      if (agentMatch && agentMatch[1]) {
        agentName = agentMatch[1].trim();
      } else if (/_agent|agent_|-agent/i.test(f.name)) {
        agentName = f.name.replace(/\.md$/, "")
          .replace(/[-_]completion|[-_]progress|[-_]result/gi, "")
          .replace(/[-_]/g, " ").trim();
      }

      if (agentName && !seen.has(agentName.toLowerCase())) {
        seen.add(agentName.toLowerCase());
        let status = "unknown";
        if (/\[COMPLETED\]|## Completed|## Results/i.test(content)) status = "completed";
        else if (/\[IN PROGRESS\]|## Progress|IN PROGRESS/i.test(content)) status = "running";
        else if (/\[FAILED\]|## Failed|ERROR/i.test(content)) status = "failed";

        const taskMatch = content.match(/## Task\s*\n+(.+)/i) || content.match(/\*\*Task\*\*:\s*(.+)/i);
        const task = taskMatch && taskMatch[1] ? taskMatch[1].trim().substring(0, 20) : "";
        agents.push({ agent: agentName, status, task, turn: getAgentTurn(memoriesDir, agentName) });
      }
    }
  } catch {}
  return agents;
}

function statusSymbol(status: string): string {
  const lower = status.toLowerCase();
  if (["running", "active", "in_progress", "in-progress"].includes(lower)) {
    return `${pc.green(SYM_RUNNING)} running`;
  } else if (["completed", "done", "finished"].includes(lower)) {
    return `${pc.cyan(SYM_COMPLETED)} completed`;
  } else if (["failed", "error"].includes(lower)) {
    return `${pc.red(SYM_FAILED)} failed`;
  } else if (["blocked", "waiting"].includes(lower)) {
    return `${pc.yellow(SYM_BLOCKED)} blocked`;
  }
  return `${pc.dim(SYM_PENDING)} pending`;
}

function renderDashboard(memoriesDir: string) {
  console.clear();

  const session = parseSessionInfo(memoriesDir);
  const taskBoard = parseTaskBoard(memoriesDir);
  let agents = taskBoard.map((a) => ({ ...a, turn: getAgentTurn(memoriesDir, a.agent) }));

  if (agents.length === 0) agents = discoverAgentsFromFiles(memoriesDir);
  if (agents.length === 0) {
    try {
      const progressFiles = readdirSync(memoriesDir).filter((f) => f.startsWith("progress-") && f.endsWith(".md"));
      for (const f of progressFiles) {
        const agent = f.replace(/^progress-/, "").replace(/\.md$/, "");
        agents.push({ agent, status: "running", task: "", turn: getAgentTurn(memoriesDir, agent) });
      }
    } catch {}
  }

  const W = 56;
  const border = "═".repeat(W);
  const safeRepeat = (n: number) => " ".repeat(Math.max(0, n));

  const purple = (s: string) => pc.magenta(s);
  const bold = (s: string) => pc.bold(s);
  const dim = (s: string) => pc.dim(s);

  let statusColor = pc.yellow;
  if (session.status === "RUNNING") statusColor = pc.green;
  else if (session.status === "COMPLETED") statusColor = pc.cyan;
  else if (session.status === "FAILED") statusColor = pc.red;

  console.log(`${purple("╔" + border + "╗")}`);
  console.log(`${purple("║")}  ${bold(purple("Serena Memory Dashboard"))}${safeRepeat(W - 25)}${purple("║")}`);
  const sessionLine = `Session: ${bold(session.id.padEnd(20))} [${statusColor(session.status)}]`;
  console.log(`${purple("║")}  ${sessionLine}${safeRepeat(W - 4 - sessionLine.length - 9)}${purple("║")}`);
  console.log(`${purple("╠" + border + "╣")}`);

  console.log(`${purple("║")}  ${bold("Agent".padEnd(12) + " " + "Status".padEnd(12) + " " + "Turn".padEnd(6) + " " + "Task".padEnd(20))}  ${purple("║")}`);
  console.log(`${purple("║")}  ${dim("──────────".padEnd(12) + " " + "──────────".padEnd(12) + " " + "────".padEnd(6) + " " + "──────────────────".padEnd(20))}  ${purple("║")}`);

  if (agents.length === 0) {
    console.log(`${purple("║")}  ${dim("No agents detected yet" + safeRepeat(32))}${purple("║")}`);
  } else {
    for (const a of agents) {
      const sym = statusSymbol(a.status);
      const turn = a.turn != null ? String(a.turn) : "-";
      const task = a.task.substring(0, 20);
      console.log(`${purple("║")}  ${a.agent.padEnd(12)} ${sym.padEnd(22)} ${turn.padEnd(6)} ${task.padEnd(20)}${purple("║")}`);
    }
  }

  console.log(`${purple("╠" + border + "╣")}`);
  console.log(`${purple("║")}  ${bold("Latest Activity:")}${safeRepeat(W - 18)}${purple("║")}`);

  const activity = getLatestActivity(memoriesDir);
  if (activity.length === 0) {
    console.log(`${purple("║")}  ${dim("No activity yet" + safeRepeat(38))}${purple("║")}`);
  } else {
    for (const a of activity) {
      const line = `[${a.agent}] ${a.message}`;
      console.log(`${purple("║")}  ${dim(line.substring(0, 52).padEnd(52))}${purple("║")}`);
    }
  }

  console.log(`${purple("╠" + border + "╣")}`);

  const now = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const footerText = `Updated: ${now}  |  Ctrl+C to exit`;
  console.log(`${purple("║")}  ${dim(footerText)}${safeRepeat(W - 4 - footerText.length)}${purple("║")}`);
  console.log(`${purple("╚" + border + "╝")}`);
}

export function startTerminalDashboard() {
  const memoriesDir = resolveMemoriesDir();
  
  if (!existsSync(memoriesDir)) {
    mkdirSync(memoriesDir, { recursive: true });
    console.log(pc.yellow(`Created ${memoriesDir} — waiting for memory files...`));
  }

  console.log(pc.magenta("\n  🛸 Serena Terminal Dashboard"));
  console.log(pc.dim(`     Watching: ${memoriesDir}\n`));

  renderDashboard(memoriesDir);

  const watcher = watch(memoriesDir, { 
    persistent: true, 
    ignoreInitial: true, 
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 } 
  });
  
  watcher.on("all", () => renderDashboard(memoriesDir));

  process.on("SIGINT", () => {
    console.log("\n");
    watcher.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => process.emit("SIGINT"));
}
