import { profileSlot } from "../../state/events.js";
import {
  migrateLegacySessions,
  sessionMigrationActions,
} from "../../state/session-migration.js";
import type { Migration } from "./index.js";

export const migrateProfileSessions: Migration = {
  name: "028-profile-sessions",
  up(projectDir) {
    // Legacy project state belongs to the default local profile only.
    if (profileSlot() !== "0") return [];
    try {
      return sessionMigrationActions(migrateLegacySessions({ projectDir }));
    } catch (error) {
      return [
        `profile session migration deferred: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
  },
};
