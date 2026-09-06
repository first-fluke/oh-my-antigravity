import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deriveMeta,
  ensureSessionStorage,
  eventsPath,
  type OmaEvent,
  readEvents,
  sessionDir,
  sortEvents,
} from "./events.js";

/**
 * D64: events.jsonl append order may differ from logical order under parallel
 * orchestrate/subagent processes. State readers MUST sort by (ts, eventId) and
 * derive the same phase/gate/decision state regardless of raw file order.
 */

const SID = "oma-derive-order";

// Canonical (logical) order. eventId is a sortable tie-breaker for equal ts.
const CANONICAL: OmaEvent[] = [
  {
    eventId: "evt-00",
    ts: "2026-06-02T00:00:00.000Z",
    sid: SID,
    kind: "session.created",
    writerPid: 100,
    payload: { workflow: "ultrawork", category: "main" },
  },
  {
    eventId: "evt-10",
    ts: "2026-06-02T00:00:01.000Z",
    sid: SID,
    kind: "workflow.phase",
    writerPid: 100,
    payload: { phase: "phase-1-design" },
  },
  {
    eventId: "evt-20",
    ts: "2026-06-02T00:00:02.000Z",
    sid: SID,
    kind: "gate.passed",
    writerPid: 201,
    payload: { gate: "phase-1-design", by: "architecture-reviewer-01" },
  },
  // Same ts as the gate but a later eventId — emitted by a parallel writer.
  {
    eventId: "evt-21",
    ts: "2026-06-02T00:00:02.000Z",
    sid: SID,
    kind: "decision.made",
    writerPid: 202,
    payload: { subject: "JWT expiry", decision: "24h", rationale: "mobile" },
  },
  {
    eventId: "evt-30",
    ts: "2026-06-02T00:00:03.000Z",
    sid: SID,
    kind: "workflow.phase",
    writerPid: 100,
    payload: { phase: "phase-3-verify" },
  },
  {
    eventId: "evt-40",
    ts: "2026-06-02T00:00:04.000Z",
    sid: SID,
    kind: "session.ended",
    writerPid: 100,
    payload: { status: "completed" },
  },
];

// A deterministic non-trivial shuffle (no Math.random — must stay reproducible).
const SHUFFLE_ORDER = [4, 1, 3, 0, 5, 2];

function writeEventsInOrder(projectDir: string, events: OmaEvent[]): void {
  ensureSessionStorage(projectDir, SID);
  mkdirSync(sessionDir(projectDir, SID), { recursive: true });
  for (const event of events) {
    appendFileSync(eventsPath(projectDir, SID), `${JSON.stringify(event)}\n`);
  }
}

describe("event derivation is independent of file order (D64)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "oma-derive-order-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("readEvents returns canonical (ts, eventId) order regardless of file order", () => {
    const shuffled = SHUFFLE_ORDER.map((i) => CANONICAL[i] as OmaEvent);
    writeEventsInOrder(projectDir, shuffled);

    const read = readEvents(projectDir, SID);
    expect(read.map((event) => event.eventId)).toEqual(
      CANONICAL.map((event) => event.eventId),
    );
  });

  it("derives identical phase/gate/decision/status state from shuffled vs sorted input", () => {
    const shuffled = SHUFFLE_ORDER.map((i) => CANONICAL[i] as OmaEvent);
    writeEventsInOrder(projectDir, shuffled);

    const fromFile = deriveMeta(SID, readEvents(projectDir, SID));
    const fromCanonical = deriveMeta(SID, CANONICAL);

    expect(fromFile).toEqual(fromCanonical);
    expect(fromFile.currentPhase).toBe("phase-3-verify");
    expect(fromFile.status).toBe("completed");
    expect(fromFile.gatesPassedBy).toHaveLength(1);
    expect(fromFile.gatesPassedBy[0]).toMatchObject({ gate: "phase-1-design" });
  });

  it("breaks equal-timestamp ties by eventId so the last phase is stable", () => {
    // Two phase events share a ts; the higher eventId must win deterministically.
    const tie: OmaEvent[] = [
      {
        eventId: "p-a",
        ts: "2026-06-02T00:00:09.000Z",
        sid: SID,
        kind: "workflow.phase",
        writerPid: 1,
        payload: { phase: "earlier-by-id" },
      },
      {
        eventId: "p-b",
        ts: "2026-06-02T00:00:09.000Z",
        sid: SID,
        kind: "workflow.phase",
        writerPid: 2,
        payload: { phase: "later-by-id" },
      },
    ];
    // Insert in reverse to prove file order does not decide the winner.
    expect(
      deriveMeta(SID, [tie[1] as OmaEvent, tie[0] as OmaEvent]).currentPhase,
    ).toBe("later-by-id");
    expect(
      sortEvents([tie[1] as OmaEvent, tie[0] as OmaEvent]).map(
        (e) => e.eventId,
      ),
    ).toEqual(["p-a", "p-b"]);
  });

  it("quarantine-free read still derives correct state when a malformed line is present", () => {
    writeEventsInOrder(projectDir, CANONICAL);
    // Append a corrupt line; readEvents must skip it without changing state.
    appendFileSync(eventsPath(projectDir, SID), "{not json\n");

    const meta = deriveMeta(SID, readEvents(projectDir, SID));
    expect(meta.currentPhase).toBe("phase-3-verify");
    expect(meta.status).toBe("completed");
  });
});
