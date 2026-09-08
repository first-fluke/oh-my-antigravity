import type { Command } from "commander";
import {
  createLocalProfile,
  listLocalProfiles,
  readLocalProfile,
  type ShellKind,
  selectedProfileStatus,
  shellActivation,
} from "../../state/profiles.js";
import {
  addOutputOptions,
  resolveJsonMode,
  runAction,
} from "../../utils/cli-framework.js";
import { runProfileCommand } from "./run.js";

const SHELLS = new Set<ShellKind>(["sh", "bash", "zsh", "fish"]);

export function registerProfile(program: Command): void {
  const profile = program
    .command("profile")
    .description("Manage local OMA execution profiles");

  addOutputOptions(
    profile.command("list").description("List local profiles"),
  ).action(
    runAction(
      async (options) => {
        const profiles = listLocalProfiles();
        if (resolveJsonMode(options)) {
          console.log(JSON.stringify(profiles, null, 2));
          return;
        }
        if (profiles.length === 0) {
          console.log(
            "No local profiles. Create one with: oma profile create 0",
          );
          return;
        }
        for (const entry of profiles) {
          console.log(
            `${entry.selected ? "*" : " "} ${entry.slot} ${entry.profile?.profileId}`,
          );
        }
      },
      { supportsJsonOutput: true },
    ),
  );

  addOutputOptions(
    profile.command("show [slot]").description("Show a local profile"),
  ).action(
    runAction(
      async (slot: string | undefined, options) => {
        const result = slot
          ? {
              slot,
              selected: slot === selectedProfileStatus().slot,
              profile: readLocalProfile(slot),
            }
          : selectedProfileStatus();
        if (resolveJsonMode(options)) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        if (!result.profile) {
          console.log(`Profile ${result.slot} has not been created.`);
          return;
        }
        console.log(`Profile ${result.slot}`);
        console.log(`ID: ${result.profile.profileId}`);
        console.log(`Created: ${result.profile.createdAt}`);
      },
      { supportsJsonOutput: true },
    ),
  );

  addOutputOptions(
    profile.command("create <slot>").description("Create a local profile"),
  ).action(
    runAction(
      async (slot: string, options) => {
        const result = createLocalProfile(slot);
        if (resolveJsonMode(options))
          console.log(JSON.stringify(result, null, 2));
        else console.log(`Created profile ${result.slot}: ${result.profileId}`);
      },
      { supportsJsonOutput: true },
    ),
  );

  addOutputOptions(
    profile
      .command("use <slot>")
      .description("Print shell code to activate an existing profile")
      .option("--shell <shell>", "Target shell: sh, bash, zsh, or fish"),
  ).action(
    runAction(
      async (slot: string, options) => {
        if (!readLocalProfile(slot)) {
          throw new Error(
            `Profile ${slot} does not exist. Create it with: oma profile create ${slot}`,
          );
        }
        const shell = options.shell as string | undefined;
        if (shell !== undefined) {
          if (!SHELLS.has(shell as ShellKind)) {
            throw new Error("Unsupported shell. Use sh, bash, zsh, or fish");
          }
          const activation = shellActivation(slot, shell as ShellKind);
          if (resolveJsonMode(options)) {
            console.log(JSON.stringify({ slot, shell, activation }, null, 2));
          } else {
            console.log(activation);
          }
          return;
        }
        if (resolveJsonMode(options)) {
          console.log(JSON.stringify({ slot, selected: false }, null, 2));
          return;
        }
        console.log(
          `Profile ${slot} ${selectedProfileStatus().slot === slot ? "is already" : "is not"} selected in this process. This command cannot change the parent shell.`,
        );
        console.log(
          `Activate it with: eval "$(oma profile use ${slot} --shell zsh)"`,
        );
      },
      { supportsJsonOutput: true },
    ),
  );

  profile
    .command("run <slot> <command> [args...]")
    .description("Run one command with OMA_PROFILE set for the child process")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action((slot: string, command: string, args: string[]) => {
      process.exitCode = runProfileCommand(slot, command, args);
    });
}
