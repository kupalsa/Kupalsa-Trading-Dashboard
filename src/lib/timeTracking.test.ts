import { describe, expect, it } from "vitest";
import {
  discardOpenSegment,
  finish,
  formatDuration,
  formatHours,
  isRunning,
  manualSession,
  msByCategoryForMonth,
  msByDay,
  newSession,
  pause,
  resume,
  segmentDayParts,
  segmentMs,
  sessionMs,
  staleOpenSegment,
  trimToLastSeen,
  type TimeSession,
} from "./timeTracking";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Local-time ISO, so tests don't depend on the machine's zone. */
function at(y: number, mo: number, d: number, h: number, mi = 0): string {
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

function session(over: Partial<TimeSession> = {}): TimeSession {
  return {
    id: "s",
    category: "Backtest",
    segments: [],
    note: "",
    createdAt: at(2026, 9, 1, 10),
    ...over,
  };
}

describe("segmentMs", () => {
  it("measures a closed segment", () => {
    expect(segmentMs({ start: at(2026, 9, 1, 10), end: at(2026, 9, 1, 11, 30) })).toBe(90 * MIN);
  });

  it("measures an open segment against now", () => {
    const now = new Date(2026, 8, 1, 12);
    expect(segmentMs({ start: at(2026, 9, 1, 11), end: null }, now)).toBe(HOUR);
  });

  it("never returns negative time for a reversed range", () => {
    expect(segmentMs({ start: at(2026, 9, 1, 12), end: at(2026, 9, 1, 10) })).toBe(0);
  });
});

describe("sessionMs", () => {
  it("sums paused and running segments", () => {
    const now = new Date(2026, 8, 1, 12, 30);
    const s = session({
      segments: [
        { start: at(2026, 9, 1, 10), end: at(2026, 9, 1, 10, 45) },
        { start: at(2026, 9, 1, 12), end: null },
      ],
    });
    expect(sessionMs(s, now)).toBe(45 * MIN + 30 * MIN);
  });
});

describe("start / pause / resume / finish", () => {
  it("runs, stops on pause and runs again on resume", () => {
    const s = newSession("Backtest", new Date(2026, 8, 1, 10));
    expect(isRunning(s)).toBe(true);

    const paused = pause(s, new Date(2026, 8, 1, 10, 30));
    expect(isRunning(paused)).toBe(false);
    expect(sessionMs(paused)).toBe(30 * MIN);

    const resumed = resume(paused, new Date(2026, 8, 1, 11));
    expect(isRunning(resumed)).toBe(true);
    expect(resumed.segments).toHaveLength(2);
  });

  it("does not accrue time while paused", () => {
    const paused = pause(
      newSession("Backtest", new Date(2026, 8, 1, 10)),
      new Date(2026, 8, 1, 10, 30),
    );
    // Measured an hour later, it is still only the 30 minutes worked.
    expect(sessionMs(paused, new Date(2026, 8, 1, 11, 30))).toBe(30 * MIN);
  });

  it("pausing twice does not move the first end time", () => {
    const once = pause(newSession("Backtest", new Date(2026, 8, 1, 10)), new Date(2026, 8, 1, 10, 30));
    const twice = pause(once, new Date(2026, 8, 1, 11));
    expect(twice).toEqual(once);
  });

  it("finish closes the open segment and drops empty ones", () => {
    const s = resume(
      pause(newSession("Backtest", new Date(2026, 8, 1, 10)), new Date(2026, 8, 1, 10, 30)),
      new Date(2026, 8, 1, 11),
    );
    const done = finish(s, new Date(2026, 8, 1, 11)); // resumed and ended instantly
    expect(isRunning(done)).toBe(false);
    expect(done.segments).toHaveLength(1);
    expect(sessionMs(done)).toBe(30 * MIN);
  });
});

describe("segmentDayParts", () => {
  it("keeps a same-day segment whole", () => {
    const parts = segmentDayParts({ start: at(2026, 9, 1, 10), end: at(2026, 9, 1, 12) });
    expect(parts).toEqual([{ date: "2026-09-01", ms: 2 * HOUR }]);
  });

  it("splits across midnight", () => {
    const parts = segmentDayParts({ start: at(2026, 9, 30, 23, 40), end: at(2026, 10, 1, 0, 20) });
    expect(parts).toEqual([
      { date: "2026-09-30", ms: 20 * MIN },
      { date: "2026-10-01", ms: 20 * MIN },
    ]);
  });

  it("spans several days", () => {
    const parts = segmentDayParts({ start: at(2026, 9, 1, 22), end: at(2026, 9, 3, 2) });
    expect(parts.map((p) => p.date)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(parts.reduce((n, p) => n + p.ms, 0)).toBe(28 * HOUR);
  });

  it("yields nothing for a zero or reversed range", () => {
    expect(segmentDayParts({ start: at(2026, 9, 1, 10), end: at(2026, 9, 1, 10) })).toEqual([]);
    expect(segmentDayParts({ start: at(2026, 9, 1, 12), end: at(2026, 9, 1, 10) })).toEqual([]);
  });
});

describe("msByCategoryForMonth", () => {
  it("credits a midnight-crossing session to both months", () => {
    const s = session({
      category: "Backtest",
      segments: [{ start: at(2026, 9, 30, 23, 40), end: at(2026, 10, 1, 0, 20) }],
    });
    expect(msByCategoryForMonth([s], 2026, 9)).toEqual([{ category: "Backtest", ms: 20 * MIN }]);
    expect(msByCategoryForMonth([s], 2026, 10)).toEqual([{ category: "Backtest", ms: 20 * MIN }]);
  });

  it("totals per category, largest first", () => {
    const rows = msByCategoryForMonth(
      [
        session({ id: "a", category: "Backtest", segments: [{ start: at(2026, 9, 1, 10), end: at(2026, 9, 1, 11) }] }),
        session({ id: "b", category: "Study", segments: [{ start: at(2026, 9, 2, 10), end: at(2026, 9, 2, 12) }] }),
        session({ id: "c", category: "Backtest", segments: [{ start: at(2026, 9, 3, 10), end: at(2026, 9, 3, 10, 30) }] }),
      ],
      2026,
      9,
    );
    expect(rows).toEqual([
      { category: "Study", ms: 2 * HOUR },
      { category: "Backtest", ms: 90 * MIN },
    ]);
  });

  it("excludes other months", () => {
    const s = session({ segments: [{ start: at(2026, 8, 15, 10), end: at(2026, 8, 15, 11) }] });
    expect(msByCategoryForMonth([s], 2026, 9)).toEqual([]);
  });
});

describe("msByDay", () => {
  it("aggregates every session onto its days", () => {
    const map = msByDay([
      session({ id: "a", segments: [{ start: at(2026, 9, 1, 10), end: at(2026, 9, 1, 11) }] }),
      session({ id: "b", segments: [{ start: at(2026, 9, 1, 14), end: at(2026, 9, 1, 14, 30) }] }),
    ]);
    expect(map.get("2026-09-01")).toBe(90 * MIN);
  });
});

describe("left-running recovery", () => {
  const start = new Date(2026, 8, 1, 9);
  const lastSeen = new Date(2026, 8, 1, 10);
  const openSession = session({
    segments: [{ start: start.toISOString(), end: null }],
    lastSeen: lastSeen.toISOString(),
  });

  it("flags an open segment only once it is implausibly long", () => {
    expect(staleOpenSegment(openSession, new Date(2026, 8, 1, 11))).toBeNull();
    expect(staleOpenSegment(openSession, new Date(2026, 8, 1, 20))).not.toBeNull();
    expect(staleOpenSegment(null)).toBeNull();
  });

  it("trims to when the app was last open rather than counting overnight", () => {
    const trimmed = trimToLastSeen(openSession);
    expect(isRunning(trimmed)).toBe(false);
    expect(sessionMs(trimmed)).toBe(HOUR);
  });

  it("discards the open segment but keeps earlier work", () => {
    const s = session({
      segments: [
        { start: at(2026, 9, 1, 8), end: at(2026, 9, 1, 8, 30) },
        { start: at(2026, 9, 1, 9), end: null },
      ],
    });
    const kept = discardOpenSegment(s);
    expect(kept.segments).toHaveLength(1);
    expect(sessionMs(kept)).toBe(30 * MIN);
  });
});

describe("manualSession", () => {
  it("builds a session from typed times", () => {
    const s = manualSession("Study", "2026-09-01", "14:00", "15:30")!;
    expect(sessionMs(s)).toBe(90 * MIN);
    expect(s.category).toBe("Study");
    expect(isRunning(s)).toBe(false);
  });

  it("reads an end before the start as crossing midnight", () => {
    const s = manualSession("Study", "2026-09-01", "23:00", "01:00")!;
    expect(sessionMs(s)).toBe(2 * HOUR);
  });

  it("rejects incomplete input", () => {
    expect(manualSession("Study", "", "14:00", "15:00")).toBeNull();
    expect(manualSession("Study", "2026-09-01", "", "15:00")).toBeNull();
  });
});

describe("formatting", () => {
  it("shows hours only once there are some", () => {
    expect(formatDuration(9 * 1000)).toBe("0:09");
    expect(formatDuration(4 * MIN + 9 * 1000)).toBe("4:09");
    expect(formatDuration(HOUR + 4 * MIN + 9 * 1000)).toBe("1:04:09");
  });

  it("summarises without seconds", () => {
    expect(formatHours(45 * MIN)).toBe("45m");
    expect(formatHours(3 * HOUR)).toBe("3h");
    expect(formatHours(3 * HOUR + 20 * MIN)).toBe("3h 20m");
  });
});
