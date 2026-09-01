import { describe, expect, it } from "vitest";
import {
  adherenceForRange,
  buildCalendarWeeks,
  dailyR,
  earliestActivityDate,
  monthsSince,
  summarize,
} from "./stats";
import { emptyChecklist, isAdherent, type DailyReview, type Trade } from "./types";
import { defaultSchedule } from "./session";
import type { Strategy } from "./strategy";

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: crypto.randomUUID(),
    strategyId: "s1",
    date: "2026-09-01",
    day: "",
    entryTime: "16:00",
    exitTime: "17:00",
    direction: "Long",
    result: "W",
    stopPoints: 10,
    rr: 1,
    screenshotPath: null,
    note: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function review(over: Partial<DailyReview> = {}): DailyReview {
  return {
    strategyId: "s1",
    date: "2026-09-01",
    sessionOutcome: "",
    states: [],
    checklist: { ...emptyChecklist },
    notes: "",
    ...over,
  };
}

const strategy: Strategy = {
  id: "s1",
  name: "S1",
  schedule: { ...defaultSchedule }, // Mon–Fri
  definition: {} as Strategy["definition"],
  strategyRules: "",
  strategyNotes: "",
  playbook: [],
  createdAt: "2020-01-01T00:00:00.000Z",
  tradeTarget: null,
};

const allChecked = {
  backtestValid: true,
  executionOnlyFocus: true,
  noInterference: true,
  sessionLogged: true,
  stopEntryTpFollowed: true,
  strategyValid: true,
  structureValid: true,
};

describe("isAdherent", () => {
  it("needs every box checked", () => {
    expect(isAdherent(review({ checklist: allChecked }))).toBe(true);
    expect(isAdherent(review({ checklist: { ...allChecked, noInterference: false } }))).toBe(false);
  });

  it("treats a no-setup stand-down as adherent regardless of the checklist", () => {
    expect(isAdherent(review({ sessionOutcome: "No Trades — No Setup" }))).toBe(true);
  });

  it("does not extend that to a missed opportunity", () => {
    expect(isAdherent(review({ sessionOutcome: "No Trades — Missed Opportunity" }))).toBe(false);
  });
});

describe("summarize", () => {
  it("excludes breakeven from win rate but not from total R", () => {
    const s = summarize([
      trade({ result: "W", rr: 2 }),
      trade({ result: "L", rr: -1 }),
      trade({ result: "BE", rr: 0 }),
    ]);
    expect(s.totalR).toBe(1);
    expect(s.numTrades).toBe(3);
    expect(s.winRate).toBe(50); // 1 win of 2 decisive
  });

  it("counts streaks, and breakeven breaks them", () => {
    const s = summarize([
      trade({ result: "W", rr: 1 }),
      trade({ result: "W", rr: 1 }),
      trade({ result: "BE", rr: 0 }),
      trade({ result: "W", rr: 1 }),
      trade({ result: "L", rr: -1 }),
      trade({ result: "L", rr: -1 }),
    ]);
    expect(s.maxWinStreak).toBe(2);
    expect(s.maxLossStreak).toBe(2);
  });

  it("classifies days by their net R, not per trade", () => {
    const s = summarize([
      trade({ date: "2026-09-01", result: "W", rr: 3 }),
      trade({ date: "2026-09-01", result: "L", rr: -1 }), // day nets +2
      trade({ date: "2026-09-02", result: "L", rr: -1 }),
    ]);
    expect(s.winningDays).toBe(1);
    expect(s.losingDays).toBe(1);
  });

  it("is safe on an empty list", () => {
    const s = summarize([]);
    expect(s.totalR).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.avgR).toBe(0);
  });

  it("treats an exit before entry as crossing midnight", () => {
    const s = summarize([trade({ entryTime: "23:00", exitTime: "01:00" })]);
    expect(s.avgTradeDuration).toBe("2:00");
  });
});

describe("dailyR", () => {
  it("sums R per date", () => {
    const m = dailyR([
      trade({ date: "2026-09-01", rr: 1.5 }),
      trade({ date: "2026-09-01", rr: -1 }),
      trade({ date: "2026-09-02", rr: 2 }),
    ]);
    expect(m.get("2026-09-01")).toBeCloseTo(0.5);
    expect(m.get("2026-09-02")).toBe(2);
  });
});

describe("adherenceForRange", () => {
  it("counts an unlogged trading day as not adherent", () => {
    // Mon 2026-09-07 .. Fri 2026-09-11 = 5 trading days, one logged adherent.
    const stats = adherenceForRange(
      [strategy],
      [review({ date: "2026-09-07", checklist: allChecked })],
      new Date(2026, 8, 7),
      new Date(2026, 8, 11),
    );
    expect(stats.total).toBe(5);
    expect(stats.adherent).toBe(1);
    expect(stats.rate).toBeCloseTo(20);
  });

  it("ignores days the strategy does not trade", () => {
    // Sat 2026-09-05 and Sun 2026-09-06 only.
    const stats = adherenceForRange([strategy], [], new Date(2026, 8, 5), new Date(2026, 8, 6));
    expect(stats.total).toBe(0);
    expect(stats.rate).toBe(0);
  });

  it("does not judge days before the strategy existed", () => {
    const late: Strategy = { ...strategy, createdAt: "2026-09-09T00:00:00.000Z" };
    // Mon 7th .. Fri 11th, but only 9th–11th count (Wed, Thu, Fri).
    const stats = adherenceForRange([late], [], new Date(2026, 8, 7), new Date(2026, 8, 11));
    expect(stats.total).toBe(3);
  });
});

describe("earliestActivityDate", () => {
  it("takes the earliest across trades and reviews", () => {
    expect(
      earliestActivityDate("s1", [trade({ date: "2026-07-05" })], [review({ date: "2026-06-30" })]),
    ).toBe("2026-06-30");
  });

  it("ignores other strategies and returns null when there is nothing", () => {
    expect(earliestActivityDate("s1", [trade({ strategyId: "other" })], [])).toBeNull();
  });
});

describe("monthsSince", () => {
  it("reads a year as about twelve months", () => {
    expect(monthsSince("2025-09-01", new Date(2026, 8, 1))).toBeCloseTo(12, 1);
  });
});

describe("buildCalendarWeeks", () => {
  it("covers every day of the month in Mon-start weeks", () => {
    const weeks = buildCalendarWeeks(2026, 9); // Sep 2026 starts on a Tuesday
    const days = weeks.flat().filter(Boolean);
    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-09-01");
    expect(days[29]).toBe("2026-09-30");
    // The 1st is a Tuesday, so the leading Monday cell is blank.
    expect(weeks[0][0]).toBe("");
    expect(weeks[0][1]).toBe("2026-09-01");
  });
});
