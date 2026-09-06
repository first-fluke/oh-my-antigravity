import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installVendorAgents } from "./agent-composer.js";

describe("native agent configuration with auto", () => {
  let source: string;
  let target: string;
  beforeEach(() => {
    source = mkdtempSync(join(tmpdir(), "oma-auto-source-"));
    target = mkdtempSync(join(tmpdir(), "oma-auto-target-"));
    mkdirSync(join(source, ".agents", "agents", "variants"), {
      recursive: true,
    });
    mkdirSync(join(target, ".agents"));
    writeFileSync(
      join(source, ".agents", "oma-config.yaml"),
      "model_preset: antigravity\n",
    );
    writeFileSync(
      join(source, ".agents", "agents", "backend-engineer.md"),
      "---\nname: backend-engineer\ndescription: Backend work\n---\nImplement the assigned backend task.\n",
    );
    writeFileSync(
      join(source, ".agents", "agents", "variants", "codex.json"),
      JSON.stringify({
        vendor: "codex",
        destDir: ".codex/agents",
        modelDefault: "vendor-model",
        effortDefault: "medium",
        toolsDefault: [],
        protocolPath:
          ".agents/skills/_shared/runtime/execution-protocols/codex.md",
        agents: {},
      }),
    );
  });
  afterEach(() => {
    rmSync(source, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });

  function generate(config: string): string {
    writeFileSync(join(target, ".agents", "oma-config.yaml"), config);
    expect(installVendorAgents(source, target, "codex")).toBe(1);
    return readFileSync(
      join(target, ".codex", "agents", "backend-engineer.toml"),
      "utf8",
    );
  }

  it("keeps vendor agent definitions when no model is explicitly overridden", () => {
    const output = generate("model_preset: auto\n");
    expect(output).toContain('model = "vendor-model"');
    expect(output).toContain('model_reasoning_effort = "medium"');
  });

  it("applies the installed project's same-vendor override over native defaults", () => {
    const output = generate(
      "model_preset: auto\nagents:\n  backend:\n    model: openai/gpt-5.5\n    effort: high\n",
    );
    expect(output).toContain('model = "gpt-5.5"');
    expect(output).toContain('model_reasoning_effort = "high"');
  });

  it("keeps cross-vendor model overrides out of incompatible native files", () => {
    const output = generate(
      "model_preset: auto\nagents:\n  backend:\n    model: anthropic/claude-sonnet-4-6\n",
    );
    expect(output).toContain('model = "vendor-model"');
    expect(output).not.toContain("claude-sonnet");
  });
});
