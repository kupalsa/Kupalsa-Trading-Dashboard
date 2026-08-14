/**
 * GLD_STG_1 backtest / opportunity log.
 *
 * A row here is an OPPORTUNITY that met all 16 rules — not necessarily an
 * executed trade. Unfilled limit orders are first-class rows on purpose, so
 * expectancy can be computed per-opportunity rather than per-fill.
 *
 * Schema and semantics come from GLD_STG_1_DASHBOARD_SPEC.md.
 */

import { DEFAULT_STRATEGY_ID } from "./strategy";

export type ZoneSide = "Upper" | "Lower";
export type ZoneType = "Wick" | "Body";
export type Direction = "Long" | "Short";
export type Outcome = "Win" | "Loss" | "Breakeven" | "NA";
export type Arrival = "Impulsive" | "Mixed" | "Drift";
export type Phase = "A" | "B" | "C" | "D" | "E";
export type YesNoNA = "Yes" | "No" | "NA";

export const SETUP_TYPES = [
  "🟢 Reversal direct",
  "🟠 Reversal + Conf",
  "🔵 Continuation",
  "🟡 Break Retest",
  "🔴 Phase A",
] as const;
export type SetupType = (typeof SETUP_TYPES)[number];

export type SetupFamily = "Reversal" | "Continuation";

export const SETUP_FAMILY: Record<SetupType, SetupFamily> = {
  "🟢 Reversal direct": "Reversal",
  "🟠 Reversal + Conf": "Reversal",
  "🔴 Phase A": "Reversal",
  "🔵 Continuation": "Continuation",
  "🟡 Break Retest": "Continuation",
};

/** Shown as a help card when a setup type is selected (spec §5.1). */
export const SETUP_HELP: Record<SetupType, string> = {
  "🟢 Reversal direct":
    "Drift arrival — sideways, overlapping candles into the zone. Limit in or just before the FVG inside the entry zone. No confirmation required: the drift arrival IS the signal, because a slow orderly approach reads as a liquidity grab rather than a breakout attempt.",
  "🟠 Reversal + Conf":
    "Impulsive arrival — a single strong 15m candle drives into the zone. Enter after price enters the FVG AND a 5m CHoCH confirms. Confirmation is required: an impulsive arrival raises breakout risk, and the CHoCH is what says the reversal actually started.",
  "🔵 Continuation":
    "Price already moving in the intended direction (typically phase E) and you join the move on a retracement. Strong impulsive move → tight retracement near the top of the last leg; normal move → deeper retracement to the level the move came from. No confirmation: the move itself is the confirmation.",
  "🟡 Break Retest":
    "A zone (ice or creek) was broken by a BOS/CHoCH close and price returns to retest it. Enter on the retest in the direction of the break. Unlike Continuation (an ongoing move you join), this is the FIRST retest after a fresh break — typically the higher-conviction entry.",
  "🔴 Phase A":
    "At a buy/selling climax — the end of a strong impulsive move, fading the extreme. Enter on a retracement toward the BC/SC, usually with an FVG. TP at the AR area or the ST level. Higher risk than green: momentum into the reversal is stronger, so the ST may push through the entry area first.",
};

export const STOOD_DOWN_TYPES = [
  "None",
  "Phase E - ran away",
  "No quality stop",
  "No confirmation at zone",
  "Gap zone - untradeable",
] as const;
export type StoodDownType = (typeof STOOD_DOWN_TYPES)[number];

export interface Screenshot {
  path: string; // repo-relative
  caption: string;
}

export interface Opportunity {
  id: string;
  strategyId: string;
  seq: number; // sequential display ID

  // Identification
  date: string; // YYYY-MM-DD — the ACTUAL trade/replay date, never auto-today

  // Entry zone (traded FROM)
  ezSide: ZoneSide | "";
  ezType: ZoneType | "";
  ezTaggedPreSession: boolean;
  ezTaggedDuringSession: boolean;

  // Target zone (aimed AT)
  tzSide: ZoneSide | "";
  tzType: ZoneType | "";
  tzTaggedPreSession: boolean;
  tzTaggedDuringSession: boolean;
  tzBrokenByEnd: boolean;

  // Context & timing
  secondUpperZone: boolean;
  secondLowerZone: boolean;
  entryTime: string; // HH:MM Israel
  exitTime: string; // HH:MM Israel
  closeChangedZones: YesNoNA | "";

  // Setup
  setupType: SetupType | "";
  direction: Direction | "";
  arrival: Arrival | "";
  fvgPresentAtEntry: boolean;
  fvgFilled: YesNoNA | "";
  phaseHTF: Phase | "";
  phaseLTF: Phase | "";
  stoodDownType: StoodDownType;

  // Price levels (locked once confirmed)
  natEntry: number | null;
  natStop: number | null;
  natTP: number | null;
  optEntry: number | null;
  optStop: number | null;
  optTP: number | null;

  // Session extremes (locked)
  sessionPeak: number | null;
  sessionTrough: number | null;

  // Natural intraday
  natFilled: boolean;
  natOutcome: Outcome | "";

  // Optimized intraday
  optFilled: boolean;
  optOutcome: Outcome | "";

  // Swing levels (locked)
  swingTP: number | null;
  swingStop: number | null;

  // Swing outcomes
  swingNatOutcome: Outcome | "";
  swingOptOutcome: Outcome | "";

  pricesLocked: boolean;
  screenshots: Screenshot[];
  note: string;
  createdAt: string;
}

export function emptyOpportunity(seq: number, strategyId: string): Opportunity {
  return {
    id: crypto.randomUUID(),
    strategyId,
    seq,
    date: "",
    ezSide: "",
    ezType: "",
    ezTaggedPreSession: false,
    ezTaggedDuringSession: false,
    tzSide: "",
    tzType: "",
    tzTaggedPreSession: false,
    tzTaggedDuringSession: false,
    tzBrokenByEnd: false,
    secondUpperZone: false,
    secondLowerZone: false,
    entryTime: "",
    exitTime: "",
    closeChangedZones: "",
    setupType: "",
    direction: "",
    arrival: "",
    fvgPresentAtEntry: false,
    fvgFilled: "",
    phaseHTF: "",
    phaseLTF: "",
    stoodDownType: "None",
    natEntry: null,
    natStop: null,
    natTP: null,
    optEntry: null,
    optStop: null,
    optTP: null,
    sessionPeak: null,
    sessionTrough: null,
    natFilled: false,
    natOutcome: "",
    optFilled: false,
    optOutcome: "",
    swingTP: null,
    swingStop: null,
    swingNatOutcome: "",
    swingOptOutcome: "",
    pricesLocked: false,
    screenshots: [],
    note: "",
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Derived fields. Never manually editable (spec §6).
// ---------------------------------------------------------------------------

export interface DerivedOpportunity {
  day: string;
  windowTraded: string;
  minsInTrade: number | null;
  natStopSize: number | null;
  optStopSize: number | null;
  optimizationNeeded: boolean | null;
  naturalR: number | null;
  optimizedR: number | null;
  natMfeR: number | null;
  natMaeR: number | null;
  optMfeR: number | null;
  optMaeR: number | null;
  swingStopSize: number | null;
  swingNatR: number | null;
  swingOptR: number | null;
  swingValid: "Valid" | "Not Valid" | null;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayOfWeek(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

function toMinutes(hhmm: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Ratio guarded against a zero/absent denominator. */
function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function absDiff(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.abs(a - b);
}

/**
 * MFE/MAE are direction-aware and clamped at 0 (spec §3). Session Peak drives
 * MFE for a long and MAE for a short; Session Trough does the reverse.
 */
function excursions(
  direction: Direction | "",
  entry: number | null,
  stopSize: number | null,
  peak: number | null,
  trough: number | null,
): { mfe: number | null; mae: number | null } {
  if (!direction || entry == null || stopSize == null || stopSize === 0) {
    return { mfe: null, mae: null };
  }
  const favourable = direction === "Long" ? peak : trough;
  const adverse = direction === "Long" ? trough : peak;
  if (favourable == null || adverse == null) return { mfe: null, mae: null };

  const rawMfe = direction === "Long" ? favourable - entry : entry - favourable;
  const rawMae = direction === "Long" ? entry - adverse : adverse - entry;
  return {
    mfe: Math.max(0, rawMfe) / stopSize,
    mae: Math.max(0, rawMae) / stopSize,
  };
}

export function derive(o: Opportunity): DerivedOpportunity {
  const natStopSize = absDiff(o.natEntry, o.natStop);
  const optStopSize = absDiff(o.optEntry, o.optStop);
  const swingStopSize = absDiff(o.natEntry, o.swingStop);

  const entryMins = toMinutes(o.entryTime);
  const exitMins = toMinutes(o.exitTime);
  let minsInTrade: number | null = null;
  if (entryMins != null && exitMins != null) {
    minsInTrade = exitMins - entryMins;
    if (minsInTrade < 0) minsInTrade += 24 * 60;
  }

  let windowTraded = "";
  if (entryMins != null) {
    windowTraded = entryMins < 17 * 60 ? "16:00-17:00" : "17:00-19:00";
  }

  const nat = excursions(o.direction, o.natEntry, natStopSize, o.sessionPeak, o.sessionTrough);
  const opt = excursions(o.direction, o.optEntry, optStopSize, o.sessionPeak, o.sessionTrough);

  const swingNatR = ratio(absDiff(o.swingTP, o.natEntry), swingStopSize);
  const swingOptR = ratio(absDiff(o.swingTP, o.optEntry), absDiff(o.optEntry, o.swingStop));

  let swingValid: "Valid" | "Not Valid" | null = null;
  if (swingNatR != null || swingOptR != null) {
    swingValid = (swingNatR ?? 0) >= 3 || (swingOptR ?? 0) >= 3 ? "Valid" : "Not Valid";
  }

  return {
    day: dayOfWeek(o.date),
    windowTraded,
    minsInTrade,
    natStopSize,
    optStopSize,
    optimizationNeeded:
      o.natEntry == null || o.optEntry == null ? null : o.natEntry !== o.optEntry,
    naturalR: ratio(absDiff(o.natTP, o.natEntry), natStopSize),
    optimizedR: ratio(absDiff(o.optTP, o.optEntry), optStopSize),
    natMfeR: nat.mfe,
    natMaeR: nat.mae,
    optMfeR: opt.mfe,
    optMaeR: opt.mae,
    swingStopSize,
    swingNatR,
    swingOptR,
    swingValid,
  };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type Basis = "natural" | "optimized";
export type Population = "all" | "filled";

/** Rows that represent an attempted trade rather than a stand-down (spec §6). */
export function attemptedOnly(rows: Opportunity[]): Opportunity[] {
  return rows.filter((o) => o.stoodDownType === "None");
}

export function isFilled(o: Opportunity, basis: Basis): boolean {
  return basis === "natural" ? o.natFilled : o.optFilled;
}

export function outcomeOf(o: Opportunity, basis: Basis): Outcome | "" {
  return basis === "natural" ? o.natOutcome : o.optOutcome;
}

/**
 * Realised R for one row. An unfilled opportunity scores 0 — it consumed a
 * slot but returned nothing, which is exactly the cost that per-opportunity
 * expectancy is meant to capture.
 */
export function realisedR(o: Opportunity, basis: Basis): number {
  if (!isFilled(o, basis)) return 0;
  const d = derive(o);
  const plannedR = basis === "natural" ? d.naturalR : d.optimizedR;
  const outcome = outcomeOf(o, basis);
  if (outcome === "Win") return plannedR ?? 0;
  if (outcome === "Loss") return -1;
  return 0; // Breakeven or NA
}

export interface ExpectancyStats {
  n: number;
  wins: number;
  losses: number;
  winRate: number; // 0-100, excludes breakeven/NA
  totalR: number;
  avgR: number;
  fillRate: number; // 0-100
  avgMfeR: number | null;
  avgMaeR: number | null;
}

export function expectancy(
  rows: Opportunity[],
  basis: Basis,
  population: Population,
): ExpectancyStats {
  const attempted = attemptedOnly(rows);
  const scoped =
    population === "filled" ? attempted.filter((o) => isFilled(o, basis)) : attempted;

  const wins = scoped.filter((o) => outcomeOf(o, basis) === "Win").length;
  const losses = scoped.filter((o) => outcomeOf(o, basis) === "Loss").length;
  const decisive = wins + losses;
  const totalR = scoped.reduce((sum, o) => sum + realisedR(o, basis), 0);

  const mfes = scoped
    .map((o) => (basis === "natural" ? derive(o).natMfeR : derive(o).optMfeR))
    .filter((v): v is number => v != null);
  const maes = scoped
    .map((o) => (basis === "natural" ? derive(o).natMaeR : derive(o).optMaeR))
    .filter((v): v is number => v != null);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    n: scoped.length,
    wins,
    losses,
    winRate: decisive ? (wins / decisive) * 100 : 0,
    totalR,
    avgR: scoped.length ? totalR / scoped.length : 0,
    fillRate: attempted.length
      ? (attempted.filter((o) => isFilled(o, basis)).length / attempted.length) * 100
      : 0,
    avgMfeR: mean(mfes),
    avgMaeR: mean(maes),
  };
}

export function normalizeOpportunity(raw: Partial<Opportunity>): Opportunity {
  return {
    ...emptyOpportunity(raw.seq ?? 0, raw.strategyId ?? DEFAULT_STRATEGY_ID),
    ...raw,
    id: raw.id ?? crypto.randomUUID(),
    strategyId: raw.strategyId ?? DEFAULT_STRATEGY_ID,
    screenshots: raw.screenshots ?? [],
  };
}

export function opportunitiesForMonth(
  rows: Opportunity[],
  year: number,
  month: number,
): Opportunity[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return rows.filter((o) => o.date.startsWith(prefix));
}

/** Stand-down reasons, excluding "None" which marks an attempted trade. */
export function standDownBreakdown(rows: Opportunity[]): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const o of rows) {
    if (o.stoodDownType === "None") continue;
    counts.set(o.stoodDownType, (counts.get(o.stoodDownType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/** Sample sizes below this are too small to read into (spec §8). */
export const MIN_SAMPLE = 30;
