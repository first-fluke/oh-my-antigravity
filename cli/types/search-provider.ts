/** Search adapters share capabilities and provenance, not vendor tool schemas. */
export type SearchCapability = "web" | "docs" | "contents" | "research";

export interface SearchSource {
  url: string;
  title?: string;
  excerpt?: string;
  publishedAt?: string;
}

export type SearchRequest =
  | { capability: "web" | "research"; query: string; limit?: number }
  | {
      capability: "docs";
      query: string;
      library: string;
      version?: string;
      limit?: number;
    }
  | { capability: "contents"; urls: readonly string[] };

export interface SearchResponse {
  provider: string;
  capability: SearchCapability;
  sources: readonly SearchSource[];
  text?: string;
  /** Vendor-specific fields remain available without flattening their semantics. */
  extensions?: Readonly<Record<string, unknown>>;
}

export interface SearchProviderContext {
  projectDir: string;
  /** The caller owns the deadline; adapters must propagate cancellation to I/O. */
  signal: AbortSignal;
  /** Resolve an environment/keychain reference only when an adapter needs it. */
  resolveCredential(reference: {
    env?: string;
    vault?: string;
  }): Promise<string | undefined>;
}

export interface SearchProviderStatus {
  available: boolean;
  reachability: "not-probed" | "reachable" | "unreachable";
  reason?: string;
}

export interface SearchProviderAdapter {
  /** No writes, provisioning, or search requests during health checks. */
  status(context: SearchProviderContext): Promise<SearchProviderStatus>;
  execute(
    request: SearchRequest,
    context: SearchProviderContext,
  ): Promise<SearchResponse>;
}

export interface SearchProviderDefinition {
  id: string;
  label: string;
  capabilities: readonly SearchCapability[];
  transport: "runtime" | "mcp" | "api";
  authentication: { mode: "none" | "optional" | "required"; env?: string };
  /** MCP registration is metadata; OMA does not infer tool availability from it. */
  mcp?: { server: string; tools: readonly string[] };
  /** Absent for capabilities executed by the agent runtime rather than this CLI. */
  adapter?: SearchProviderAdapter;
}

export interface SearchProviderInspection {
  provider: string;
  capability: SearchCapability;
  status:
    | "adapter-registered"
    | "runtime-managed"
    | "unregistered"
    | "unsupported"
    | "adapter-missing";
  /** Registration and credential presence do not certify live reachability. */
  reachability: "not-probed";
}
