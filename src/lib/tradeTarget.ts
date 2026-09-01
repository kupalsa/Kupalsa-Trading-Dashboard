import { formatDate } from "./stats";
import type { TargetCadence } from "./strategy";
import type { Trade } from "./types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface Period {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
  label: string;
}

/** The current target period. Weeks run Monday–Sunday, matching the calendars. */
export function currentPeriod(cadence: TargetCadence, now = new Date()): Period {
  if (cadence === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: formatDate(start),
      end: formatDate(end),
      label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
    };
  }

  const weekday = now.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
  return { start: formatDate(start), end: formatDate(end), label: `${fmt(start)} – ${fmt(end)}` };
}

export function tradesInPeriod(trades: Trade[], strategyId: string, period: Period): Trade[] {
  return trades
    .filter((t) => t.strategyId === strategyId && t.date >= period.start && t.date <= period.end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/** Pull a number out of a free-text R target like "3", "3R" or "min 2.5R". */
export function parseRTarget(raw: string): number | null {
  const m = raw.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Wins needed for the period to finish profitable, assuming each win makes the
 * R target and each loss costs a full 1R:
 *
 *   net = W·R − (N − W)·1 > 0  →  W > N / (R + 1)
 *
 * So 10 trades at 3R needs 3 wins (3·3 − 7 = +2R); 2 wins would be 6 − 8 = −2R.
 * Returns null when there's no usable R target.
 */
export function requiredWins(count: number, rTarget: number | null): number | null {
  if (!rTarget || rTarget <= 0 || count <= 0) return null;
  return Math.min(count, Math.floor(count / (rTarget + 1)) + 1);
}

/** Net R if the remaining slots play out exactly to target. */
export function projectedNetR(count: number, rTarget: number, wins: number): number {
  return wins * rTarget - (count - wins) * 1;
}
