import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { runHookDispatch } from "./dispatch.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

it.each(["serena", "gortex"])(
  "routes prompt hooks for %s without a conflicting primer",
  async (provider) => {
    const root = mkdtempSync(join(tmpdir(), "oma-provider-dispatch-"));
    roots.push(root);
    mkdirSync(join(root, ".agents"));
    mkdirSync(join(root, ".serena"));
    writeFileSync(join(root, ".serena/project.yml"), "project_name: test\n");
    writeFileSync(
      join(root, ".agents/oma-config.yaml"),
      `providers:\n  code_intelligence: ${provider}\n  semantic_memory: none\n`,
    );
    const result = await runHookDispatch({
      vendor: "claude",
      nativeEvent: "UserPromptSubmit",
      rawStdin: JSON.stringify({
        cwd: root,
        prompt: "hello",
        session_id: "provider-test",
      }),
      cwd: root,
      sid: "provider-test",
    });
    expect(result.output.includes("[OMA SERENA PRIMER]")).toBe(
      provider === "serena",
    );
  },
);
