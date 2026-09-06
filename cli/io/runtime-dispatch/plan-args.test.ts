import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EffortLevel, ModelSpec } from "../../platform/model-registry.js";
import { primeAgyCaps, resetAgyCapsCache } from "./agy-caps.js";
import { agyModelForEffort, buildAgentPlanArgs } from "./plan-args.js";
import type { AgentPlan } from "./types.js";

// ---------------------------------------------------------------------------
// plan-args.test.ts — antigravity (agy) model resolution.
//
// Regression context: agy 1.1's `--model` accepts only the display IDs printed
// by `agy models` ("Gemini 3.1 Pro (High)"). Passing the registry slug form
// (`gemini-3.1-pro`) makes agy print `Error: invalid --model` and exit without
// running the prompt, so every spawned antigravity subagent died immediately.
// ---------------------------------------------------------------------------

function agyPlan(
  cliModel: string,
  levels: EffortLevel[],
  effort?: EffortLevel,
): AgentPlan & { cliModel: string } {
  const spec = {
    cli: "antigravity",
    cli_model: cliModel,
    supports: {
      effort: { type: "granular", levels },
      apply_patch: false,
      task_budget: false,
      prompt_cache: true,
      computer_use: false,
      native_dispatch_from: ["antigravity"],
      api_only: false,
    },
    auth_hint: "",
  } as ModelSpec;
  return { cli: "antigravity", cliModel, effort, spec };
}

describe("agyModelForEffort", () => {
  it("keeps the registry default tier when the agent pins no effort", () => {
    expect(
      agyModelForEffort(agyPlan("Gemini 3.1 Pro (High)", ["low", "high"])),
    ).toBe("Gemini 3.1 Pro (High)");
  });

  it("swaps the tier suffix for a published effort level", () => {
    expect(
      agyModelForEffort(
        agyPlan("Gemini 3.1 Pro (High)", ["low", "high"], "low"),
      ),
    ).toBe("Gemini 3.1 Pro (Low)");
  });

  it("collapses xhigh onto the published High tier", () => {
    expect(
      agyModelForEffort(
        agyPlan("Gemini 3.1 Pro (Low)", ["low", "high"], "xhigh"),
      ),
    ).toBe("Gemini 3.1 Pro (High)");
  });

  // agy rejects the whole invocation on an unknown model string rather than
  // degrading, so an unpublished tier must fall back instead of being invented.
  it("falls back to the default when the tier is not published", () => {
    expect(
      agyModelForEffort(
        agyPlan("Gemini 3.1 Pro (High)", ["low", "high"], "medium"),
      ),
    ).toBe("Gemini 3.1 Pro (High)");
  });

  it("leaves a model without a tier suffix untouched", () => {
    expect(
      agyModelForEffort(agyPlan("GPT-OSS 120B", ["low", "high"], "low")),
    ).toBe("GPT-OSS 120B");
  });
});

describe("buildAgentPlanArgs — antigravity", () => {
  beforeEach(() => resetAgyCapsCache());
  afterEach(() => resetAgyCapsCache());

  it("passes the agy display ID, never the slug form", () => {
    primeAgyCaps({ modelFlag: true });
    const args = buildAgentPlanArgs(
      agyPlan("Gemini 3.1 Pro (High)", ["low", "high"]),
    );
    expect(args).toEqual(["--model", "Gemini 3.1 Pro (High)"]);
    expect(args).not.toContain("gemini-3.1-pro");
  });

  it("drops the model flag when agy predates it (agy 1.0)", () => {
    primeAgyCaps({ modelFlag: false });
    expect(
      buildAgentPlanArgs(agyPlan("Gemini 3.1 Pro (High)", ["low", "high"])),
    ).toEqual([]);
  });
});
