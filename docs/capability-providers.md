# Capability providers (experimental)

OMA separates documentation, code intelligence, semantic recall, and deterministic
workflow state. Gortex and Honcho are opt-in integrations; existing installations
keep Context7, Serena, and the existing optional AgentMemory behavior.

| Capability | Default | Alternatives | Fallback |
| --- | --- | --- | --- |
| Documentation | Context7 | — | Official documentation through web search |
| Code intelligence | Serena | Gortex (experimental) | Native search/read |
| Semantic memory | AgentMemory | Honcho (experimental), `none` | Local evidence only |
| Coordination and verification | `.agents/state/` | — | No external memory dependency |

## Configuration

Set the following in the project's `.agents/oma-config.yaml` through your normal
configuration source. Omit any field to retain its default.

```yaml
providers:
  docs: context7
  code_intelligence: gortex
  semantic_memory: honcho

honcho:
  workspace_id: my-team
  project_id: my-project
  api_key_env: HONCHO_API_KEY
  base_url: https://api.honcho.dev
  timeout_ms: 5000
  max_results: 8
  max_tokens: 2000
  recall_mode: hybrid  # hybrid | messages
```

Supply the API key through the named environment variable; do not put it in YAML.
`workspace_id` is required for Honcho access. `project_id` is optional: its default
is the resolved project-root path. Set a stable, unique project ID to share recall
across checkouts or machines. Reusing an ID in the same workspace intentionally
shares memory. Provider selection is resolved from the project configuration;
global MCP projection does not make memory configuration global to all projects.

Apply the native configuration and inspect status:

```sh
oma link --dry-run
oma link
oma doctor
oma memory status
```

Run `oma link` after changing providers, including when reverting to defaults.
There is no automatic provider installation, service deployment, or repository
tracking in this integration. The installer continues to offer its existing
defaults; experimental selection is configured explicitly in YAML.

## Gortex

Install [Gortex](https://github.com/zzet/gortex) separately and explicitly choose
which repositories to track. OMA projects `gortex mcp --tools compact` into the selected runtimes'
native MCP files and removes their Serena entry while Gortex is selected. Existing
custom Gortex commands are retained. Pi also receives the `pi-mcp-adapter` package
registration, even when no browser MCP is selected.

New OMA entries explicitly select the [compact MCP surface](https://github.com/zzet/gortex/blob/main/docs/mcp.md#compact-mcp-surface):
21 domain tools, with operation schemas discovered through `capabilities`.
Existing custom Gortex entries keep their chosen preset. An inherited
`GORTEX_TOOLS` environment variable takes precedence over the CLI flag.

Generated agent instructions route code-intelligence work to Gortex and override
Serena-specific skill routing. The CLI hook dispatcher suppresses the Serena
primer. OMA does not run `gortex install`, `gortex init`, or `gortex track`.

Previous native Serena/Gortex entries are saved in
`.agents/state/provider-mcp.json`. Switching back to Serena restores these entries
and removes an OMA-added Gortex entry. Preserve this backup until restoration;
it can contain environment values from custom MCP entries and is written with
owner-only permissions. User-managed servers outside the projected native files
are outside this reconciliation scope. The shared `.agents/mcp.json` template
is not changed by provider projection.

`oma doctor` reports Gortex binary availability. It does not validate that a graph
has been indexed or run a graph query. If Gortex is unavailable, use native search;
OMA does not silently activate Serena as a second provider.

## Honcho

The adapter uses the [Honcho v3 API](https://honcho.dev/docs/v3): get/create a
workspace and project session, create messages, and search within that session.
Only durable conclusions from `decision.made`, `blocker.raised`, and
`skill.pattern.consolidated` events are automatically remembered. Raw transcripts,
diffs, task boards, and complete event envelopes are not sent. Raw transcript
imports are rejected for Honcho and `none`; existing AgentMemory retry entries
are retained without uploading them to a different provider.

Each project maps to a hashed session ID within the configured workspace. Messages
use the `oma` peer and retain their source OMA session in metadata. Recall checks
workspace, project session, peer, message ID, and OMA source metadata before
returning a result with provenance. By default, `recall_mode: hybrid` retrieves
Honcho's derived peer representation alongside message matches. Both requests
share one deadline and restrict recall to the same project session. Set
`recall_mode: messages` to use only the stored-message search.

Representations are curated around the current query and include frequently
derived conclusions. They can carry lasting preferences or project context inferred
from the durable decisions OMA recorded. The default `oma` peer represents this
project's OMA records, not an authenticated individual user's global personality.
OMA does not broaden the query to other projects or start uploading raw chats.

Inferred context is explicitly labeled advisory and potentially outdated. It is
not a user instruction, a verified fact, or workflow gate evidence. Its provenance
records the workspace, project session, peer, and retrieval time; the endpoint
returns no source-message IDs, so none are invented. Retrieval time is not the
age of the inference. Derivation is asynchronous: empty, unavailable, or timed-out
representations fall back to message results without an unscoped retry. The adapter
uses the current v3 representation API and does not add a per-request chat-model
reasoning call. Server-side derivation/search may still consume model resources.

Results are limited by count and an aggregate content budget. An inferred-context
item counts toward the same result limit and uses at most half the content budget
when message matches are present (except a one-result request). Oversized inferred
context is truncated at a Unicode boundary and marked; the advisory label also
counts toward the budget. `max_tokens` uses
UTF-8 bytes as a conservative upper bound, so it can return fewer results than
an exact tokenizer would. Oversized facts are skipped. Search order is preserved;
the adapter's reciprocal-rank score is not a Honcho confidence score.

Requests have a bounded timeout and do not follow redirects. Writes share one
timeout across workspace/session/message operations. Failures keep local OMA
events intact and return no remote recall; they do not upload data to another
provider. Durable writes currently have no replay queue or deduplication, so a
failed write may be absent remotely and repeated writes may produce duplicates.

For self-hosting, set `base_url` to the API origin. HTTP without a key is allowed
only on loopback; remote endpoints require HTTPS and a key. OMA does not provision
the Honcho server, databases, model credentials, or retention/deletion policies.
Honcho server licensing and deployment requirements should be reviewed separately
in the [upstream repository](https://github.com/plastic-labs/honcho).

The CLI event pipeline, skill optimization recall, and CLI-dispatched hooks use
the selected provider. Standalone copied Bun hooks, including Pi/OpenCode bridge
scripts, use the generated `.agents/state/provider-selection.json` to keep raw
events local for Honcho/`none`; those scripts do not perform Honcho recall.

`oma memory status` and the provider section of `oma doctor` check Honcho workspace
access with a read-only session-list request. They do not create a workspace.
Existing `oma memory setup`, daemon, upgrade, and maintenance commands remain
AgentMemory-specific.

## Diagnostics and evaluation

Context7 diagnostics report configuration presence, declared API-key versus
anonymous/client-managed authentication, and the official-documentation fallback.
Reachability is explicitly reported as `not-probed`; this does not certify a live
MCP connection or valid credentials.

Automated tests cover configuration defaults, native MCP formats, custom-setting
restoration, dry runs, SSOT symlinks, hook routing, project isolation, provenance,
budgets, authentication failures, timeouts, and raw-event exclusion. These are
local and mocked API checks. Live runtime compatibility, retrieval quality, token
cost, graph startup cost, and privacy/deletion behavior still need evaluation
against OMA fixtures before either integration is promoted from experimental.
