import type { Command } from "commander";
import {
  createSearchProviderRegistry,
  type SearchProviderRegistry,
} from "../../platform/search-providers.js";
import { loadProviders } from "../../utils/providers.js";

export function searchProviderReport(
  root?: string,
  registry: SearchProviderRegistry = createSearchProviderRegistry(),
) {
  const selected = loadProviders(root);
  return {
    selected: {
      docs: registry.inspect(selected.docs, "docs"),
      web: registry.inspect(selected.web, "web"),
    },
    providers: registry.list().map(({ adapter, ...metadata }) => ({
      ...metadata,
      cliAdapter: Boolean(adapter),
    })),
  };
}

export function registerSearchProviders(search: Command): void {
  search
    .command("providers")
    .description(
      "List registered search providers and inspect selection without network calls",
    )
    .option("--json", "Output JSON (default)")
    .option("--pretty", "Pretty-print JSON")
    .action((opts: { pretty?: boolean }) => {
      try {
        const report = searchProviderReport();
        console.log(JSON.stringify(report, null, opts.pretty ? 2 : undefined));
        if (
          Object.values(report.selected).some(({ status }) =>
            ["unregistered", "unsupported", "adapter-missing"].includes(status),
          )
        )
          process.exitCode = 1;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
