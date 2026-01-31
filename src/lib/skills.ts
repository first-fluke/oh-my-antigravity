import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SkillInfo, SkillsRegistry } from "../types/index.js";

export const REPO = "first-fluke/oh-my-ag";
export const GITHUB_RAW = `https://raw.githubusercontent.com/${REPO}/main/.agent/skills`;

export const SKILLS: SkillsRegistry = {
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

export const PRESETS: Record<string, string[]> = {
  fullstack: ["frontend-agent", "backend-agent", "pm-agent", "qa-agent", "debug-agent", "commit"],
  frontend: ["frontend-agent", "pm-agent", "qa-agent", "debug-agent", "commit"],
  backend: ["backend-agent", "pm-agent", "qa-agent", "debug-agent", "commit"],
  mobile: ["mobile-agent", "pm-agent", "qa-agent", "debug-agent", "commit"],
  all: [...SKILLS.domain, ...SKILLS.coordination, ...SKILLS.utility].map((s) => s.name),
};

export async function fetchSkillFiles(skillName: string): Promise<string[]> {
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

export async function installSkill(skillName: string, targetDir: string): Promise<boolean> {
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

export async function installShared(targetDir: string): Promise<void> {
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

export function getAllSkills(): SkillInfo[] {
  return [...SKILLS.domain, ...SKILLS.coordination, ...SKILLS.utility];
}
