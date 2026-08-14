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

export interface Strategy {
  id: string;
  name: string;
  schedule: SessionSchedule;
  strategyRules: string;
  strategyNotes: string;
  playbook: PlaybookStep[];
  createdAt: string;
}

/** Records written before strategies existed belong to this one. */
export const DEFAULT_STRATEGY_ID = "s1";

export function newStrategy(name: string): Strategy {
  return {
    id: crypto.randomUUID(),
    name,
    schedule: { ...defaultSchedule },
    strategyRules: "",
    strategyNotes: "",
    playbook: [],
    createdAt: new Date().toISOString(),
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

export function normalizeStrategy(raw: Partial<Strategy>): Strategy {
  return {
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name?.trim() || "Untitled strategy",
    schedule: { ...defaultSchedule, ...(raw.schedule ?? {}) },
    strategyRules: raw.strategyRules ?? "",
    strategyNotes: raw.strategyNotes ?? "",
    playbook: (raw.playbook ?? []).map(normalizeStep),
    createdAt: raw.createdAt ?? new Date().toISOString(),
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
