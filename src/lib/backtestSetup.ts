import { DEFAULT_STRATEGY_ID } from "./strategy";

export type LoggerQuestionType = "choice" | "date" | "time" | "text" | "number";

export interface LoggerQuestion {
  id: string;
  section: string;
  title: string;
  note: string;
  type: LoggerQuestionType;
  options: string[]; // only meaningful when type === "choice"
}

/**
 * A named, editable question sequence that drives the in-app trade-logging
 * wizard for one strategy. Replaces the earlier uploaded-HTML-tool approach —
 * everything lives in the repo's JSON data instead of a separate file.
 */
export interface BacktestSetup {
  id: string;
  strategyId: string;
  name: string;
  questions: LoggerQuestion[];
  createdAt: string;
}

export function newLoggerQuestion(): LoggerQuestion {
  return {
    id: crypto.randomUUID(),
    section: "",
    title: "",
    note: "",
    type: "choice",
    options: ["Yes", "No"],
  };
}

export function normalizeLoggerQuestion(raw: Partial<LoggerQuestion>): LoggerQuestion {
  return {
    id: raw.id ?? crypto.randomUUID(),
    section: raw.section ?? "",
    title: raw.title ?? "",
    note: raw.note ?? "",
    type: raw.type ?? "choice",
    options: Array.isArray(raw.options) ? raw.options : [],
  };
}

export function normalizeBacktestSetup(raw: Partial<BacktestSetup>): BacktestSetup {
  return {
    id: raw.id ?? crypto.randomUUID(),
    strategyId: raw.strategyId ?? DEFAULT_STRATEGY_ID,
    name: raw.name ?? "Untitled setup",
    questions: Array.isArray(raw.questions) ? raw.questions.map(normalizeLoggerQuestion) : [],
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export function newBacktestSetup(name: string, strategyId: string): BacktestSetup {
  return {
    id: crypto.randomUUID(),
    strategyId,
    name,
    questions: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * The GLD_STG_1 26-question logger, ported from the previously-uploaded HTML
 * tool, plus the 4H-confluence question added 2026-09-15: a zone alone isn't
 * a trade — it only counts if a 4H+ Wyckoff process line (support/resistance)
 * backs both the entry and the stop. Without that, the setup is skipped
 * rather than logged as "Stood down", since it never qualified as a trade.
 */
export function defaultGldStg1Setup(strategyId: string): BacktestSetup {
  const q = (
    section: string,
    title: string,
    note: string,
    type: LoggerQuestionType,
    options: string[] = [],
  ): LoggerQuestion => ({ id: crypto.randomUUID(), section, title, note, type, options });

  return {
    id: crypto.randomUUID(),
    strategyId,
    name: "GLD_STG_1 Trade Logger",
    createdAt: new Date().toISOString(),
    questions: [
      q("ZONES", "Date", "The actual trade / replay date.", "date"),
      q("ZONES", "Entry zone — side", "", "choice", ["Upper", "Lower"]),
      q("ZONES", "Entry zone — type", "", "choice", ["Wick", "Body"]),
      q(
        "ZONES",
        "Entry zone — state at entry",
        "Decides the setup: Unfilled → Reversal · Tagged & intact → Continuation · Broken → Break Continuation",
        "choice",
        ["Unfilled", "Tagged & intact", "Broken"],
      ),
      q(
        "CONFLUENCE",
        "4H+ support at entry & stop?",
        "A Wyckoff process line (support/resistance), 4H timeframe or higher, must back both the entry and the stop. The zone alone is just today's timing — without this confluence it isn't a trade at all, so log it as No and stop here.",
        "choice",
        ["Yes", "No"],
      ),
      q("ZONES", "Target zone — type", "", "choice", ["Wick", "Body"]),
      q("ZONES", "Target zone — broken by end?", "Did price close through it by 23:05.", "choice", [
        "Yes",
        "No",
      ]),
      q("ZONES", "2nd upper zone existed?", "", "choice", ["Yes", "No"]),
      q("ZONES", "2nd lower zone existed?", "", "choice", ["Yes", "No"]),
      q("TIMING", "Entry time", "Israel time.", "time"),
      q("TIMING", "Exit time", "Israel time.", "time"),
      q("TIMING", "17:00 close changed zones?", "", "choice", ["Yes", "No", "NA"]),
      q("SETUP", "Arrival", "", "choice", ["Impulsive", "Mixed", "Drift"]),
      q("SETUP", "FVG present at entry?", "", "choice", ["Yes", "No"]),
      q("SETUP", "Wyckoff phase — higher timeframe", "", "choice", ["A", "B", "C", "D", "E"]),
      q("SETUP", "Wyckoff phase — lower timeframe", "", "choice", ["A", "B", "C", "D", "E"]),
      q(
        "SETUP",
        "Stood down type",
        "'None' = you traded, or placed an order in good faith.",
        "choice",
        ["None", "Phase E - ran away", "No quality stop", "Gap zone - untradeable"],
      ),
      q("FILL & OUTCOME", "Natural entry filled?", "", "choice", ["Yes", "No"]),
      q("FILL & OUTCOME", "Natural outcome", "", "choice", ["Win", "Loss", "Breakeven", "NA"]),
      q("FILL & OUTCOME", "Optimized entry filled?", "", "choice", ["Yes", "No"]),
      q("FILL & OUTCOME", "Optimized outcome", "", "choice", ["Win", "Loss", "Breakeven", "NA"]),
      q(
        "FILL & OUTCOME",
        "Swing natural outcome",
        "Swing runs to next day's 23:05.",
        "choice",
        ["Win", "Loss", "Breakeven", "NA", "Don't know yet"],
      ),
      q("FILL & OUTCOME", "Swing optimized outcome", "", "choice", [
        "Win",
        "Loss",
        "Breakeven",
        "NA",
        "Don't know yet",
      ]),
      q(
        "STOP QUALITY",
        "Stop timeframe",
        "Highest timeframe with a real structural point behind the stop. Hard cap 25pts, ceiling 30pts.",
        "choice",
        ["4H", "1H", "15m"],
      ),
      q(
        "STOP QUALITY",
        "Stop support type",
        "Swing = a swing point (the normal case). FVG = rare, high-conviction only.",
        "choice",
        ["Swing", "FVG"],
      ),
      q(
        "EXIT",
        "Natural exit type",
        "If Forced close, remember to tell Claude the actual close price separately when you paste this.",
        "choice",
        ["TP hit", "Stop hit", "Forced close", "Not filled"],
      ),
      q("EXIT", "Optimized exit type", "", "choice", ["TP hit", "Stop hit", "Forced close", "Not filled"]),
    ],
  };
}
