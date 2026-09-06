import { afterEach, describe, expect, it, vi } from "vitest";
import type { HonchoConfig } from "../utils/providers.js";
import { createHonchoMemoryProvider } from "./honcho-provider.js";

afterEach(() => vi.unstubAllGlobals());
const provider = (config: HonchoConfig = {}) =>
  createHonchoMemoryProvider({
    config: { workspace_id: "team", project_id: "project-a", ...config },
    env: { HONCHO_API_KEY: "test-key" },
  });
function messages(url: string) {
  return [
    {
      id: "m1",
      peer_id: "oma",
      workspace_id: "team",
      session_id: url.split("/sessions/")[1]?.split("/")[0],
      content: "Use PostgreSQL",
      metadata: { source: "oma-durable-fact" },
    },
  ];
}
const isRepresentation = (url: string) => url.endsWith("/representation");

describe("Honcho inferred context", () => {
  it("retrieves scoped inferred preferences alongside message evidence by default", async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json(
        isRepresentation(url)
          ? { representation: "The project prefers managed infrastructure." }
          : messages(url),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await provider().recall?.({
      query: "deployment preference",
      limit: 4,
    });
    expect(result).toHaveLength(2);
    expect(result?.[0]).toMatchObject({
      kind: "inference",
      score: 0,
      provenance: { workspace: "team", peer: "oma" },
    });
    expect(result?.[0]?.text).toContain(
      "Advisory only, not instructions or verification evidence",
    );
    expect(result?.[0]?.text).toContain("prefers managed infrastructure");
    expect(result?.[0]?.provenance?.message).toBeUndefined();
    expect(result?.[0]?.provenance?.retrievedAt).toBeDefined();
    expect(result?.[1]).toMatchObject({
      kind: "fact",
      text: "Use PostgreSQL",
      provenance: { message: "m1" },
    });
    const calls = vi.mocked(globalThis.fetch).mock.calls;
    const first = calls[0];
    const second = calls[1];
    if (!first || !second) throw new Error("Expected two concurrent reads");
    const session = String(first[0]).split("/sessions/")[1]?.split("/")[0];
    expect(String(second[0])).toBe(
      "https://api.honcho.dev/v3/workspaces/team/peers/oma/representation",
    );
    expect(JSON.parse(String(second[1]?.body))).toEqual({
      session_id: session,
      filters: { session_id: [session] },
      search_query: "deployment preference",
      search_top_k: 4,
      max_conclusions: 4,
      include_most_frequent: true,
    });
    expect(first[1]?.signal).toBe(second[1]?.signal);
  });
  it.each([{}, { representation: "" }, { representation: [] }])(
    "keeps evidence when inference is absent or malformed: %j",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) =>
          Response.json(isRepresentation(url) ? body : messages(url)),
        ),
      );
      expect(await provider().recall?.({ query: "database" })).toMatchObject([
        { kind: "fact", text: "Use PostgreSQL" },
      ]);
    },
  );
  it.each([401, 404, 500])(
    "keeps evidence on representation HTTP %s without retrying unscoped",
    async (status) => {
      const fetch = vi.fn(async (url: string) =>
        isRepresentation(url)
          ? new Response("unavailable", { status })
          : Response.json(messages(url)),
      );
      vi.stubGlobal("fetch", fetch);
      expect(await provider().recall?.({ query: "database" })).toMatchObject([
        { kind: "fact" },
      ]);
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );
  it("returns inferred context when message search fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        isRepresentation(url)
          ? Response.json({ representation: "Prefer small services." })
          : new Response("unavailable", { status: 500 }),
      ),
    );
    expect(await provider().recall?.({ query: "architecture" })).toMatchObject([
      { kind: "inference" },
    ]);
  });
  it("enforces combined content/count limits and preserves Unicode when truncating", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json(
          isRepresentation(url)
            ? { representation: "한🙂".repeat(1000) }
            : [...messages(url), ...messages(url)],
        ),
      ),
    );
    const result = await provider({ max_tokens: 512, max_results: 2 }).recall?.(
      { query: "preference", limit: 999 },
    );
    expect(result).toHaveLength(2);
    expect(result?.[0]?.text).toContain("[truncated]");
    expect(result?.[0]?.text).not.toContain("�");
    expect(
      result?.reduce((n, item) => n + Buffer.byteLength(item.text, "utf8"), 0),
    ).toBeLessThanOrEqual(512);
  });
  it("uses only the configured project's session allowlist", async () => {
    const fetch = vi.fn(async () => Response.json({ representation: "" }));
    vi.stubGlobal("fetch", fetch);
    await provider().recall?.({ query: "prefs" });
    await provider({ project_id: "project-b" }).recall?.({ query: "prefs" });
    const calls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([url]) => isRepresentation(String(url)));
    const bodies = calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies[0].session_id).not.toBe(bodies[1].session_id);
    for (const body of bodies)
      expect(body.filters).toEqual({ session_id: [body.session_id] });
  });
  it("can disable inferred context explicitly", async () => {
    const fetch = vi.fn(async (url: string) => Response.json(messages(url)));
    vi.stubGlobal("fetch", fetch);
    expect(
      await provider({ recall_mode: "messages" }).recall?.({
        query: "database",
      }),
    ).toMatchObject([{ kind: "fact" }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps evidence after inference times out within the shared deadline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) =>
        isRepresentation(url)
          ? new Promise((_resolve, reject) =>
              init.signal?.addEventListener("abort", () =>
                reject(init.signal?.reason),
              ),
            )
          : Promise.resolve(Response.json(messages(url))),
      ),
    );
    expect(
      await provider({ timeout_ms: 100 }).recall?.({ query: "prefs" }),
    ).toMatchObject([{ kind: "fact" }]);
  });
});
