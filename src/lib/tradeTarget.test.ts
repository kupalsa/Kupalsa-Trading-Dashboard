import { describe, expect, it } from "vitest";
import { currentPeriod, parseRTarget, projectedNetR, requiredWins, tradesInPeriod } from "./tradeTarget";
import type { Trade } from "./types";

function trade(date: string, over: Partial<Trade> = {}): Trade {
  return {
    id: date + (over.id ?? ""),
    strategyId: "s1",
    date,
    day: "",
    entryTime: "16:00",
    exitTime: "17:00",
    direction: "Long",
    result: "W",
    stopPoints: 10,
    rr: 1,
    screenshotPath: null,
    note: "",
    createdAt: `${date}T00:00:00.000Z`,
    ...over,
  };
}

describe("parseRTarget", () => {
  it("reads a bare number, an R suffix and a prose form", () => {
    expect(parseRTarget("3")).toBe(3);
    expect(parseRTarget("3R")).toBe(3);
    expect(parseRTarget("min 2.5R")).toBe(2.5);
  });

  it("rejects anything without a usable positive number", () => {
    expect(parseRTarget("")).toBeNull();
    expect(parseRTarget("none")).toBeNull();
    expect(parseRTarget("0")).toBeNull();
    expect(parseRTarget("-2")).toBeNull();
  });
});

describe("requiredWins", () => {
  // The whole point of the board: the figure must be the SMALLEST win count
  // that finishes profitable. One fewer must not be profitable.
  it.each([
    [10, 3],
    [10, 1],
    [10, 2],
    [12, 2],
    [3, 3],
    [5, 2],
    [10, 4],
    [10, 0.5],
    [1, 5],
    [30, 3],
  ])("N=%i R=%s is minimal and profitable", (count, r) => {
    const w = requiredWins(count, r)!;
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(count);
    expect(projectedNetR(count, r, w)).toBeGreaterThan(0);
    expect(projectedNetR(count, r, w - 1)).toBeLessThanOrEqual(0);
  });

  it("matches the worked example: 10 trades at 3R needs 3 wins for +2R", () => {
    expect(requiredWins(10, 3)).toBe(3);
    expect(projectedNetR(10, 3, 3)).toBe(2);
    expect(projectedNetR(10, 3, 2)).toBe(-2);
  });

  it("has no answer without a usable R target", () => {
    expect(requiredWins(10, null)).toBeNull();
    expect(requiredWins(10, 0)).toBeNull();
    expect(requiredWins(0, 3)).toBeNull();
  });
});

describe("currentPeriod", () => {
  it("spans the whole calendar month", () => {
    const p = currentPeriod("month", new Date(2026, 1, 14)); // Feb 2026
    expect(p.start).toBe("2026-02-01");
    expect(p.end).toBe("2026-02-28");
  });

  it("runs Monday to Sunday, including when today is Sunday", () => {
    // 2026-09-06 is a Sunday; its week must start Mon 2026-08-31.
    const sun = currentPeriod("week", new Date(2026, 8, 6));
    expect(sun.start).toBe("2026-08-31");
    expect(sun.end).toBe("2026-09-06");

    // 2026-09-07 is the Monday that starts the next week.
    const mon = currentPeriod("week", new Date(2026, 8, 7));
    expect(mon.start).toBe("2026-09-07");
    expect(mon.end).toBe("2026-09-13");
  });
});

describe("tradesInPeriod", () => {
  const period = { start: "2026-09-01", end: "2026-09-30", label: "September" };

  it("keeps only this strategy's trades inside the range, in order", () => {
    const rows = tradesInPeriod(
      [
        trade("2026-09-15"),
        trade("2026-08-31"), // before
        trade("2026-10-01"), // after
        trade("2026-09-02"),
        trade("2026-09-10", { strategyId: "other" }),
      ],
      "s1",
      period,
    );
    expect(rows.map((t) => t.date)).toEqual(["2026-09-02", "2026-09-15"]);
  });

  it("includes both boundary days", () => {
    const rows = tradesInPeriod([trade("2026-09-01"), trade("2026-09-30")], "s1", period);
    expect(rows).toHaveLength(2);
  });
});
