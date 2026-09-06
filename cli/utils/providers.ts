import { z } from "zod";
import { loadOmaConfig } from "./config.js";

export const ProvidersSchema = z
  .object({
    docs: z.literal("context7").optional(),
    code_intelligence: z.enum(["serena", "gortex"]).optional(),
    semantic_memory: z.enum(["agentmemory", "honcho", "none"]).optional(),
  })
  .strict();

export const HonchoConfigSchema = z
  .object({
    base_url: z.url().optional(),
    workspace_id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/)
      .optional(),
    project_id: z.string().trim().min(1).max(128).optional(),
    api_key_env: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .optional(),
    api_key_vault: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,64}$/)
      .optional(),
    timeout_ms: z.number().int().min(100).max(30000).optional(),
    max_results: z.number().int().min(1).max(50).optional(),
    max_tokens: z.number().int().min(128).max(16000).optional(),
    recall_mode: z.enum(["hybrid", "messages"]).optional(),
  })
  .strict();

export type ProvidersConfig = z.infer<typeof ProvidersSchema>;
export type HonchoConfig = z.infer<typeof HonchoConfigSchema>;
export type SemanticMemoryProviderName = "agentmemory" | "honcho" | "none";

/** Reject an invalid explicit choice instead of silently enabling another provider. */
export function loadProviders(cwd?: string): Required<ProvidersConfig> {
  const raw = ProvidersSchema.parse(loadOmaConfig(cwd)?.providers ?? {});
  return {
    docs: raw.docs ?? "context7",
    code_intelligence: raw.code_intelligence ?? "serena",
    semantic_memory: raw.semantic_memory ?? "agentmemory",
  };
}

export function loadHonchoConfig(cwd?: string): HonchoConfig {
  return HonchoConfigSchema.parse(loadOmaConfig(cwd)?.honcho ?? {});
}
