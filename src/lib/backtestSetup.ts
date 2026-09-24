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

const CANDLE_TYPES = [
  "Marubozu",
  "Strong-body / trend",
  "Engulfing",
  "Pin bar / rejection",
  "Hammer / Shooting star",
  "Spinning top",
  "Doji",
  "Inside / narrow-range",
];

/**
 * GLD_STG_1's 37-question logger, corrected 2026-09-24: the original
 * "zones" wording undersold the actual live process, which is really about
 * trading the move between the closest unfilled 4H gap above and below
 * price (verified on 1H), executed on 5m. This replaces the earlier
 * 26/27-question zones-based draft outright — no Natural/Optimized split,
 * no swing tracking, no 4H-confluence gate, a two-state (not three-state)
 * Setup Type, plus new gap-quality tracking. This is a backtest-wizard
 * change only; the strategy's live trading data is untouched.
 */
export function defaultGldStg1Setup(strategyId: string): BacktestSetup {
  const q = (
    section: string,
    title: string,
    note: string,
    type: LoggerQuestionType,
    options: string[] = [],
  ): LoggerQuestion => ({ id: crypto.randomUUID(), section, title, note, type, options });

  const gapQuality = (which: "Entry" | "Target") => [
    q(`${which.toUpperCase()} GAP QUALITY`, "FVG/IFVG included?", "", "choice", ["Yes", "No"]),
    q(`${which.toUpperCase()} GAP QUALITY`, "4H gap candle type", "", "choice", CANDLE_TYPES),
    q(`${which.toUpperCase()} GAP QUALITY`, "1H gap candle type", "", "choice", CANDLE_TYPES),
    q(`${which.toUpperCase()} GAP QUALITY`, "Gap age (hrs)", "", "number"),
    q(`${which.toUpperCase()} GAP QUALITY`, "Touch count", "", "number"),
    q(
      `${which.toUpperCase()} GAP QUALITY`,
      "HTF line at gap?",
      "Quality note only — different question from Q22 / Rule 15.",
      "choice",
      ["Yes", "No"],
    ),
    q(`${which.toUpperCase()} GAP QUALITY`, "Gap definition", "", "choice", [
      "Clean on 4H",
      "Blurry on 4H – defined on 1H",
    ]),
  ];

  return {
    id: crypto.randomUUID(),
    strategyId,
    name: "GLD_STG_1 Trade Logger",
    createdAt: new Date().toISOString(),
    questions: [
      q("GAPS", "Date", "The actual trade / replay date.", "date"),
      q("GAPS", "Entry gap — side", "", "choice", ["Upper", "Lower"]),
      q("GAPS", "Entry gap — type", "", "choice", ["Wick", "Body"]),
      q(
        "GAPS",
        "Entry gap — state at entry",
        "Decides the setup: Unfilled → 🟢 Reversal · Tagged & intact → 🔵 Continuation.",
        "choice",
        ["Unfilled", "Tagged & intact"],
      ),
      q("GAPS", "Target gap — type", "", "choice", ["Wick", "Body"]),
      q("GAPS", "Target gap — state at entry", "", "choice", ["Unfilled", "Tagged & intact"]),
      q("GAPS", "Target gap — broken by end?", "Did price close through it by 23:05.", "choice", [
        "Yes",
        "No",
      ]),
      q("TIMING", "Entry time", "Israel time.", "time"),
      q("TIMING", "Exit time", "Israel time.", "time"),
      q(
        "TIMING",
        "4H close changed gaps?",
        "Did the map change at the most recent 4H close.",
        "choice",
        ["Yes", "No", "NA"],
      ),
      q("SETUP", "Arrival", "", "choice", ["Impulsive", "Mixed", "Drift"]),
      q("SETUP", "Wyckoff phase — higher timeframe", "", "choice", ["A", "B", "C", "D", "E"]),
      q("SETUP", "Wyckoff phase — lower timeframe", "", "choice", ["A", "B", "C", "D", "E"]),
      q("SETUP", "Stood down type", "'None' = you traded, or placed an order in good faith.", "choice", [
        "None",
        "Phase E – ran away",
        "No quality stop",
        "Gap – untradeable",
      ]),
      q("FILL & OUTCOME", "Filled?", "", "choice", ["Yes", "No"]),
      q("FILL & OUTCOME", "Outcome", "", "choice", ["Win", "Loss", "Breakeven", "NA"]),
      q(
        "STOP QUALITY",
        "Stop timeframe",
        "15m is the floor — must be supported at minimum there. Log the highest timeframe that actually backs it. Max stop cap is 30 points.",
        "choice",
        ["15m", "1H", "4H"],
      ),
      q("STOP QUALITY", "Stop support type", "", "choice", ["Swing", "FVG"]),
      q("STOP QUALITY", "Stop clarity", "", "choice", [
        "Obvious immediately",
        "Had to choose between levels",
      ]),
      q(
        "EXIT",
        "Exit type",
        "If Forced close, remember to tell Claude the actual close price separately when you paste this.",
        "choice",
        ["TP hit", "Stop hit", "Forced close", "Not filled"],
      ),
      q(
        "EXIT",
        "Close price",
        "Only relevant if Exit type = Forced close. Never move the TP marker to this value — it's tracked separately so planned R and realized R stay distinct.",
        "number",
      ),
      q(
        "DISCIPLINE",
        "Traded against 4H/1D line?",
        "Rule 15: the entry-to-TP path may not require crossing an unbroken 4H/1D structural line. Yes means this trade broke that rule.",
        "choice",
        ["Yes", "No"],
      ),
      q(
        "DISCIPLINE",
        "TP placement",
        "Theory: TP sits where you'd enter the reversal from the other side of the target gap, capped at where you'd place that reversal's stop. If you pick Other, add a line below explaining the actual placement when you paste this into chat.",
        "choice",
        ["Theory", "Other"],
      ),
      ...gapQuality("Entry"),
      ...gapQuality("Target"),
    ],
  };
}
