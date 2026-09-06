import { z } from "zod";
import type {
  SearchProviderContext,
  SearchProviderDefinition,
} from "../types/search-provider.js";
import { loadBraveConfig } from "../utils/providers.js";

const ResponseSchema = z.object({
  web: z
    .object({
      results: z.array(
        z
          .object({
            url: z.string(),
            title: z.string().optional(),
            description: z.string().optional(),
          })
          .passthrough(),
      ),
    })
    .optional(),
});

async function credential(
  context: SearchProviderContext,
): Promise<string | undefined> {
  const config = loadBraveConfig(context.projectDir);
  try {
    const key = await context.resolveCredential({
      env: config.api_key_env ?? "BRAVE_SEARCH_API_KEY",
      vault: config.api_key_vault ?? "brave-search",
    });
    if (key && !/[\r\n\0]/.test(key)) return key.trim() || undefined;
    return undefined;
  } catch {
    // Keychain diagnostics may contain sensitive data; report only availability.
    return undefined;
  }
}

export function createBraveSearchProvider(
  fetcher: typeof fetch = (...args) => fetch(...args),
): SearchProviderDefinition {
  return {
    id: "brave",
    label: "Brave Search",
    capabilities: ["web"],
    transport: "api",
    authentication: { mode: "required", env: "BRAVE_SEARCH_API_KEY" },
    adapter: {
      async status(context) {
        const available = Boolean(await credential(context));
        return {
          available,
          reachability: "not-probed",
          ...(!available
            ? {
                reason:
                  "Set BRAVE_SEARCH_API_KEY or run `oma vault store brave-search` (or configure brave.api_key_env/api_key_vault).",
              }
            : {}),
        };
      },
      async execute(request, context) {
        if (request.capability !== "web")
          throw new Error("Brave supports web search only.");
        const query = request.query.trim();
        const limit = request.limit ?? 10;
        if (!query || query.length > 400 || query.split(/\s+/).length > 50)
          throw new Error(
            "Brave queries require 1–400 characters and at most 50 words.",
          );
        if (!Number.isInteger(limit) || limit < 1 || limit > 20)
          throw new Error(
            "Brave result limit must be an integer from 1 to 20.",
          );
        const key = await credential(context);
        context.signal.throwIfAborted();
        if (!key)
          throw new Error(
            "Brave credential unavailable. Set BRAVE_SEARCH_API_KEY or run `oma vault store brave-search`.",
          );
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        url.searchParams.set("q", query);
        url.searchParams.set("count", String(limit));
        url.searchParams.set("result_filter", "web");
        let response: Response;
        try {
          response = await fetcher(url, {
            headers: {
              Accept: "application/json",
              "X-Subscription-Token": key,
            },
            signal: context.signal,
            redirect: "error",
          });
        } catch {
          context.signal.throwIfAborted();
          throw new Error("Brave search request failed.");
        }
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          // Never echo upstream errors, which can include tokens or query text.
          throw new Error(`Brave search failed (HTTP ${response.status}).`);
        }
        let raw: unknown;
        try {
          raw = await response.json();
        } catch {
          throw new Error("Brave returned invalid JSON.");
        }
        const parsed = ResponseSchema.safeParse(raw);
        if (!parsed.success)
          throw new Error("Brave returned an invalid search response.");
        const results = (parsed.data.web?.results ?? [])
          .filter((result) => {
            try {
              return ["https:", "http:"].includes(new URL(result.url).protocol);
            } catch {
              return false;
            }
          })
          .slice(0, limit);
        return {
          provider: "brave",
          capability: "web",
          sources: results.map(({ url, title, description }) => ({
            url,
            title,
            excerpt: description,
          })),
          extensions: { brave: { results } },
        };
      },
    },
  };
}
