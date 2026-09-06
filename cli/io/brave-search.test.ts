import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SearchProviderRegistry } from "../platform/search-providers.js";
import type { SearchProviderContext } from "../types/search-provider.js";
import { createBraveSearchProvider } from "./brave-search.js";

let root: string;
let context: SearchProviderContext;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oma-brave-"));
  mkdirSync(join(root, ".agents"));
  writeFileSync(join(root, ".agents", "oma-config.yaml"), "language: en\n");
  context = {
    projectDir: root,
    signal: new AbortController().signal,
    resolveCredential: vi.fn(async () => "synthetic-token"),
  };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it("authenticates only to Brave and preserves URLs, excerpts and vendor fields", async () => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({
      web: {
        results: [
          {
            url: "https://example.com",
            title: "Example",
            description: "Excerpt",
            extra_snippets: ["Extra"],
          },
          { url: "javascript:alert(1)", title: "Invalid" },
        ],
      },
    }),
  );
  const registry = new SearchProviderRegistry([
    createBraveSearchProvider(fetcher),
  ]);
  const result = await registry.execute(
    "brave",
    { capability: "web", query: "C++ & Rust", limit: 3 },
    context,
  );
  const [url, init] = fetcher.mock.calls[0] ?? [];
  expect(String(url)).toBe(
    "https://api.search.brave.com/res/v1/web/search?q=C%2B%2B+%26+Rust&count=3&result_filter=web",
  );
  expect(init).toMatchObject({
    headers: { "X-Subscription-Token": "synthetic-token" },
    signal: context.signal,
    redirect: "error",
  });
  expect(context.resolveCredential).toHaveBeenCalledWith({
    env: "BRAVE_SEARCH_API_KEY",
    vault: "brave-search",
  });
  expect(result.sources).toEqual([
    { url: "https://example.com", title: "Example", excerpt: "Excerpt" },
  ]);
  expect(result.extensions).toMatchObject({
    brave: { results: [{ extra_snippets: ["Extra"] }] },
  });
  expect(JSON.stringify(result)).not.toContain("synthetic-token");
});

it("supports configurable credential references and checks status without a search request", async () => {
  writeFileSync(
    join(root, ".agents", "oma-config.yaml"),
    "brave: {api_key_env: CUSTOM_BRAVE, api_key_vault: custom-brave}\n",
  );
  const fetcher = vi.fn<typeof fetch>();
  const registry = new SearchProviderRegistry([
    createBraveSearchProvider(fetcher),
  ]);
  expect(await registry.status("brave", "web", context)).toEqual({
    available: true,
    reachability: "not-probed",
  });
  expect(context.resolveCredential).toHaveBeenCalledWith({
    env: "CUSTOM_BRAVE",
    vault: "custom-brave",
  });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([undefined, "\ninvalid", " "])(
  "does not request without a usable credential (%s)",
  async (key) => {
    context.resolveCredential = async () => key;
    const fetcher = vi.fn<typeof fetch>();
    const registry = new SearchProviderRegistry([
      createBraveSearchProvider(fetcher),
    ]);
    expect((await registry.status("brave", "web", context)).available).toBe(
      false,
    );
    await expect(
      registry.execute("brave", { capability: "web", query: "test" }, context),
    ).rejects.toThrow("credential unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it("redacts keychain errors", async () => {
  context.resolveCredential = async () => {
    throw new Error("synthetic-private-value");
  };
  const registry = new SearchProviderRegistry([
    createBraveSearchProvider(vi.fn<typeof fetch>()),
  ]);
  expect(
    JSON.stringify(await registry.status("brave", "web", context)),
  ).not.toContain("synthetic-private-value");
});

it.each([401, 403, 429, 500])(
  "reports HTTP %s without exposing the response body",
  async (status) => {
    const registry = new SearchProviderRegistry([
      createBraveSearchProvider(
        async () => new Response("synthetic-private-value", { status }),
      ),
    ]);
    await expect(
      registry.execute("brave", { capability: "web", query: "test" }, context),
    ).rejects.toThrow(`Brave search failed (HTTP ${status}).`);
  },
);

it.each(["", "x".repeat(401), "word ".repeat(51)])(
  "rejects invalid queries before resolving credentials",
  async (query) => {
    const registry = new SearchProviderRegistry([
      createBraveSearchProvider(vi.fn<typeof fetch>()),
    ]);
    await expect(
      registry.execute("brave", { capability: "web", query }, context),
    ).rejects.toThrow("Brave queries require");
    expect(context.resolveCredential).not.toHaveBeenCalled();
  },
);

it.each([0, 21, 1.5, NaN])("rejects invalid result limit %s", async (limit) => {
  const registry = new SearchProviderRegistry([
    createBraveSearchProvider(vi.fn<typeof fetch>()),
  ]);
  await expect(
    registry.execute(
      "brave",
      { capability: "web", query: "test", limit },
      context,
    ),
  ).rejects.toThrow("result limit");
});

it("handles empty results and rejects malformed result shapes", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ web: { results: [] } }))
    .mockResolvedValueOnce(Response.json({ web: { results: "invalid" } }));
  const registry = new SearchProviderRegistry([
    createBraveSearchProvider(fetcher),
  ]);
  expect(
    (
      await registry.execute(
        "brave",
        { capability: "web", query: "test" },
        context,
      )
    ).sources,
  ).toEqual([]);
  await expect(
    registry.execute("brave", { capability: "web", query: "test" }, context),
  ).rejects.toThrow("invalid search response");
});

it("cancels stalled credential resolution before sending a request", async () => {
  context.resolveCredential = () => new Promise(() => {});
  const controller = new AbortController();
  context.signal = controller.signal;
  const fetcher = vi.fn<typeof fetch>();
  const registry = new SearchProviderRegistry([
    createBraveSearchProvider(fetcher),
  ]);
  const result = registry.execute(
    "brave",
    { capability: "web", query: "test" },
    context,
  );
  controller.abort(new Error("deadline"));
  await expect(result).rejects.toThrow("deadline");
  expect(fetcher).not.toHaveBeenCalled();
});
