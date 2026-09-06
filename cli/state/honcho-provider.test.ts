import { afterEach, describe, expect, it, vi } from "vitest";
import { createHonchoMemoryProvider } from "./honcho-provider.js";

afterEach(() => vi.unstubAllGlobals());
function call(fetch: ReturnType<typeof vi.fn>, index = 0) {
  const result = fetch.mock.calls[index];
  if (!result) throw new Error(`Missing fetch call ${index}`);
  return result;
}
const make = (extra = {}) =>
  createHonchoMemoryProvider({
    projectDir: "/tmp/project-one",
    config: {
      workspace_id: "test-workspace",
      project_id: "project-one",
      recall_mode: "messages",
      ...extra,
    },
    env: { HONCHO_API_KEY: "test-key" },
  });

describe("Honcho v3 durable-fact adapter", () => {
  it("does not contact any server without hosted credentials or workspace", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const provider = createHonchoMemoryProvider({ config: {}, env: {} });
    expect((await provider.status()).reachable).toBe(false);
    expect(await provider.remember?.({ sessionId: "s", content: "fact" })).toBe(
      false,
    );
    expect(await provider.recall?.({ query: "fact" })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never mirrors raw events", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const provider = make();
    expect(provider.observeEvents).toBe(false);
    expect(
      await provider.observe({
        sessionId: "s",
        content: "private transcript",
        source: "hook",
      }),
    ).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the documented session/message contract with source provenance", async () => {
    const fetch = vi.fn().mockImplementation(async () => Response.json({}));
    vi.stubGlobal("fetch", fetch);
    expect(
      await make().remember?.({
        sessionId: "original-run",
        content: "Use PostgreSQL",
        importance: 8,
      }),
    ).toBe(true);
    const calls = fetch.mock.calls;
    expect(calls).toHaveLength(3);
    expect(call(fetch, 0)[0]).toBe("https://api.honcho.dev/v3/workspaces");
    const session = JSON.parse(call(fetch, 1)[1].body).id;
    expect(session).toMatch(/^oma-[a-f0-9]{32}$/);
    expect(call(fetch, 2)[0]).toContain(`/sessions/${session}/messages`);
    expect(JSON.parse(call(fetch, 2)[1].body)).toEqual({
      messages: [
        {
          peer_id: "oma",
          content: "Use PostgreSQL",
          metadata: {
            source: "oma-durable-fact",
            source_session: "original-run",
            importance: 8,
          },
        },
      ],
    });
    expect(call(fetch, 2)[1].headers.Authorization).toBe("Bearer test-key");
    expect(call(fetch, 2)[1].redirect).toBe("error");
    expect(call(fetch, 0)[1].signal).toBe(call(fetch, 2)[1].signal);
  });
  it("isolates projects even inside a shared workspace", async () => {
    const fetch = vi.fn().mockImplementation(async () => Response.json([]));
    vi.stubGlobal("fetch", fetch);
    await make().recall?.({ query: "decision" });
    await make({ project_id: "project-two" }).recall?.({ query: "decision" });
    expect(call(fetch, 0)[0]).not.toBe(call(fetch, 1)[0]);
  });
  it("rejects foreign or unsourced results and enforces count and UTF-8 budget", async () => {
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      const session = url.split("/sessions/")[1]?.split("/")[0];
      const valid = {
        id: "m1",
        peer_id: "oma",
        workspace_id: "test-workspace",
        session_id: session,
        content: "Bounded fact",
        metadata: { source: "oma-durable-fact" },
      };
      return Response.json([
        { ...valid, workspace_id: "foreign" },
        { ...valid, session_id: "foreign" },
        { ...valid, metadata: {} },
        { ...valid, content: "한".repeat(100) },
        valid,
        { ...valid, id: "m2" },
        { ...valid, id: "m3" },
      ]);
    });
    vi.stubGlobal("fetch", fetch);
    const results = await make({ max_results: 2, max_tokens: 128 }).recall?.({
      query: "decision",
      limit: 999,
    });
    expect(results).toHaveLength(2);
    expect(results?.[0]?.provenance?.message).toBe("m1");
    expect(JSON.parse(call(fetch, 0)[1].body).limit).toBe(2);
  });
  it("checks workspace access without creating or storing anything", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => Response.json({ items: [] }));
    vi.stubGlobal("fetch", fetch);
    expect((await make().status()).reachable).toBe(true);
    expect(call(fetch, 0)[0]).toBe(
      "https://api.honcho.dev/v3/workspaces/test-workspace/sessions/list?size=1",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401, 500])(
    "falls back to local-only on HTTP %s without leaking credentials",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockImplementation(
            async () => new Response("secret server detail", { status }),
          ),
      );
      expect(await make().recall?.({ query: "decision" })).toEqual([]);
      expect(await make().remember?.({ sessionId: "s", content: "fact" })).toBe(
        false,
      );
      const health = await make().status();
      expect(health.reachable).toBe(false);
      expect(JSON.stringify(health)).not.toContain("test-key");
    },
  );
  it("aborts a hung request within the configured deadline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason));
          }),
      ),
    );
    expect(
      await make({ timeout_ms: 100 }).recall?.({ query: "decision" }),
    ).toEqual([]);
  });
  it.each([
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com?token=secret",
  ])("rejects unsafe endpoint %s without I/O", async (base_url) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const status = await make({ base_url }).status();
    expect(status.reachable).toBe(false);
    expect(status.endpoint).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
