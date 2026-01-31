import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AgentActivity {
  agent: string;
  type: "progress" | "result";
  content: string;
  timestamp?: string;
}

export interface SessionSummary {
  sessionId?: string;
  agents: string[];
  activities: AgentActivity[];
  completedTasks: string[];
  inProgressTasks: string[];
}

export function getMemoriesPath(cwd: string): string {
  return join(cwd, ".serena", "memories");
}

export function listMemoryFiles(cwd: string): string[] {
  const memoriesDir = getMemoriesPath(cwd);
  if (!existsSync(memoriesDir)) return [];

  try {
    return readdirSync(memoriesDir).filter((f) => f.endsWith(".md") && f !== ".gitkeep");
  } catch {
    return [];
  }
}

export function parseAgentActivity(filename: string, content: string): AgentActivity | null {
  const progressMatch = filename.match(/^progress-(\w+)\.md$/);
  const resultMatch = filename.match(/^result-(\w+)\.md$/);

  if (progressMatch) {
    return {
      agent: progressMatch[1],
      type: "progress",
      content: content.slice(0, 500),
    };
  }

  if (resultMatch) {
    return {
      agent: resultMatch[1],
      type: "result",
      content: content.slice(0, 500),
    };
  }

  return null;
}

export function getSessionSummary(cwd: string): SessionSummary {
  const memoriesDir = getMemoriesPath(cwd);
  const summary: SessionSummary = {
    agents: [],
    activities: [],
    completedTasks: [],
    inProgressTasks: [],
  };

  if (!existsSync(memoriesDir)) return summary;

  const files = listMemoryFiles(cwd);

  for (const file of files) {
    if (file === "orchestrator-session.md") {
      try {
        const content = readFileSync(join(memoriesDir, file), "utf-8");
        const sessionMatch = content.match(/session[:\s]+(\S+)/i);
        if (sessionMatch) {
          summary.sessionId = sessionMatch[1];
        }
      } catch {}
      continue;
    }

    try {
      const content = readFileSync(join(memoriesDir, file), "utf-8");
      const activity = parseAgentActivity(file, content);

      if (activity) {
        summary.activities.push(activity);

        if (!summary.agents.includes(activity.agent)) {
          summary.agents.push(activity.agent);
        }

        if (activity.type === "result") {
          const taskMatch = content.match(/task[:\s]+(.+)/i) || content.match(/##\s*(.+)/);
          if (taskMatch) {
            summary.completedTasks.push(taskMatch[1].trim());
          }
        } else if (activity.type === "progress") {
          const taskMatch = content.match(/current[:\s]+(.+)/i) || content.match(/working on[:\s]+(.+)/i);
          if (taskMatch && !summary.completedTasks.includes(taskMatch[1].trim())) {
            summary.inProgressTasks.push(taskMatch[1].trim());
          }
        }
      }
    } catch {}
  }

  return summary;
}

export function getRecentAgentActivities(cwd: string, sinceDate?: string): AgentActivity[] {
  const allActivities: AgentActivity[] = [];
  const memoriesDir = getMemoriesPath(cwd);

  if (!existsSync(memoriesDir)) return allActivities;

  const cutoffTime = sinceDate ? new Date(sinceDate).getTime() : 0;
  const files = listMemoryFiles(cwd);

  for (const file of files) {
    if (file === "orchestrator-session.md") continue;

    try {
      const filePath = join(memoriesDir, file);
      const stats = readFileSync(filePath);
      const content = readFileSync(filePath, "utf-8");

      const activity = parseAgentActivity(file, content);
      if (activity) {
        allActivities.push(activity);
      }
    } catch {}
  }

  return allActivities;
}

export function extractKeyLearningsFromActivities(activities: AgentActivity[]): string[] {
  const learnings: string[] = [];

  for (const activity of activities) {
    const content = activity.content.toLowerCase();

    if (content.includes("error") || content.includes("fail")) {
      learnings.push(`${activity.agent}: Error handling improved`);
    }
    if (content.includes("refactor")) {
      learnings.push(`${activity.agent}: Code structure refactored`);
    }
    if (content.includes("test")) {
      learnings.push(`${activity.agent}: Test coverage added`);
    }
    if (content.includes("performance") || content.includes("optimize")) {
      learnings.push(`${activity.agent}: Performance optimized`);
    }
  }

  return [...new Set(learnings)].slice(0, 5);
}
