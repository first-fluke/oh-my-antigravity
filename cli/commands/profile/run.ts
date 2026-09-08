import { spawnSync } from "node:child_process";
import { constants } from "node:os";
import { readLocalProfile } from "../../state/profiles.js";

export function runProfileCommand(
  slot: string,
  command: string,
  args: string[],
): number {
  if (!readLocalProfile(slot)) {
    throw new Error(
      `Profile ${slot} does not exist. Create it with: oma profile create ${slot}`,
    );
  }
  const result = spawnSync(command, args, {
    env: { ...process.env, OMA_PROFILE: slot },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== null) return result.status;
  if (result.signal) return 128 + (constants.signals[result.signal] ?? 1);
  return 1;
}
