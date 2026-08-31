import { DEFAULT_STRATEGY_ID } from "./strategy";

/**
 * A deliberately minimal backtest record: a sequential number, screenshots you
 * can click to view, and one free-text blob — normally the raw output of the
 * Trade Logger tool. Nothing here is parsed or scored; structured analysis
 * lives (or will live) elsewhere.
 */
export interface BacktestEntry {
  id: string;
  strategyId: string;
  seq: number;
  screenshotPaths: string[]; // repo-relative
  text: string;
  createdAt: string; // ISO timestamp
}

export function normalizeBacktestEntry(raw: Partial<BacktestEntry>): BacktestEntry {
  return {
    id: raw.id ?? crypto.randomUUID(),
    strategyId: raw.strategyId ?? DEFAULT_STRATEGY_ID,
    seq: typeof raw.seq === "number" ? raw.seq : 0,
    screenshotPaths: raw.screenshotPaths ?? [],
    text: raw.text ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export function newBacktestEntry(seq: number, strategyId: string): BacktestEntry {
  return {
    id: crypto.randomUUID(),
    strategyId,
    seq,
    screenshotPaths: [],
    text: "",
    createdAt: new Date().toISOString(),
  };
}

export function backtestEntryImagePath(entryId: string, index: number): string {
  return `backtest-entries/${entryId}-${index}.jpg`;
}
