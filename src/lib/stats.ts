import { isAdherent, type DailyReview, type Trade } from "./types";
import { isTradingDay } from "./session";
import type { Strategy } from "./strategy";

export interface MonthSummary {
  totalR: number;
  winRate: number; // 0-100, excludes BE
  numTrades: number;
  avgR: number;
  maxWinStreak: number;
  maxLossStreak: number;
  tradesPerWeek: number;
  avgEntryHour: string;
  avgExitHour: string;
  avgTradeDuration: string;
  winningDays: number;
  losingDays: number;
  flatDays: number;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function dayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export function tradesForMonth(
  trades: Trade[],
  year: number,
  month: number, // 1-12
): Trade[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return trades.filter((t) => t.date.startsWith(prefix));
}

export function reviewsForMonth(
  reviews: DailyReview[],
  year: number,
  month: number, // 1-12
): DailyReview[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return reviews.filter((r) => r.date.startsWith(prefix));
}

/** Percentage (0-100) of reviews where every checklist item is checked. */
export function adherentRate(reviews: DailyReview[]): number {
  if (reviews.length === 0) return 0;
  const adherentCount = reviews.filter(isAdherent).length;
  return (adherentCount / reviews.length) * 100;
}

export interface AdherenceStats {
  rate: number; // 0-100
  adherent: number;
  total: number; // trading days that should have a review, logged or not
}

/**
 * Adherence over a date range, counting every trading day a strategy should
 * have logged — a day with no review at all counts as not adherent, same as
 * one logged with an unchecked box. `from` is clamped to each strategy's
 * `createdAt`, so pass an early sentinel (e.g. epoch) for "since always" and
 * pass strategies whose `createdAt` has been overridden to their earliest
 * actual activity (see `earliestActivityDate`) rather than the record's own
 * creation timestamp — otherwise days before the app started tracking the
 * strategy object (but when you were already trading it) go uncounted.
 */
export function adherenceForRange(
  strategies: Strategy[],
  reviews: DailyReview[],
  from: Date,
  to: Date,
): AdherenceStats {
  const byKey = new Map<string, DailyReview>();
  for (const r of reviews) byKey.set(`${r.strategyId}|${r.date}`, r);

  let total = 0;
  let adherent = 0;

  for (const s of strategies) {
    const created = new Date(s.createdAt);
    const start = new Date(Math.max(from.getTime(), created.getTime()));
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

    while (cur.getTime() <= end.getTime()) {
      if (isTradingDay(cur, s.schedule)) {
        total += 1;
        const r = byKey.get(`${s.id}|${formatDate(cur)}`);
        if (r && isAdherent(r)) adherent += 1;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return { rate: total > 0 ? (adherent / total) * 100 : 0, adherent, total };
}

/** Earliest date a strategy has any trade or review, or null if it has neither. */
export function earliestActivityDate(
  strategyId: string,
  trades: Trade[],
  reviews: DailyReview[],
): string | null {
  let min: string | null = null;
  for (const t of trades) {
    if (t.strategyId === strategyId && t.date && (min === null || t.date < min)) min = t.date;
  }
  for (const r of reviews) {
    if (r.strategyId === strategyId && r.date && (min === null || r.date < min)) min = r.date;
  }
  return min;
}

/** Elapsed time from a date to `to`, in months (30.44-day average month). */
export function monthsSince(fromDateStr: string, to: Date): number {
  const [y, m, d] = fromDateStr.split("-").map(Number);
  const from = new Date(y, m - 1, d);
  const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  return days / 30.4368;
}

/** Net R for each date within the trades list. */
export function dailyR(trades: Trade[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trades) {
    map.set(t.date, (map.get(t.date) ?? 0) + t.rr);
  }
  return map;
}

/** Entry->exit duration of each trade, in minutes. Exits before entry are treated as crossing midnight. */
function tradeDurationsMinutes(trades: Trade[]): number[] {
  return trades
    .filter((t) => t.entryTime && t.exitTime)
    .map((t) => {
      const [eh, em] = t.entryTime.split(":").map(Number);
      const [xh, xm] = t.exitTime.split(":").map(Number);
      let mins = xh * 60 + xm - (eh * 60 + em);
      if (mins < 0) mins += 24 * 60;
      return mins;
    });
}

/** Average entry->exit duration as H:MM. */
function avgDuration(trades: Trade[]): string {
  const durations = tradeDurationsMinutes(trades);
  if (durations.length === 0) return "--:--";
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  return `${Math.floor(avg / 60)}:${(avg % 60).toString().padStart(2, "0")}`;
}

/** Total time spent in trades, in hours, summed across the list. */
export function totalDurationHours(trades: Trade[]): number {
  const totalMinutes = tradeDurationsMinutes(trades).reduce((a, b) => a + b, 0);
  return totalMinutes / 60;
}

function avgTimeOfDay(times: string[]): string {
  if (times.length === 0) return "--:--";
  const totalMinutes = times.reduce((sum, t) => {
    const [h, m] = t.split(":").map(Number);
    return sum + h * 60 + m;
  }, 0);
  const avg = Math.round(totalMinutes / times.length);
  const h = Math.floor(avg / 60)
    .toString()
    .padStart(2, "0");
  const m = (avg % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function summarize(trades: Trade[]): MonthSummary {
  const totalR = trades.reduce((sum, t) => sum + t.rr, 0);
  const decisive = trades.filter((t) => t.result !== "BE");
  const wins = trades.filter((t) => t.result === "W").length;
  const winRate = decisive.length ? (wins / decisive.length) * 100 : 0;
  const avgR = trades.length ? totalR / trades.length : 0;

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of trades) {
    if (t.result === "W") {
      curWin += 1;
      curLoss = 0;
    } else if (t.result === "L") {
      curLoss += 1;
      curWin = 0;
    } else {
      curWin = 0;
      curLoss = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, curWin);
    maxLossStreak = Math.max(maxLossStreak, curLoss);
  }

  const uniqueDates = new Set(trades.map((t) => t.date));
  const weeks = Math.max(1, uniqueDates.size / 5);
  const tradesPerWeek = trades.length / weeks;

  const perDay = dailyR(trades);
  let winningDays = 0;
  let losingDays = 0;
  let flatDays = 0;
  for (const r of perDay.values()) {
    if (r > 0) winningDays += 1;
    else if (r < 0) losingDays += 1;
    else flatDays += 1;
  }

  return {
    totalR,
    winRate,
    numTrades: trades.length,
    avgR,
    maxWinStreak,
    maxLossStreak,
    tradesPerWeek,
    avgEntryHour: avgTimeOfDay(trades.map((t) => t.entryTime).filter(Boolean)),
    avgExitHour: avgTimeOfDay(trades.map((t) => t.exitTime).filter(Boolean)),
    avgTradeDuration: avgDuration(trades),
    winningDays,
    losingDays,
    flatDays,
  };
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Build a calendar grid of full Mon-Sun weeks covering every day of the month. */
export function buildCalendarWeeks(year: number, month: number): string[][] {
  const lastDay = new Date(year, month, 0);
  const firstDay = new Date(year, month - 1, 1);

  const firstWeekday = firstDay.getDay(); // 0 Sun - 6 Sat
  const mondayOffset = firstWeekday === 0 ? -6 : 1 - firstWeekday;
  const cursor = new Date(year, month - 1, 1 + mondayOffset);

  const weeks: string[][] = [];
  while (cursor.getTime() <= lastDay.getTime()) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const inMonth =
        cursor.getMonth() === month - 1 && cursor.getFullYear() === year;
      week.push(inMonth ? formatDate(cursor) : "");
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
