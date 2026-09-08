import { type FreeProvider, freeApiKey } from "../../utils/free-provider.js";
import { assertFreeSettings } from "./free-settings.js";
import type { Invocation } from "./types.js";

export interface FreeInvocationRequest {
  invocation: Invocation;
  vendor: string;
  provider: FreeProvider;
  env: NodeJS.ProcessEnv;
  workspace?: string;
}

/** Configure only this child; never write credentials or change the parent env. */
export function applyFreeProvider({
  invocation,
  vendor,
  provider,
  env,
  workspace,
}: FreeInvocationRequest): void {
  const key = freeApiKey(provider, env);
  invocation.env = { ...invocation.env, ...env };
  // Preserve the route across nested OMA spawns and Git-ignored worktree config.
  invocation.env.OMA_MODEL_PRESET = "free";
  invocation.env.OMA_RUNTIME_VENDOR = vendor;
  invocation.env.FREELLM_BASE_URL = provider.baseUrl;
  invocation.env.FREELLM_MODEL = provider.model;
  invocation.env.FREELLM_API_KEY = key;
  if (vendor === "codex") {
    invocation.env.OMA_FREELLM_API_KEY = key;
    // One complete provider value prevents inherited auth/header overrides.
    invocation.args.push(
      "-c",
      'model_provider="oma_free"',
      "-c",
      `model_providers.oma_free={name="FreeLLMAPI",base_url=${JSON.stringify(provider.baseUrl)},env_key="OMA_FREELLM_API_KEY",wire_api="responses",requires_openai_auth=false,supports_websockets=false}`,
    );
  } else if (vendor === "claude") {
    delete invocation.env.ANTHROPIC_API_KEY;
    delete invocation.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete invocation.env.CLAUDE_CODE_USE_BEDROCK;
    delete invocation.env.CLAUDE_CODE_USE_VERTEX;
    delete invocation.env.CLAUDE_CODE_USE_FOUNDRY;
    delete invocation.env.CLAUDE_CODE_USE_MANTLE;
    invocation.env.ANTHROPIC_BASE_URL = provider.baseUrl.slice(0, -3);
    invocation.env.ANTHROPIC_AUTH_TOKEN = key;
    invocation.env.ANTHROPIC_DEFAULT_OPUS_MODEL = provider.model;
    invocation.env.ANTHROPIC_DEFAULT_SONNET_MODEL = provider.model;
    invocation.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = provider.model;
    invocation.env.CLAUDE_CODE_SUBAGENT_MODEL = provider.model;
  } else if (vendor === "qwen") {
    invocation.env.OPENAI_API_KEY = key;
    invocation.env.OPENAI_BASE_URL = provider.baseUrl;
    invocation.env.OPENAI_MODEL = provider.model;
    invocation.args.push(
      "--auth-type",
      "openai",
      "--openai-base-url",
      provider.baseUrl,
    );
  }
  assertFreeSettings({ vendor, provider, env: invocation.env, workspace });
}
