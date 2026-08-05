import { isAdherent, type DailyReview, type Trade } from "./types";

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

/** Net R for each date within the trades list. */
export function dailyR(trades: Trade[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trades) {
    map.set(t.date, (map.get(t.date) ?? 0) + t.rr);
  }
  return map;
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
    winningDays,
    losingDays,
    flatDays,
  };
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Build a 4-6 row calendar grid (Mon-Fri columns) for the given month. */
export function buildCalendarWeeks(year: number, month: number): string[][] {
  const lastDay = new Date(year, month, 0);
  const firstDay = new Date(year, month - 1, 1);

  const firstWeekday = firstDay.getDay(); // 0 Sun - 6 Sat
  const mondayOffset = firstWeekday === 0 ? -6 : 1 - firstWeekday;
  const cursor = new Date(year, month - 1, 1 + mondayOffset);

  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let i = 0; i < 5; i++) {
      const inMonth =
        cursor.getMonth() === month - 1 && cursor.getFullYear() === year;
      week.push(inMonth ? formatDate(cursor) : "");
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 2); // Sat + Sun -> next Monday
    if (cursor.getTime() > lastDay.getTime()) break;
  }
  return weeks;
}
