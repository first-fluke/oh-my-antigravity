import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach } from "vitest";

// All state writers, including spawned Bun hooks, inherit an isolated home.
const root = mkdtempSync(join(tmpdir(), "oma-profile-tests-"));
let sequence = 0;
beforeEach(() => {
  process.env.OMA_STATE_HOME = join(root, String(sequence++));
  process.env.OMA_PROFILE = "0";
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});
