import { defaultSchedule, type SessionSchedule } from "./session";

/**
 * A strategy is the workspace everything else hangs off: its own rules,
 * session schedule, playbook, trades, reviews and backtest.
 */

export interface PlaybookStep {
  id: string;
  heading: string;
  imagePath: string | null; // repo-relative
  description: string;
}

/**
 * The strategy definition, mirroring the Strategy:Rules sheet. Every row there
 * is a field here, grouped the way the sheet groups them.
 */
export interface StrategyDefinition {
  assets: string;
  strategyPattern: string;
  trigger: string;
  triggerTimeFrame: string;
  validationEntry: string;
  validationTimeFrame: string;
  stop: string;
  stopFormat: string;
  stopTimeFrame: string;
  takeProfit: string;
  tpTimeFrame: string;
  partialTp: string;
  minimalRTarget: string;
  biggerPicture: string;
}

export const emptyDefinition: StrategyDefinition = {
  assets: "",
  strategyPattern: "",
  trigger: "",
  triggerTimeFrame: "",
  validationEntry: "",
  validationTimeFrame: "",
  stop: "",
  stopFormat: "Pts.",
  stopTimeFrame: "",
  takeProfit: "",
  tpTimeFrame: "",
  partialTp: "",
  minimalRTarget: "",
  biggerPicture: "",
};

export const STOP_FORMATS = ["Pts.", "%", "$", "Ticks"] as const;

export type TargetCadence = "month" | "week";

/**
 * How many trades this strategy aims to take per period — the "trade slots"
 * idea: decide up front how many your edge actually supports, then weigh each
 * entry against "is this one of my best N?" Purely informational; logging past
 * the target is never blocked.
 */
export interface TradeTarget {
  cadence: TargetCadence;
  count: number;
}

export interface Strategy {
  id: string;
  name: string;
  schedule: SessionSchedule;
  definition: StrategyDefinition;
  strategyRules: string;
  strategyNotes: string;
  playbook: PlaybookStep[];
  createdAt: string;
  tradeTarget: TradeTarget | null;
}

/** Records written before strategies existed belong to this one. */
export const DEFAULT_STRATEGY_ID = "s1";

export function newStrategy(name: string): Strategy {
  return {
    id: crypto.randomUUID(),
    name,
    schedule: { ...defaultSchedule },
    definition: { ...emptyDefinition },
    strategyRules: "",
    strategyNotes: "",
    playbook: [],
    createdAt: new Date().toISOString(),
    tradeTarget: null,
  };
}

export function newPlaybookStep(): PlaybookStep {
  return { id: crypto.randomUUID(), heading: "", imagePath: null, description: "" };
}

function normalizeStep(raw: Partial<PlaybookStep>): PlaybookStep {
  return {
    id: raw.id ?? crypto.randomUUID(),
    heading: raw.heading ?? "",
    imagePath: raw.imagePath ?? null,
    description: raw.description ?? "",
  };
}

/** Accepts the earlier `monthlyTradeLimit` shape so existing records migrate. */
function normalizeTradeTarget(
  raw: Partial<Strategy> & { monthlyTradeLimit?: number | null },
): TradeTarget | null {
  const t = raw.tradeTarget;
  if (t && typeof t.count === "number" && t.count > 0) {
    return { cadence: t.cadence === "week" ? "week" : "month", count: Math.floor(t.count) };
  }
  if (typeof raw.monthlyTradeLimit === "number" && raw.monthlyTradeLimit > 0) {
    return { cadence: "month", count: Math.floor(raw.monthlyTradeLimit) };
  }
  return null;
}

export function normalizeStrategy(
  raw: Partial<Strategy> & { monthlyTradeLimit?: number | null },
): Strategy {
  return {
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name?.trim() || "Untitled strategy",
    schedule: { ...defaultSchedule, ...(raw.schedule ?? {}) },
    definition: { ...emptyDefinition, ...(raw.definition ?? {}) },
    strategyRules: raw.strategyRules ?? "",
    strategyNotes: raw.strategyNotes ?? "",
    playbook: (raw.playbook ?? []).map(normalizeStep),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    tradeTarget: normalizeTradeTarget(raw),
  };
}

/**
 * Guarantees at least one strategy exists. When strategies.json is absent, the
 * legacy rules document becomes the seed strategy so nothing has to be
 * re-entered and existing records keep resolving.
 */
export function normalizeStrategies(
  raw: Partial<Strategy>[] | null | undefined,
  legacy?: { strategyRules?: string; strategyNotes?: string; schedule?: Partial<SessionSchedule> },
): Strategy[] {
  if (raw && raw.length > 0) return raw.map(normalizeStrategy);

  return [
    normalizeStrategy({
      id: DEFAULT_STRATEGY_ID,
      name: "GLD_STG_1",
      strategyRules: legacy?.strategyRules ?? "",
      strategyNotes: legacy?.strategyNotes ?? "",
      schedule: { ...defaultSchedule, ...(legacy?.schedule ?? {}) },
      // This seed is re-synthesized from legacy data every load until it's
      // saved once — defaulting to "now" here would make the strategy look
      // brand new on every session, which throws off anything that clamps a
      // date range to createdAt (e.g. adherence-since-start calculations).
      createdAt: new Date(0).toISOString(),
    }),
  ];
}

export function strategyById(strategies: Strategy[], id: string | undefined): Strategy | undefined {
  return strategies.find((s) => s.id === id);
}

/** Selected ids, dropping any that no longer exist; never returns empty. */
export function resolveSelection(strategies: Strategy[], selected: string[]): string[] {
  const valid = selected.filter((id) => strategies.some((s) => s.id === id));
  return valid.length > 0 ? valid : strategies.length > 0 ? [strategies[0].id] : [];
}

export function playbookImagePath(strategyId: string, stepId: string): string {
  return `strategy-assets/${strategyId}/${stepId}.jpg`;
}

/** A user-uploaded HTML helper tool (e.g. a trade-logging wizard), re-uploaded to update. */
export function backtestHelperPath(strategyId: string): string {
  return `strategy-assets/${strategyId}/backtest-helper.html`;
}
