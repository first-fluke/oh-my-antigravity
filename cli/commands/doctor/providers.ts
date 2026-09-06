import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createMemoryProvider } from "../../state/semantic-memory.js";
import type { MemoryProviderStatus } from "../../types/memory.js";
import { loadProviders } from "../../utils/providers.js";
import { isRecord } from "../../utils/type-guards.js";
import { checkCLI } from "./environment-checks.js";

export interface ProviderDoctorCheck {
  docs: {
    provider: "context7";
    configured: boolean;
    authentication: "api-key" | "anonymous-or-client-managed";
    reachability: "not-probed";
    fallback: string;
  };
  codeIntelligence: {
    provider: "serena" | "gortex";
    experimental: boolean;
    binaryAvailable?: boolean;
    fallback: string;
  };
  semanticMemory: MemoryProviderStatus;
  issues: string[];
}

export async function collectProviderCheck(
  root: string,
  legacy: MemoryProviderStatus,
): Promise<ProviderDoctorCheck> {
  const providers = loadProviders(root);
  const issues: string[] = [];
  let context7: unknown;
  const path = join(root, ".agents", "mcp.json");
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      context7 = parsed?.mcpServers?.context7;
    } catch {
      issues.push("Cannot read Context7 MCP configuration");
    }
  }
  const semanticMemory =
    providers.semantic_memory === "agentmemory"
      ? legacy
      : await createMemoryProvider({ projectDir: root }).status();
  if (providers.semantic_memory === "honcho" && !semanticMemory.reachable) {
    issues.push(semanticMemory.reason ?? "Honcho unavailable");
  }
  const binary =
    providers.code_intelligence === "gortex"
      ? await checkCLI(
          "gortex",
          "gortex",
          "Install Gortex separately; then explicitly track the intended repositories",
        )
      : undefined;
  if (binary && !binary.installed)
    issues.push(
      "Selected Gortex binary is unavailable; native search fallback applies",
    );
  const headers =
    isRecord(context7) && isRecord(context7.headers) ? context7.headers : {};
  const env = isRecord(context7) && isRecord(context7.env) ? context7.env : {};
  return {
    docs: {
      provider: "context7",
      configured: isRecord(context7),
      authentication:
        headers.CONTEXT7_API_KEY ||
        headers.Authorization ||
        env.CONTEXT7_API_KEY
          ? "api-key"
          : "anonymous-or-client-managed",
      reachability: "not-probed",
      fallback: "official documentation via web search",
    },
    codeIntelligence: {
      provider: providers.code_intelligence,
      experimental: providers.code_intelligence === "gortex",
      ...(binary ? { binaryAvailable: binary.installed } : {}),
      fallback: "native search/read; no automatic provider switch",
    },
    semanticMemory,
    issues,
  };
}
