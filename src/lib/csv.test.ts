import { describe, expect, it } from "vitest";
import { reviewsToCsv, tradesToCsv } from "./csv";
import { emptyChecklist, type DailyReview, type Trade } from "./types";
import type { Strategy } from "./strategy";
import { defaultSchedule } from "./session";

const strategies: Strategy[] = [
  {
    id: "s1",
    name: "GLD_STG_1",
    schedule: { ...defaultSchedule },
    definition: {} as Strategy["definition"],
    strategyRules: "",
    strategyNotes: "",
    playbook: [],
    createdAt: "2020-01-01T00:00:00.000Z",
    tradeTarget: null,
  },
];

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: "t1",
    strategyId: "s1",
    date: "2026-09-01",
    day: "Tuesday",
    entryTime: "16:00",
    exitTime: "17:00",
    direction: "Long",
    result: "W",
    stopPoints: 10,
    rr: 2,
    screenshotPath: null,
    note: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("tradesToCsv", () => {
  it("writes a header and resolves the strategy name", () => {
    const csv = tradesToCsv([trade()], strategies);
    const [header, row] = csv.split("\r\n");
    expect(header).toContain('"Date"');
    expect(row).toContain('"GLD_STG_1"');
    expect(row).toContain('"2026-09-01"');
  });

  it("escapes quotes and keeps embedded commas and newlines in one field", () => {
    const csv = tradesToCsv([trade({ note: 'He said "wait", then\nI entered' })], strategies);
    expect(csv).toContain('"He said ""wait"", then\nI entered"');
  });

  it("neutralises values a spreadsheet would run as a formula", () => {
    const csv = tradesToCsv([trade({ note: "=SUM(A1:A9)" })], strategies);
    expect(csv).toContain("\"'=SUM(A1:A9)\"");
  });

  it("sorts oldest first", () => {
    const csv = tradesToCsv(
      [trade({ id: "b", date: "2026-09-05" }), trade({ id: "a", date: "2026-09-01" })],
      strategies,
    );
    const rows = csv.split("\r\n").slice(1);
    expect(rows[0]).toContain("2026-09-01");
    expect(rows[1]).toContain("2026-09-05");
  });

  it("emits just a header for no trades", () => {
    expect(tradesToCsv([], strategies).split("\r\n")).toHaveLength(1);
  });
});

describe("reviewsToCsv", () => {
  const review: DailyReview = {
    strategyId: "s1",
    date: "2026-09-01",
    sessionOutcome: "No Trades — No Setup",
    states: ["Calm", "Focused"],
    checklist: { ...emptyChecklist },
    notes: "",
  };

  it("joins states without breaking the column, and reflects adherence", () => {
    const row = reviewsToCsv([review], strategies).split("\r\n")[1];
    expect(row).toContain('"Calm; Focused"');
    // No-setup counts as adherent even with an empty checklist.
    expect(row).toContain('"Yes"');
  });
});
