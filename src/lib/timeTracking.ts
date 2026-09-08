import { formatDate } from "./stats";

/**
 * Time tracking is stored as intervals, never as a running counter.
 *
 * A counter incremented on a timer loses time whenever the tab is backgrounded
 * and throttled, or the machine sleeps. Wall-clock start/end pairs survive all
 * of that, and they also give a real record of when the work happened rather
 * than one opaque total.
 */
export interface TimeSegment {
  start: string; // ISO
  end: string | null; // null while running
}

export interface TimeSession {
  id: string;
  category: string;
  segments: TimeSegment[];
  note: string;
  createdAt: string;
  /** Last moment the app was known to be open with this session running. */
  lastSeen?: string;
}

export interface TimeDoc {
  categories: string[];
  sessions: TimeSession[];
}

export const DEFAULT_CATEGORIES = ["Backtest", "Journaling", "Study", "Review"];

export const emptyTimeDoc: TimeDoc = { categories: DEFAULT_CATEGORIES, sessions: [] };

/** An open segment older than this was almost certainly left running by mistake. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export function normalizeTimeSession(raw: Partial<TimeSession>): TimeSession {
  const segments = (raw.segments ?? [])
    .filter((s): s is TimeSegment => typeof s?.start === "string")
    .map((s) => ({ start: s.start, end: typeof s.end === "string" ? s.end : null }));
  return {
    id: raw.id ?? crypto.randomUUID(),
    category: raw.category ?? "Backtest",
    segments,
    note: raw.note ?? "",
    createdAt: raw.createdAt ?? segments[0]?.start ?? new Date().toISOString(),
    ...(raw.lastSeen ? { lastSeen: raw.lastSeen } : {}),
  };
}

export function normalizeTimeDoc(raw: Partial<TimeDoc> | null | undefined): TimeDoc {
  const categories = (raw?.categories ?? []).filter((c) => typeof c === "string" && c.trim());
  return {
    categories: categories.length > 0 ? categories : [...DEFAULT_CATEGORIES],
    sessions: (raw?.sessions ?? []).map(normalizeTimeSession),
  };
}

export function isRunning(session: TimeSession): boolean {
  const last = session.segments[session.segments.length - 1];
  return Boolean(last && last.end === null);
}

export function openSegment(session: TimeSession): TimeSegment | null {
  const last = session.segments[session.segments.length - 1];
  return last && last.end === null ? last : null;
}

export function segmentMs(seg: TimeSegment, now: Date = new Date()): number {
  const start = new Date(seg.start).getTime();
  const end = seg.end ? new Date(seg.end).getTime() : now.getTime();
  // Guard against a clock change or a bad manual entry producing negative time.
  return Math.max(0, end - start);
}

export function sessionMs(session: TimeSession, now: Date = new Date()): number {
  return session.segments.reduce((sum, s) => sum + segmentMs(s, now), 0);
}

/**
 * Splits a segment at local midnight so a session running past midnight is
 * credited to each day it actually covers, rather than all landing on the day
 * it started. Month totals depend on this.
 */
export function segmentDayParts(
  seg: TimeSegment,
  now: Date = new Date(),
): { date: string; ms: number }[] {
  const start = new Date(seg.start);
  const end = seg.end ? new Date(seg.end) : now;
  if (!(end.getTime() > start.getTime())) return [];

  const parts: { date: string; ms: number }[] = [];
  let cursor = start;
  while (cursor.getTime() < end.getTime()) {
    const midnight = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    const chunkEnd = midnight.getTime() < end.getTime() ? midnight : end;
    parts.push({ date: formatDate(cursor), ms: chunkEnd.getTime() - cursor.getTime() });
    cursor = chunkEnd;
  }
  return parts;
}

/** Milliseconds per day across every session, split correctly across midnight. */
export function msByDay(sessions: TimeSession[], now: Date = new Date()): Map<string, number> {
  const map = new Map<string, number>();
  for (const session of sessions) {
    for (const seg of session.segments) {
      for (const part of segmentDayParts(seg, now)) {
        map.set(part.date, (map.get(part.date) ?? 0) + part.ms);
      }
    }
  }
  return map;
}

/** Milliseconds per category within one month, highest first. */
export function msByCategoryForMonth(
  sessions: TimeSession[],
  year: number,
  month: number, // 1-12
  now: Date = new Date(),
): { category: string; ms: number }[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const totals = new Map<string, number>();
  for (const session of sessions) {
    for (const seg of session.segments) {
      for (const part of segmentDayParts(seg, now)) {
        if (!part.date.startsWith(prefix)) continue;
        totals.set(session.category, (totals.get(session.category) ?? 0) + part.ms);
      }
    }
  }
  return [...totals.entries()]
    .map(([category, ms]) => ({ category, ms }))
    .sort((a, b) => b.ms - a.ms);
}

/** Sessions with any time inside the given day. */
export function sessionsOnDay(
  sessions: TimeSession[],
  date: string,
  now: Date = new Date(),
): TimeSession[] {
  return sessions.filter((s) =>
    s.segments.some((seg) => segmentDayParts(seg, now).some((p) => p.date === date)),
  );
}

/** "1:04:09" once past an hour, otherwise "4:09". */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** "3h 20m" — for summaries, where seconds are noise. */
export function formatHours(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function newSession(category: string, now: Date = new Date()): TimeSession {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    category,
    segments: [{ start: iso, end: null }],
    note: "",
    createdAt: iso,
    lastSeen: iso,
  };
}

export function pause(session: TimeSession, now: Date = new Date()): TimeSession {
  if (!isRunning(session)) return session;
  const segments = session.segments.slice();
  segments[segments.length - 1] = { ...segments[segments.length - 1], end: now.toISOString() };
  return { ...session, segments, lastSeen: now.toISOString() };
}

export function resume(session: TimeSession, now: Date = new Date()): TimeSession {
  if (isRunning(session)) return session;
  return {
    ...session,
    segments: [...session.segments, { start: now.toISOString(), end: null }],
    lastSeen: now.toISOString(),
  };
}

/** Closes any open segment and drops zero-length ones. */
export function finish(session: TimeSession, now: Date = new Date()): TimeSession {
  const closed = pause(session, now);
  return { ...closed, segments: closed.segments.filter((s) => segmentMs(s, now) > 0) };
}

/**
 * An open segment that has been running longer than the threshold — i.e. the
 * timer was almost certainly left going. Returns null when there isn't one.
 */
export function staleOpenSegment(
  session: TimeSession | null,
  now: Date = new Date(),
): TimeSegment | null {
  if (!session) return null;
  const open = openSegment(session);
  if (!open) return null;
  return segmentMs(open, now) > STALE_AFTER_MS ? open : null;
}

/** Ends the open segment at `lastSeen`, discarding time after the app was last seen. */
export function trimToLastSeen(session: TimeSession): TimeSession {
  const open = openSegment(session);
  if (!open || !session.lastSeen) return session;
  const segments = session.segments.slice();
  segments[segments.length - 1] = { ...open, end: session.lastSeen };
  return { ...session, segments: segments.filter((s) => segmentMs(s) > 0) };
}

/** Drops the open segment entirely, keeping earlier completed work. */
export function discardOpenSegment(session: TimeSession): TimeSession {
  if (!openSegment(session)) return session;
  return { ...session, segments: session.segments.slice(0, -1) };
}

/** Builds a session from typed-in times; returns null if the range is invalid. */
export function manualSession(
  category: string,
  date: string,
  startTime: string,
  endTime: string,
  note = "",
): TimeSession | null {
  if (!date || !startTime || !endTime) return null;
  const start = new Date(`${date}T${startTime}`);
  let end = new Date(`${date}T${endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  // An end before the start reads as running past midnight.
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return {
    id: crypto.randomUUID(),
    category,
    segments: [{ start: start.toISOString(), end: end.toISOString() }],
    note,
    createdAt: start.toISOString(),
  };
}
