import { defaultSchedule, type SessionSchedule } from "./session";

export type Direction = "Long" | "Short";
export type Result = "W" | "L" | "BE";

export interface Trade {
  id: string;
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

export const ENTRY_STATES = ["Calm", "Focused", "FOMO", "Hesitation", "Forcing", "Distracted"] as const;
export type EntryState = (typeof ENTRY_STATES)[number];

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
  date: string; // YYYY-MM-DD
  sessionOutcome: SessionOutcome | "";
  entryState: EntryState | "";
  checklist: DailyReviewChecklist;
  notes: string;
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
