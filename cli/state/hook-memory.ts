import { withMemoryAdapter } from "../../.agents/hooks/core/memory-adapter.js";
import { loadProviders } from "../utils/providers.js";
import { type OmaEvent, rememberContentForEvent } from "./events.js";
import { createMemoryProvider } from "./semantic-memory.js";

/** Async-local injection isolates concurrent hook invocations without changing process.env. */
export function withSelectedHookMemory<T>(projectDir: string, run: () => T): T {
  if (loadProviders(projectDir).semantic_memory === "agentmemory") return run();
  const provider = createMemoryProvider({ projectDir });
  return withMemoryAdapter(
    {
      recall: (query, limit) =>
        provider.recall?.({ query, limit }) ?? Promise.resolve([]),
      async observe(payload) {
        if (provider.name === "honcho" && provider.remember) {
          try {
            const event = JSON.parse(payload.content) as OmaEvent;
            if (
              [
                "decision.made",
                "blocker.raised",
                "skill.pattern.consolidated",
              ].includes(event.kind)
            ) {
              const memo = rememberContentForEvent(event);
              if (memo)
                await provider.remember({
                  ...memo,
                  sessionId: payload.sessionId,
                });
            }
          } catch {
            /* Durable recall is best-effort; raw events never leave L1. */
          }
        }
        return true;
      },
    },
    run,
  );
}
