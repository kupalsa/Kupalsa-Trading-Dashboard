import type { AlertKind } from "./session";

export type TradeState = "pending" | "entered" | "none";

export const TRADE_STATE_LABEL: Record<TradeState, string> = {
  pending: "Pending trade",
  entered: "Trade entered",
  none: "No trade",
};

export interface DayState {
  date: string; // YYYY-MM-DD
  tradeState: TradeState;
  fired: AlertKind[];
}

const KEY = "trading-dashboard-live-state";

export function todayStr(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Day state resets automatically when the date rolls over. */
export function loadDayState(now = new Date()): DayState {
  const fresh: DayState = { date: todayStr(now), tradeState: "pending", fired: [] };
  const raw = localStorage.getItem(KEY);
  if (!raw) return fresh;
  try {
    const parsed = JSON.parse(raw) as DayState;
    return parsed.date === fresh.date ? { ...fresh, ...parsed } : fresh;
  } catch {
    return fresh;
  }
}

export function saveDayState(state: DayState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}
