import { getSecret } from "../io/vault.js";
import type { SearchProviderContext } from "../types/search-provider.js";

export function createSearchContext(
  projectDir: string,
  signal: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): SearchProviderContext {
  return {
    projectDir,
    signal,
    async resolveCredential(reference) {
      signal.throwIfAborted();
      const key = reference.env ? env[reference.env] : undefined;
      if (key?.trim()) return key;
      return reference.vault
        ? ((await getSecret(reference.vault)) ?? undefined)
        : undefined;
    },
  };
}
