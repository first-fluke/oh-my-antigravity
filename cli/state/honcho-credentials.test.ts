import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSecret } = vi.hoisted(() => ({ getSecret: vi.fn() }));
vi.mock("../io/vault.js", () => ({ getSecret }));

import { createHonchoMemoryProvider } from "./honcho-provider.js";

beforeEach(() => {
  getSecret.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({})),
  );
});
afterEach(() => vi.unstubAllGlobals());
const make = (env: NodeJS.ProcessEnv = {}, local = false) =>
  createHonchoMemoryProvider({
    env,
    config: {
      base_url: local ? "http://127.0.0.1:8000" : "https://honcho.example",
      workspace_id: "test",
      api_key_vault: "honcho-test",
      timeout_ms: 100,
    },
  });

describe("Honcho keychain credentials", () => {
  it("reads the vault lazily and reuses it across a multi-request write", async () => {
    getSecret.mockResolvedValue("synthetic-vault-token");
    const provider = make();
    expect(getSecret).not.toHaveBeenCalled();
    expect(
      await provider.remember?.({
        content: "Test decision",
        sessionId: "test",
      }),
    ).toBe(true);
    expect(getSecret).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const [, options] of vi.mocked(fetch).mock.calls) {
      expect(options?.headers).toMatchObject({
        Authorization: "Bearer synthetic-vault-token",
      });
    }
  });
  it("prefers an environment key without opening the keychain", async () => {
    expect(
      await make({ HONCHO_API_KEY: "synthetic-env-token" }).status(),
    ).toMatchObject({ reachable: true });
    expect(getSecret).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer synthetic-env-token",
    });
  });
  it.each([true, false])(
    "fails closed if the configured vault key is missing (local=%s)",
    async (local) => {
      getSecret.mockResolvedValue(null);
      expect(await make({}, local).status()).toMatchObject({
        reachable: false,
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("does not expose keychain errors in provider status", async () => {
    getSecret.mockRejectedValue(new Error("sensitive diagnostic"));
    const status = await make().status();
    expect(status.reachable).toBe(false);
    expect(JSON.stringify(status)).not.toContain("sensitive diagnostic");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds a stalled keychain read by the request deadline", async () => {
    getSecret.mockReturnValue(new Promise(() => {}));
    expect(await make().status()).toMatchObject({ reachable: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});
