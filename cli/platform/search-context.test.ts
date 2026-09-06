import { beforeEach, expect, it, vi } from "vitest";
import { createSearchContext } from "./search-context.js";

const vault = vi.hoisted(() => vi.fn(async () => "vault-value"));
vi.mock("../io/vault.js", () => ({ getSecret: vault }));
beforeEach(() => vi.clearAllMocks());

it("prefers environment credentials without opening the keychain", async () => {
  const context = createSearchContext(
    "/project",
    new AbortController().signal,
    { BRAVE_SEARCH_API_KEY: "env-value" },
  );
  expect(
    await context.resolveCredential({
      env: "BRAVE_SEARCH_API_KEY",
      vault: "brave-search",
    }),
  ).toBe("env-value");
  expect(vault).not.toHaveBeenCalled();
});

it("resolves the selected keychain reference when the environment is empty", async () => {
  const context = createSearchContext(
    "/project",
    new AbortController().signal,
    {},
  );
  expect(
    await context.resolveCredential({
      env: "BRAVE_SEARCH_API_KEY",
      vault: "custom-key",
    }),
  ).toBe("vault-value");
  expect(vault).toHaveBeenCalledWith("custom-key");
});
