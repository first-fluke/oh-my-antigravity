// cli/platform/model-registry/user-models.ts
// Inline user model loader — testable internal.
//
// `.agents/oma-config.yaml`'s `models:` block is the only user-model source.
// `.agents/config/models.yaml` is no longer read: `oma uninstall` removes
// `.agents/config/` wholesale, so slugs kept there were never durable.
// Migration 022 folds any surviving file into oma-config (design 024).

import { loadOmaConfig } from "../../utils/config.js";
import { ModelSpecSchema } from "./schema.js";
import type { ModelSpec } from "./types.js";

/** Read inline models from the effective shared + local project config. */
export function loadInlineUserModels(
  cwd?: string,
): Record<string, unknown> | undefined {
  const models = loadOmaConfig(cwd)?.models;
  return models && typeof models === "object" && !Array.isArray(models)
    ? models
    : undefined;
}

/**
 * Validated counterpart to {@link loadInlineUserModels} — the `models:` block of
 * `.agents/oma-config.yaml` as ModelSpecs, ready to merge into the registry.
 *
 * Entries that fail validation are dropped silently. The same block is also read
 * raw by vendor resolution and `oma model probe`, which need far less than a
 * full ModelSpec — an abbreviated entry there is legitimate, and logging a
 * validation error for it every time the registry loads would be noise.
 */
export function loadInlineUserModelSpecs(cwd?: string): Map<string, ModelSpec> {
  const models = loadInlineUserModels(cwd);
  if (!models) return new Map();

  const result = new Map<string, ModelSpec>();
  for (const [slug, entry] of Object.entries(models)) {
    const parsed = ModelSpecSchema.safeParse(entry);
    if (!parsed.success) continue;

    const spec = parsed.data as ModelSpec;
    // api_only entries cannot run under a CLI at all.
    if (spec.supports.api_only) continue;

    result.set(slug, spec);
  }
  return result;
}
