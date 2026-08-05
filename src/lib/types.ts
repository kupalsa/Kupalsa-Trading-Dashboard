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

export interface DailyReview {
  date: string; // YYYY-MM-DD
  followedRules: boolean;
  tookGoodTrades: boolean;
  focusedAndCalm: boolean;
  notes: string;
}

export interface RulesDoc {
  strategyRules: string;
  strategyNotes: string;
}

export const emptyRulesDoc: RulesDoc = {
  strategyRules: "",
  strategyNotes: "",
};
