import type { Trade } from "./types";
import type { Opportunity } from "./backtest";

/** How long a deleted item stays recoverable before it's eligible for auto-purge. */
export const TRASH_RETENTION_DAYS = 7;

export interface TrashedTrade extends Trade {
  deletedAt: string; // ISO timestamp
}

export interface TrashedOpportunity extends Opportunity {
  deletedAt: string; // ISO timestamp
}

export interface TrashDoc {
  trades: TrashedTrade[];
  opportunities: TrashedOpportunity[];
}

export const emptyTrash: TrashDoc = { trades: [], opportunities: [] };

export function normalizeTrash(raw: Partial<TrashDoc> | null | undefined): TrashDoc {
  return {
    trades: raw?.trades ?? [],
    opportunities: raw?.opportunities ?? [],
  };
}

function expired(deletedAt: string, now: Date): boolean {
  const ageMs = now.getTime() - new Date(deletedAt).getTime();
  return ageMs > TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/** Drops entries past the retention window; returns the same reference if nothing changed. */
export function purgeExpiredTrash(doc: TrashDoc, now = new Date()): TrashDoc {
  const trades = doc.trades.filter((t) => !expired(t.deletedAt, now));
  const opportunities = doc.opportunities.filter((o) => !expired(o.deletedAt, now));
  if (trades.length === doc.trades.length && opportunities.length === doc.opportunities.length) {
    return doc;
  }
  return { trades, opportunities };
}

export function daysLeft(deletedAt: string, now = new Date()): number {
  const ageMs = now.getTime() - new Date(deletedAt).getTime();
  const remainingMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000 - ageMs;
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}
