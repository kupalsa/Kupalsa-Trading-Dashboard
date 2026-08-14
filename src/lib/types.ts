import { defaultSchedule, type SessionSchedule } from "./session";
import { DEFAULT_STRATEGY_ID } from "./strategy";

export type Direction = "Long" | "Short";
export type Result = "W" | "L" | "BE";

export interface Trade {
  id: string;
  strategyId: string;
  date: string; // YYYY-MM-DD
  day: string; // derived weekday name
  entryTime: string; // HH:MM
  exitTime: string; // HH:MM
  direction: Direction;
  result: Result;
  stopPoints: number;
  rr: number; // signed R multiple
  screenshotPath: string | null; // repo-relative path
  note: string;
  createdAt: string; // ISO timestamp
}

export const SESSION_OUTCOMES = [
  "Profitable Day",
  "Losing Day",
  "Breakeven Day",
  "No Trades — No Setup",
  "No Trades — Missed Opportunity",
] as const;
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

export const SESSION_STATES = [
  "Calm",
  "Focused",
  "FOMO",
  "Hesitation",
  "Forcing",
  "Distracted",
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export interface DailyReviewChecklist {
  backtestValid: boolean;
  executionOnlyFocus: boolean;
  noInterference: boolean;
  sessionLogged: boolean;
  stopEntryTpFollowed: boolean;
  strategyValid: boolean;
  structureValid: boolean;
}

export const emptyChecklist: DailyReviewChecklist = {
  backtestValid: false,
  executionOnlyFocus: false,
  noInterference: false,
  sessionLogged: false,
  stopEntryTpFollowed: false,
  strategyValid: false,
  structureValid: false,
};

export interface DailyReview {
  strategyId: string;
  date: string; // YYYY-MM-DD — one review per strategy per day
  sessionOutcome: SessionOutcome | "";
  states: SessionState[]; // how the session felt — several can apply at once
  checklist: DailyReviewChecklist;
  notes: string;
}

/** Older reviews stored a single `entryState` and no strategy. */
export function normalizeDailyReview(raw: Partial<DailyReview> & { entryState?: string }): DailyReview {
  const legacy = raw.entryState;
  const states =
    raw.states ??
    (legacy && SESSION_STATES.includes(legacy as SessionState) ? [legacy as SessionState] : []);

  return {
    strategyId: raw.strategyId ?? DEFAULT_STRATEGY_ID,
    date: raw.date ?? "",
    sessionOutcome: raw.sessionOutcome ?? "",
    states,
    checklist: { ...emptyChecklist, ...(raw.checklist ?? {}) },
    notes: raw.notes ?? "",
  };
}

export function normalizeTrade(raw: Partial<Trade>): Trade {
  return {
    id: raw.id ?? crypto.randomUUID(),
    strategyId: raw.strategyId ?? DEFAULT_STRATEGY_ID,
    date: raw.date ?? "",
    day: raw.day ?? "",
    entryTime: raw.entryTime ?? "",
    exitTime: raw.exitTime ?? "",
    direction: raw.direction ?? "Long",
    result: raw.result ?? "BE",
    stopPoints: raw.stopPoints ?? 0,
    rr: raw.rr ?? 0,
    screenshotPath: raw.screenshotPath ?? null,
    note: raw.note ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export function isAdherent(review: DailyReview): boolean {
  return Object.values(review.checklist).every(Boolean);
}

export interface RulesDoc {
  strategyRules: string;
  strategyNotes: string;
  schedule: SessionSchedule;
}

export const emptyRulesDoc: RulesDoc = {
  strategyRules: "",
  strategyNotes: "",
  schedule: defaultSchedule,
};

/** Rules files written before the schedule existed lack that field. */
export function normalizeRules(raw: Partial<RulesDoc> | null | undefined): RulesDoc {
  return {
    strategyRules: raw?.strategyRules ?? "",
    strategyNotes: raw?.strategyNotes ?? "",
    schedule: { ...defaultSchedule, ...(raw?.schedule ?? {}) },
  };
}
